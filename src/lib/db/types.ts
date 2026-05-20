export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'loan' | 'other';

export type CategoryKind = 'income' | 'expense';

export interface Account {
	id?: number;
	name: string;
	type: AccountType;
	openingBalance: number;
	currency: string;
	archived: number; // 0 | 1 — Dexie can't index booleans
	createdAt: number;
}

export interface Category {
	id?: number;
	name: string;
	kind: CategoryKind;
	icon: string;
	color: string;
	archived: number;
	sortOrder: number;
}

export interface Transaction {
	id?: number;
	date: string; // YYYY-MM-DD
	accountId: number;
	categoryId: number | null;
	amount: number; // signed: expenses negative, income positive
	payee: string;
	notes: string;
	cleared: number; // 0 | 1
	isBusiness: number; // 0 | 1
	createdAt: number;
}

export interface Budget {
	id?: number;
	categoryId: number;
	month: string; // YYYY-MM
	amount: number;
}

export interface Setting {
	key: string;
	value: unknown;
}

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
	{ value: 'checking', label: 'Checking' },
	{ value: 'savings', label: 'Savings' },
	{ value: 'credit', label: 'Credit card' },
	{ value: 'cash', label: 'Cash' },
	{ value: 'investment', label: 'Investment' },
	{ value: 'loan', label: 'Loan' },
	{ value: 'other', label: 'Other' }
];
