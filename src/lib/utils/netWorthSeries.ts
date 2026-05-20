import type { Account, Transaction } from '$lib/db/types';

export interface NetWorthPoint {
	date: string; // YYYY-MM-DD
	value: number;
}

export type Granularity = 'daily' | 'monthly';

/**
 * Compute a net-worth series across the year.
 *
 * - Starting balance = sum of account opening balances + every transaction
 *   dated before the year start.
 * - Daily granularity: one point per day up to today.
 * - Monthly granularity: one point per month, dated to the last day of that
 *   month — or today's date for the current in-progress month.
 */
export function netWorthSeries(
	year: number,
	accounts: Account[],
	transactions: Transaction[],
	today: string = new Date().toISOString().slice(0, 10),
	granularity: Granularity = 'daily'
): NetWorthPoint[] {
	const yearStart = `${year}-01-01`;
	const yearEnd = `${year}-12-31`;

	const liveAccounts = accounts.filter((a) => a.archived === 0);
	let cumulative = liveAccounts.reduce((s, a) => s + a.openingBalance, 0);

	// Apply every transaction dated before the year start
	for (const t of transactions) {
		if (t.date < yearStart) cumulative += t.amount;
	}

	const inYear = transactions
		.filter((t) => t.date >= yearStart && t.date <= yearEnd)
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

	const stopAt = today < yearEnd ? today : yearEnd;

	if (granularity === 'monthly') {
		return monthlySnapshots(year, cumulative, inYear, today, stopAt);
	}

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

function monthlySnapshots(
	year: number,
	openingCumulative: number,
	inYear: Transaction[],
	today: string,
	stopAt: string
): NetWorthPoint[] {
	const series: NetWorthPoint[] = [];
	const todayMonth = Number(today.slice(0, 7).split('-')[1]);
	const todayYear = Number(today.slice(0, 4));
	const isCurrentYear = todayYear === year;
	const lastMonth = isCurrentYear ? todayMonth : 12;

	let cumulative = openingCumulative;
	let txIdx = 0;

	for (let m = 1; m <= lastMonth; m++) {
		// Sum every transaction whose date falls within this month
		const mm = String(m).padStart(2, '0');
		const monthPrefix = `${year}-${mm}-`;
		while (
			txIdx < inYear.length &&
			inYear[txIdx].date.startsWith(monthPrefix)
		) {
			cumulative += inYear[txIdx].amount;
			txIdx++;
		}
		// Determine the snapshot date: last calendar day of the month, capped at today
		const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
		const naturalDate = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
		const snapshotDate = naturalDate > stopAt ? stopAt : naturalDate;
		series.push({ date: snapshotDate, value: Math.round(cumulative * 100) / 100 });
	}

	return series;
}
