import { db } from './index';
import type { Account, AccountType, Category, CategoryKind, Transaction } from './types';

// ---------- minimal RFC-4180-ish CSV parser ----------
export function parseCSV(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let i = 0;
	let inQuotes = false;

	// Strip BOM if present
	if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
	// Normalize line endings
	text = text.replace(/\r\n?/g, '\n');

	while (i < text.length) {
		const ch = text[i];
		if (inQuotes) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
				} else {
					inQuotes = false;
					i++;
				}
			} else {
				field += ch;
				i++;
			}
		} else {
			if (ch === '"') {
				inQuotes = true;
				i++;
			} else if (ch === ',') {
				row.push(field);
				field = '';
				i++;
			} else if (ch === '\n') {
				row.push(field);
				rows.push(row);
				row = [];
				field = '';
				i++;
			} else {
				field += ch;
				i++;
			}
		}
	}
	// flush last field/row if not newline-terminated
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

// ---------- importer ----------
const ALIASES: Record<string, string> = {
	date: 'date',
	'transaction date': 'date',
	account: 'account',
	type: 'type',
	category: 'category',
	payee: 'payee',
	description: 'payee',
	merchant: 'payee',
	expense: 'expense',
	amount: 'amount',
	debit: 'expense',
	withdrawal: 'expense',
	income: 'income',
	credit: 'income',
	deposit: 'income',
	notes: 'notes',
	memo: 'notes'
};

function normalizeHeader(h: string) {
	return ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase();
}

function parseAmount(s: string): number {
	if (!s) return 0;
	const cleaned = s.replace(/[$,\s]/g, '');
	const n = parseFloat(cleaned);
	return Number.isFinite(n) ? n : 0;
}

function inferAccountType(name: string): AccountType {
	const n = name.toLowerCase();
	if (n.includes('credit') || n.includes('card')) return 'credit';
	if (n.includes('saving')) return 'savings';
	if (n.includes('cash')) return 'cash';
	if (n.includes('investment') || n.includes('brokerage')) return 'investment';
	if (n.includes('loan')) return 'loan';
	if (n.includes('check')) return 'checking';
	return 'other';
}

const DEFAULT_COLORS = ['#16a34a', '#f97316', '#0ea5e9', '#eab308', '#06b6d4', '#a855f7', '#ef4444', '#ec4899', '#8b5cf6', '#10b981', '#3b82f6', '#64748b', '#737373', '#94a3b8'];

function pickColor(name: string): string {
	let h = 0;
	for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
	return DEFAULT_COLORS[Math.abs(h) % DEFAULT_COLORS.length];
}

export interface CsvImportResult {
	transactionsAdded: number;
	accountsCreated: number;
	categoriesCreated: number;
	skipped: { row: number; reason: string }[];
}

export async function importCSV(
	text: string,
	mode: 'replace' | 'append'
): Promise<CsvImportResult> {
	const rows = parseCSV(text).filter((r) => r.length && r.some((c) => c.trim() !== ''));
	if (rows.length < 2) throw new Error('CSV has no data rows.');

	const headers = rows[0].map(normalizeHeader);
	const dataRows = rows.slice(1);

	const idx = (name: string) => headers.indexOf(name);
	const iDate = idx('date');
	const iAccount = idx('account');
	const iType = idx('type');
	const iCategory = idx('category');
	const iPayee = idx('payee');
	const iExpense = idx('expense');
	const iIncome = idx('income');
	const iAmount = idx('amount');
	const iNotes = idx('notes');

	if (iDate < 0) throw new Error('CSV must include a Date column.');
	if (iExpense < 0 && iIncome < 0 && iAmount < 0) {
		throw new Error('CSV must include Expense/Income or Amount columns.');
	}

	const result: CsvImportResult = {
		transactionsAdded: 0,
		accountsCreated: 0,
		categoriesCreated: 0,
		skipped: []
	};

	await db.transaction(
		'rw',
		[db.accounts, db.categories, db.transactions],
		async () => {
			if (mode === 'replace') {
				await db.transactions.clear();
			}

			// Build name → id lookups (case-insensitive)
			const accounts = await db.accounts.toArray();
			const acctMap = new Map<string, number>();
			for (const a of accounts) if (a.id) acctMap.set(a.name.toLowerCase(), a.id);

			const categories = await db.categories.toArray();
			const catMap = new Map<string, number>();
			for (const c of categories) if (c.id) catMap.set(c.name.toLowerCase(), c.id);

			async function ensureAccount(name: string): Promise<number> {
				const key = name.toLowerCase();
				if (acctMap.has(key)) return acctMap.get(key)!;
				const id = await db.accounts.add({
					name,
					type: inferAccountType(name),
					openingBalance: 0,
					currency: 'USD',
					archived: 0,
					createdAt: Date.now()
				} as Account);
				acctMap.set(key, id as number);
				result.accountsCreated++;
				return id as number;
			}

			async function ensureCategory(name: string, kind: CategoryKind): Promise<number> {
				const key = name.toLowerCase();
				if (catMap.has(key)) return catMap.get(key)!;
				const id = await db.categories.add({
					name,
					kind,
					icon: kind === 'expense' ? 'finance-ecommerce/coins-01' : 'finance-ecommerce/coins-stacked-01',
					color: pickColor(name),
					archived: 0,
					sortOrder: 500
				} as Category);
				catMap.set(key, id as number);
				result.categoriesCreated++;
				return id as number;
			}

			const inserts: Transaction[] = [];

			for (let r = 0; r < dataRows.length; r++) {
				const row = dataRows[r];
				const rowNum = r + 2; // 1-indexed + header

				const date = (row[iDate] ?? '').trim();
				if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
					result.skipped.push({ row: rowNum, reason: `Bad date "${date}"` });
					continue;
				}

				const acctName = (iAccount >= 0 ? row[iAccount] : 'Checking').trim() || 'Checking';

				let amount = 0;
				if (iAmount >= 0 && row[iAmount]?.trim()) {
					amount = parseAmount(row[iAmount]);
				} else {
					const exp = iExpense >= 0 ? parseAmount(row[iExpense]) : 0;
					const inc = iIncome >= 0 ? parseAmount(row[iIncome]) : 0;
					if (inc > 0) amount = inc;
					else if (exp > 0) amount = -exp;
				}
				if (amount === 0) {
					result.skipped.push({ row: rowNum, reason: 'Amount is zero or missing' });
					continue;
				}

				const typeRaw = iType >= 0 ? row[iType].trim().toLowerCase() : '';
				const kind: CategoryKind = typeRaw
					? typeRaw.startsWith('inc')
						? 'income'
						: 'expense'
					: amount > 0
						? 'income'
						: 'expense';
				// Re-sign amount based on kind if Type column was authoritative
				if (typeRaw && kind === 'expense' && amount > 0) amount = -amount;
				if (typeRaw && kind === 'income' && amount < 0) amount = -amount;

				const catName = iCategory >= 0 ? row[iCategory].trim() : '';
				const accountId = await ensureAccount(acctName);
				const categoryId = catName ? await ensureCategory(catName, kind) : null;

				inserts.push({
					date,
					accountId,
					categoryId,
					amount: Math.round(amount * 100) / 100,
					payee: iPayee >= 0 ? row[iPayee]?.trim() ?? '' : '',
					notes: iNotes >= 0 ? row[iNotes]?.trim() ?? '' : '',
					cleared: 1,
					createdAt: Date.parse(date) || Date.now()
				} as Transaction);
			}

			if (inserts.length) {
				await db.transactions.bulkAdd(inserts);
				result.transactionsAdded = inserts.length;
			}
		}
	);

	return result;
}
