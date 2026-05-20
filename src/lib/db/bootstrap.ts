import { base } from '$app/paths';
import { db } from './index';
import { seedIfEmpty } from './seed';
import { importCSV } from './csv';
import type { Category } from './types';

/**
 * Tax-relevant categories added in v3-era. Make sure they exist for users
 * whose DB was seeded before they were introduced.
 */
const ENSURE_CATEGORIES: Omit<Category, 'id'>[] = [
	{ name: 'Mortgage Interest', kind: 'expense', icon: 'general/home', color: '#0369a1', archived: 0, sortOrder: 160 },
	{ name: 'Charity', kind: 'expense', icon: 'general/heart-hand', color: '#dc2626', archived: 0, sortOrder: 170 },
	{ name: 'Taxes Paid', kind: 'expense', icon: 'finance-ecommerce/scales', color: '#475569', archived: 0, sortOrder: 180 }
];

async function ensureDefaultCategories() {
	const existing = await db.categories.toArray();
	const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
	const toAdd = ENSURE_CATEGORIES.filter((c) => !existingNames.has(c.name.toLowerCase()));
	if (toAdd.length) {
		await db.categories.bulkAdd(toAdd as Category[]);
	}
}

async function tryFetchSpreadsheet(url: string, kind: 'csv' | 'xlsx'): Promise<string | null> {
	try {
		const r = await fetch(url);
		if (!r.ok) return null;
		if (kind === 'csv') {
			const t = await r.text();
			return t.trim().length > 0 ? t : null;
		}
		const buf = await r.arrayBuffer();
		if (buf.byteLength === 0) return null;
		const XLSX = await import('xlsx');
		const wb = XLSX.read(buf, { type: 'array' });
		const sheetName = wb.SheetNames[0];
		return sheetName ? XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]) : null;
	} catch {
		return null;
	}
}

async function tryFetchDefaultSpreadsheet(): Promise<string | null> {
	// Priority: default-budget.xlsx → default-budget.xls → default-budget.csv
	return (
		(await tryFetchSpreadsheet(`${base}/default-budget.xlsx`, 'xlsx')) ??
		(await tryFetchSpreadsheet(`${base}/default-budget.xls`, 'xlsx')) ??
		(await tryFetchSpreadsheet(`${base}/default-budget.csv`, 'csv'))
	);
}

/**
 * Runs on every app load. Idempotent.
 * - If already seeded, no-op.
 * - On a fresh DB: seed default categories, then try to auto-import
 *   /budget-demo.csv (or .xlsx). On miss, you still have default categories.
 */
export async function bootstrap() {
	const before = await db.settings.get('seeded');
	if (before?.value) {
		// Already seeded — still backfill any new default categories that
		// have shipped since the user first set up the app.
		await ensureDefaultCategories();
		return { autoImported: false, freshSeed: false };
	}

	await seedIfEmpty();

	const csvText = await tryFetchDefaultSpreadsheet();
	if (csvText) {
		try {
			await importCSV(csvText, 'append');
			return { autoImported: true, freshSeed: true };
		} catch (e) {
			console.warn('Demo auto-import failed:', e);
		}
	}
	return { autoImported: false, freshSeed: true };
}
