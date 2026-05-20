import { base } from '$app/paths';
import { db } from './index';
import { seedIfEmpty } from './seed';
import { importCSV } from './csv';

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
	if (before?.value) return { autoImported: false, freshSeed: false };

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
