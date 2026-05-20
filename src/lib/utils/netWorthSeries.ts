import type { Account, Transaction } from '$lib/db/types';

export interface NetWorthPoint {
	date: string; // YYYY-MM-DD
	value: number;
}

/**
 * Compute a daily net-worth series across the year.
 *
 * - Starting balance = sum of account opening balances + every transaction
 *   dated before the year start.
 * - For each day in the year (or up to `today` if mid-year), apply that day's
 *   transactions to the running total and emit a point.
 */
export function netWorthSeries(
	year: number,
	accounts: Account[],
	transactions: Transaction[],
	today: string = new Date().toISOString().slice(0, 10)
): NetWorthPoint[] {
	const yearStart = `${year}-01-01`;
	const yearEnd = `${year}-12-31`;

	// Only consider non-archived accounts for net worth (matches /accounts behavior)
	const liveAccounts = accounts.filter((a) => a.archived === 0);
	let cumulative = liveAccounts.reduce((s, a) => s + a.openingBalance, 0);

	// Apply every transaction dated before the year start
	for (const t of transactions) {
		if (t.date < yearStart) cumulative += t.amount;
	}

	// Sort in-year transactions by date and walk forward
	const inYear = transactions
		.filter((t) => t.date >= yearStart && t.date <= yearEnd)
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

	// Stop at today if mid-year (no projecting into the future)
	const stopAt = today < yearEnd ? today : yearEnd;

	const series: NetWorthPoint[] = [];
	let txIdx = 0;
	const cursor = new Date(`${yearStart}T00:00:00Z`);
	const stop = new Date(`${stopAt}T00:00:00Z`);

	while (cursor <= stop) {
		const y = cursor.getUTCFullYear();
		const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
		const d = String(cursor.getUTCDate()).padStart(2, '0');
		const dateStr = `${y}-${m}-${d}`;

		while (txIdx < inYear.length && inYear[txIdx].date === dateStr) {
			cumulative += inYear[txIdx].amount;
			txIdx++;
		}

		series.push({ date: dateStr, value: Math.round(cumulative * 100) / 100 });
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return series;
}
