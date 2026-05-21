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

/**
 * Compute a rolling-N-months net-worth series — one monthly snapshot per
 * month, ending at today, going back `monthsBack` months. Unlike
 * `netWorthSeries`, which is bounded to a calendar year, this version gives
 * the dashboard chart enough history to drive the 1M / 3M / 6M / YTD / 1Y
 * range filters all from real data.
 *
 * Opening cumulative = sum of all account opening balances + every
 * transaction dated before the rolling window. Each subsequent month adds
 * that month's transactions in chronological order.
 */
export function rollingMonthlySeries(
	accounts: Account[],
	transactions: Transaction[],
	monthsBack: number = 12,
	today: string = new Date().toISOString().slice(0, 10)
): NetWorthPoint[] {
	const [ty, tm] = today.split('-').map(Number);
	// First day of (today - monthsBack months). Using setUTCMonth so we don't
	// cross day boundaries when subtracting.
	const start = new Date(Date.UTC(ty, tm - 1 - monthsBack, 1));
	const startISO = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-01`;

	const liveAccounts = accounts.filter((a) => a.archived === 0);
	let cumulative = liveAccounts.reduce((s, a) => s + a.openingBalance, 0);

	// Apply every transaction dated strictly before the rolling start
	for (const t of transactions) {
		if (t.date < startISO) cumulative += t.amount;
	}

	const inRange = transactions
		.filter((t) => t.date >= startISO && t.date <= today)
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

	const series: NetWorthPoint[] = [];
	let txIdx = 0;
	const cursor = new Date(start);

	// Walk one month at a time until we pass today's month
	while (true) {
		const cy = cursor.getUTCFullYear();
		const cm = cursor.getUTCMonth() + 1;
		const mm = String(cm).padStart(2, '0');
		const monthPrefix = `${cy}-${mm}-`;

		while (txIdx < inRange.length && inRange[txIdx].date.startsWith(monthPrefix)) {
			cumulative += inRange[txIdx].amount;
			txIdx++;
		}

		// Snapshot at month-end, but cap at today for the in-progress month
		const lastDay = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
		const naturalDate = `${cy}-${mm}-${String(lastDay).padStart(2, '0')}`;
		const snapshotDate = naturalDate > today ? today : naturalDate;
		series.push({ date: snapshotDate, value: Math.round(cumulative * 100) / 100 });

		if (cy === ty && cm === tm) break;
		if (cy > ty || (cy === ty && cm > tm)) break;
		cursor.setUTCMonth(cursor.getUTCMonth() + 1);
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
