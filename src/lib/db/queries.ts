import { db } from './index';
import type { Account, Transaction } from './types';

export async function accountBalance(accountId: number): Promise<number> {
	const account = await db.accounts.get(accountId);
	if (!account) return 0;
	let sum = 0;
	await db.transactions
		.where('accountId')
		.equals(accountId)
		.each((t) => {
			sum += t.amount;
		});
	return account.openingBalance + sum;
}

export async function accountBalances(): Promise<Map<number, number>> {
	const balances = new Map<number, number>();
	const accounts = await db.accounts.toArray();
	for (const a of accounts) balances.set(a.id!, a.openingBalance);

	await db.transactions.each((t) => {
		balances.set(t.accountId, (balances.get(t.accountId) ?? 0) + t.amount);
	});
	return balances;
}

export async function netWorth(): Promise<number> {
	const balances = await accountBalances();
	const accounts = await db.accounts.where('archived').equals(0).toArray();
	let total = 0;
	for (const a of accounts) total += balances.get(a.id!) ?? 0;
	return total;
}

export interface MonthSpending {
	categoryId: number | null;
	total: number; // positive number representing spend
}

export async function spendingByCategory(month: string): Promise<MonthSpending[]> {
	const map = new Map<number | null, number>();
	const start = `${month}-01`;
	const end = `${month}-32`;
	await db.transactions
		.where('date')
		.between(start, end, true, true)
		.each((t) => {
			if (t.amount < 0) {
				map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + -t.amount);
			}
		});
	return Array.from(map.entries())
		.map(([categoryId, total]) => ({ categoryId, total }))
		.sort((a, b) => b.total - a.total);
}

export async function incomingByCategory(month: string): Promise<MonthSpending[]> {
	const map = new Map<number | null, number>();
	const start = `${month}-01`;
	const end = `${month}-32`;
	await db.transactions
		.where('date')
		.between(start, end, true, true)
		.each((t) => {
			if (t.amount > 0) {
				map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
			}
		});
	return Array.from(map.entries())
		.map(([categoryId, total]) => ({ categoryId, total }))
		.sort((a, b) => b.total - a.total);
}

export async function incomeForMonth(month: string): Promise<number> {
	let total = 0;
	const start = `${month}-01`;
	const end = `${month}-32`;
	await db.transactions
		.where('date')
		.between(start, end, true, true)
		.each((t) => {
			if (t.amount > 0) total += t.amount;
		});
	return total;
}

export async function expensesForMonth(month: string): Promise<number> {
	let total = 0;
	const start = `${month}-01`;
	const end = `${month}-32`;
	await db.transactions
		.where('date')
		.between(start, end, true, true)
		.each((t) => {
			if (t.amount < 0) total += -t.amount;
		});
	return total;
}
