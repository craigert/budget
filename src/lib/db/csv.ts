import * as XLSX from 'xlsx';
import { db } from './index';
import type { Account, AccountType, Category, CategoryKind, Transaction } from './types';

/**
 * Read a File (CSV or XLSX) and return CSV-shaped text suitable for importCSV.
 * - .csv / text/csv → read as text
 * - .xlsx / .xls → parse first sheet, convert to CSV text
 */
export async function readSpreadsheetAsCSV(file: File): Promise<string> {
	const lower = file.name.toLowerCase();
	const isXlsx = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm');
	if (!isXlsx) return await file.text();
	const buf = await file.arrayBuffer();
	const wb = XLSX.read(buf, { type: 'array' });
	const firstSheetName = wb.SheetNames[0];
	if (!firstSheetName) throw new Error('Workbook has no sheets.');
	const ws = wb.Sheets[firstSheetName];
	return XLSX.utils.sheet_to_csv(ws);
}

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

	// === Phase 1: read existing accounts/categories OUTSIDE any transaction ===
	const [existingAccounts, existingCategories] = await Promise.all([
		db.accounts.toArray(),
		db.categories.toArray()
	]);
	const acctMap = new Map<string, number>();
	for (const a of existingAccounts) if (a.id) acctMap.set(a.name.toLowerCase(), a.id);
	const catMap = new Map<string, number>();
	for (const c of existingCategories) if (c.id) catMap.set(c.name.toLowerCase(), c.id);

	// === Phase 2: pre-compute everything synchronously ===
	// First pass: figure out what new accounts/categories need to be created.
	const newAccounts: Account[] = [];
	const newAccountNamesLower = new Set<string>();
	const newCategories: Category[] = [];
	const newCategoryKeys = new Set<string>(); // `${kind}:${nameLower}`
	// Also pre-parse each row into a normalized form so we don't re-parse later.
	type ParsedRow = {
		date: string;
		amount: number; // signed
		acctName: string;
		catName: string;
		kind: CategoryKind;
		payee: string;
		notes: string;
	};
	const parsed: ParsedRow[] = [];

	for (let r = 0; r < dataRows.length; r++) {
		const row = dataRows[r];
		const rowNum = r + 2;

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
		if (typeRaw && kind === 'expense' && amount > 0) amount = -amount;
		if (typeRaw && kind === 'income' && amount < 0) amount = -amount;

		const catName = iCategory >= 0 ? row[iCategory].trim() : '';

		// Stage account for creation if new
		const acctLower = acctName.toLowerCase();
		if (!acctMap.has(acctLower) && !newAccountNamesLower.has(acctLower)) {
			newAccountNamesLower.add(acctLower);
			newAccounts.push({
				name: acctName,
				type: inferAccountType(acctName),
				openingBalance: 0,
				currency: 'USD',
				archived: 0,
				createdAt: Date.now()
			} as Account);
		}

		// Stage category for creation if new (key by kind+name)
		if (catName) {
			const catKey = `${kind}:${catName.toLowerCase()}`;
			if (!catMap.has(catName.toLowerCase()) && !newCategoryKeys.has(catKey)) {
				newCategoryKeys.add(catKey);
				newCategories.push({
					name: catName,
					kind,
					icon: kind === 'expense' ? 'finance-ecommerce/coins-01' : 'finance-ecommerce/coins-stacked-01',
					color: pickColor(catName),
					archived: 0,
					sortOrder: 500
				} as Category);
			}
		}

		parsed.push({
			date,
			amount: Math.round(amount * 100) / 100,
			acctName,
			catName,
			kind,
			payee: iPayee >= 0 ? row[iPayee]?.trim() ?? '' : '',
			notes: iNotes >= 0 ? row[iNotes]?.trim() ?? '' : ''
		});
	}

	// === Phase 3: one transaction, only a handful of bulk operations ===
	await db.transaction('rw', [db.accounts, db.categories, db.transactions], async () => {
		if (mode === 'replace') {
			await db.transactions.clear();
		}

		if (newAccounts.length) {
			const ids = (await db.accounts.bulkAdd(newAccounts, { allKeys: true })) as number[];
			newAccounts.forEach((a, i) => acctMap.set(a.name.toLowerCase(), ids[i]));
			result.accountsCreated = newAccounts.length;
		}

		if (newCategories.length) {
			const ids = (await db.categories.bulkAdd(newCategories, { allKeys: true })) as number[];
			newCategories.forEach((c, i) => catMap.set(c.name.toLowerCase(), ids[i]));
			result.categoriesCreated = newCategories.length;
		}

		// Build the transaction inserts now that maps are fully populated
		const inserts: Transaction[] = parsed.map((p) => ({
			date: p.date,
			accountId: acctMap.get(p.acctName.toLowerCase())!,
			categoryId: p.catName ? catMap.get(p.catName.toLowerCase()) ?? null : null,
			amount: p.amount,
			payee: p.payee,
			notes: p.notes,
			cleared: 1,
			createdAt: Date.parse(p.date) || Date.now()
		} as Transaction));

		if (inserts.length) {
			await db.transactions.bulkAdd(inserts);
			result.transactionsAdded = inserts.length;
		}
	});

	return result;
}
