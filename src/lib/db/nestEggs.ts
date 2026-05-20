import { db } from './index';
import type { NestEgg } from './types';

export interface NestEggProgress {
	current: number; // dollars saved toward the target
	percent: number; // 0–100+ (can exceed 100 if overfunded)
	complete: boolean;
	target: number;
	remaining: number;
	/** Days until deadline (negative if past). null when no deadline. */
	daysLeft: number | null;
	totalDays: number | null; // null when no deadline
	expectedPercent: number | null; // % we'd be at on a linear schedule
	pace: 'ahead' | 'on-track' | 'behind' | 'no-deadline' | 'complete' | 'overdue';
	projectedCompletion: string | null; // YYYY-MM-DD based on current contribution rate
}

function daysBetween(a: string, b: string): number {
	const da = new Date(`${a}T00:00:00Z`).getTime();
	const db = new Date(`${b}T00:00:00Z`).getTime();
	return Math.round((db - da) / 86400000);
}
function isoToday(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Resolve current saved-amount for a Nest Egg based on its tracking mode. */
export async function nestEggCurrent(egg: NestEgg): Promise<number> {
	if (egg.trackingMode === 'account') {
		if (egg.accountIds.length === 0) return 0;
		const accounts = await db.accounts.bulkGet(egg.accountIds);
		let total = 0;
		for (const a of accounts) {
			if (!a) continue;
			total += a.openingBalance;
		}
		await db.transactions.each((t) => {
			if (egg.accountIds.includes(t.accountId)) total += t.amount;
		});
		return Math.round((total - egg.baselineAmount) * 100) / 100;
	}
	if (egg.trackingMode === 'category') {
		if (egg.categoryId == null) return 0;
		let total = 0;
		await db.transactions.each((t) => {
			if (t.categoryId !== egg.categoryId) return;
			if (t.date < egg.startDate) return;
			// Contributions are typically expense-direction (money out of checking
			// into savings) — flip the sign so progress goes up.
			if (t.amount < 0) total += -t.amount;
			else total += t.amount;
		});
		return Math.round((total - egg.baselineAmount) * 100) / 100;
	}
	return 0;
}

/** Compute progress + pace given a current saved amount. Pure / synchronous. */
export function nestEggProgress(egg: NestEgg, current: number): NestEggProgress {
	const target = egg.targetAmount;
	const safeTarget = target > 0 ? target : 1;
	const percent = (current / safeTarget) * 100;
	const remaining = Math.max(0, target - current);
	const complete = current >= target;

	const today = isoToday();
	let daysLeft: number | null = null;
	let totalDays: number | null = null;
	let expectedPercent: number | null = null;
	let projectedCompletion: string | null = null;
	let pace: NestEggProgress['pace'] = 'no-deadline';

	if (egg.deadline) {
		daysLeft = daysBetween(today, egg.deadline);
		totalDays = daysBetween(egg.startDate, egg.deadline);
		const elapsed = totalDays - daysLeft;
		expectedPercent = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 100;

		if (complete) pace = 'complete';
		else if (daysLeft < 0) pace = 'overdue';
		else if (percent + 5 >= expectedPercent) pace = percent >= expectedPercent + 5 ? 'ahead' : 'on-track';
		else pace = 'behind';

		// Project completion at the current contribution rate since startDate
		const elapsedDays = daysBetween(egg.startDate, today);
		if (!complete && elapsedDays > 0 && current > egg.baselineAmount) {
			const dailyRate = current / elapsedDays;
			if (dailyRate > 0) {
				const daysToFinish = Math.ceil(remaining / dailyRate);
				const projected = new Date(`${today}T00:00:00Z`);
				projected.setUTCDate(projected.getUTCDate() + daysToFinish);
				projectedCompletion = projected.toISOString().slice(0, 10);
			}
		}
	} else if (complete) {
		pace = 'complete';
	}

	return {
		current,
		percent,
		complete,
		target,
		remaining,
		daysLeft,
		totalDays,
		expectedPercent,
		pace,
		projectedCompletion
	};
}
