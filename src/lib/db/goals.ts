import { db } from './index';
import type { Goal } from './types';

export interface GoalProgress {
	current: number;
	percent: number;
	complete: boolean;
	target: number;
	remaining: number;
	daysLeft: number | null;
	totalDays: number | null;
	expectedPercent: number | null;
	pace: 'ahead' | 'on-track' | 'behind' | 'no-deadline' | 'complete' | 'overdue';
	projectedCompletion: string | null;
}

function daysBetween(a: string, b: string): number {
	const da = new Date(`${a}T00:00:00Z`).getTime();
	const db = new Date(`${b}T00:00:00Z`).getTime();
	return Math.round((db - da) / 86400000);
}
function isoToday(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Resolve current saved-amount for a Goal based on its tracking mode. */
export async function goalCurrent(goal: Goal): Promise<number> {
	if (goal.trackingMode === 'account') {
		if (goal.accountIds.length === 0) return 0;
		const accounts = await db.accounts.bulkGet(goal.accountIds);
		let total = 0;
		for (const a of accounts) {
			if (!a) continue;
			total += a.openingBalance;
		}
		await db.transactions.each((t) => {
			if (goal.accountIds.includes(t.accountId)) total += t.amount;
		});
		return Math.round((total - goal.baselineAmount) * 100) / 100;
	}
	if (goal.trackingMode === 'category') {
		if (goal.categoryId == null) return 0;
		let total = 0;
		await db.transactions.each((t) => {
			if (t.categoryId !== goal.categoryId) return;
			if (t.date < goal.startDate) return;
			// Contributions are typically expense-direction (money out of checking
			// into savings) — flip the sign so progress goes up.
			if (t.amount < 0) total += -t.amount;
			else total += t.amount;
		});
		return Math.round((total - goal.baselineAmount) * 100) / 100;
	}
	return 0;
}

/** Compute progress + pace given a current saved amount. Pure / synchronous. */
export function goalProgress(goal: Goal, current: number): GoalProgress {
	const target = goal.targetAmount;
	const safeTarget = target > 0 ? target : 1;
	const percent = (current / safeTarget) * 100;
	const remaining = Math.max(0, target - current);
	const complete = current >= target;

	const today = isoToday();
	let daysLeft: number | null = null;
	let totalDays: number | null = null;
	let expectedPercent: number | null = null;
	let projectedCompletion: string | null = null;
	let pace: GoalProgress['pace'] = 'no-deadline';

	if (goal.deadline) {
		daysLeft = daysBetween(today, goal.deadline);
		totalDays = daysBetween(goal.startDate, goal.deadline);
		const elapsed = totalDays - daysLeft;
		expectedPercent = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 100;

		if (complete) pace = 'complete';
		else if (daysLeft < 0) pace = 'overdue';
		else if (percent + 5 >= expectedPercent) pace = percent >= expectedPercent + 5 ? 'ahead' : 'on-track';
		else pace = 'behind';

		const elapsedDays = daysBetween(goal.startDate, today);
		if (!complete && elapsedDays > 0 && current > goal.baselineAmount) {
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
