import { db } from './index';
import type { Account, Category, Transaction, Budget, Setting } from './types';

export interface BackupFile {
	app: 'budget';
	version: 1;
	exportedAt: string;
	accounts: Account[];
	categories: Category[];
	transactions: Transaction[];
	budgets: Budget[];
	settings: Setting[];
}

export async function exportJSON(): Promise<BackupFile> {
	const [accounts, categories, transactions, budgets, settings] = await Promise.all([
		db.accounts.toArray(),
		db.categories.toArray(),
		db.transactions.toArray(),
		db.budgets.toArray(),
		db.settings.toArray()
	]);
	return {
		app: 'budget',
		version: 1,
		exportedAt: new Date().toISOString(),
		accounts,
		categories,
		transactions,
		budgets,
		settings
	};
}

export async function downloadBackup() {
	const data = await exportJSON();
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `budget-${data.exportedAt.slice(0, 10)}.json`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

export async function importJSON(file: BackupFile, mode: 'replace' | 'merge') {
	if (file.app !== 'budget' || file.version !== 1) {
		throw new Error('Not a valid budget backup file.');
	}
	await db.transaction(
		'rw',
		[db.accounts, db.categories, db.transactions, db.budgets, db.settings],
		async () => {
			if (mode === 'replace') {
				await Promise.all([
					db.accounts.clear(),
					db.categories.clear(),
					db.transactions.clear(),
					db.budgets.clear(),
					db.settings.clear()
				]);
			}
			if (file.accounts.length) await db.accounts.bulkPut(file.accounts);
			if (file.categories.length) await db.categories.bulkPut(file.categories);
			if (file.transactions.length) await db.transactions.bulkPut(file.transactions);
			if (file.budgets.length) await db.budgets.bulkPut(file.budgets);
			if (file.settings.length) await db.settings.bulkPut(file.settings);
		}
	);
}

export async function wipeAll() {
	await db.transaction(
		'rw',
		[db.accounts, db.categories, db.transactions, db.budgets, db.settings],
		async () => {
			await Promise.all([
				db.accounts.clear(),
				db.categories.clear(),
				db.transactions.clear(),
				db.budgets.clear(),
				db.settings.clear()
			]);
		}
	);
}
