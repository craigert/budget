import { base } from '$app/paths';
import { db } from './index';
import { seedIfEmpty } from './seed';
import { importCSV } from './csv';

async function tryFetchDefaultSpreadsheet(): Promise<string | null> {
	const csvUrl = `${base}/budget-demo.csv`;
	try {
		const r = await fetch(csvUrl);
		if (r.ok) {
			const t = await r.text();
			if (t.trim().length > 0) return t;
		}
	} catch {
		// ignore
	}

	const xlsxUrl = `${base}/budget-demo.xlsx`;
	try {
		const r = await fetch(xlsxUrl);
		if (r.ok) {
			const buf = await r.arrayBuffer();
			const XLSX = await import('xlsx');
			const wb = XLSX.read(buf, { type: 'array' });
			const sheetName = wb.SheetNames[0];
			if (sheetName) return XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
		}
	} catch {
		// ignore
	}
	return null;
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
