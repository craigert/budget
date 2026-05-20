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
	businessId: number | null;
	/** @deprecated kept for v2 backward read compatibility; written rows use businessId only */
	isBusiness?: number;
	createdAt: number;
}

export interface Business {
	id?: number;
	name: string;
	icon: string;
	color: string;
	archived: number;
	sortOrder: number;
	createdAt: number;
}

export type MileageKind = 'business' | 'medical' | 'charity';

export interface Mileage {
	id?: number;
	date: string; // YYYY-MM-DD
	miles: number;
	kind: MileageKind;
	purpose: string; // free text — destination / reason
	businessId: number | null; // optional link to a Business (for business miles)
	notes: string;
	createdAt: number;
}

/** IRS standard mileage rates by year. Keep current; update each January. */
export const MILEAGE_RATES: Record<number, Record<MileageKind, number>> = {
	2024: { business: 0.67, medical: 0.21, charity: 0.14 },
	2025: { business: 0.70, medical: 0.21, charity: 0.14 },
	2026: { business: 0.70, medical: 0.21, charity: 0.14 }
};

export function mileageRate(year: number, kind: MileageKind): number {
	return (MILEAGE_RATES[year] ?? MILEAGE_RATES[2026])[kind];
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
