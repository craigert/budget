import { db } from './index';
import type { Account, Business, Category, Transaction, Budget, Setting } from './types';

export interface BackupFile {
	app: 'budget';
	version: 1 | 2;
	exportedAt: string;
	accounts: Account[];
	categories: Category[];
	transactions: Transaction[];
	budgets: Budget[];
	settings: Setting[];
	businesses?: Business[];
}

export async function exportJSON(): Promise<BackupFile> {
	const [accounts, categories, transactions, budgets, settings, businesses] = await Promise.all([
		db.accounts.toArray(),
		db.categories.toArray(),
		db.transactions.toArray(),
		db.budgets.toArray(),
		db.settings.toArray(),
		db.businesses.toArray()
	]);
	return {
		app: 'budget',
		version: 2,
		exportedAt: new Date().toISOString(),
		accounts,
		categories,
		transactions,
		budgets,
		settings,
		businesses
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
	if (file.app !== 'budget' || (file.version !== 1 && file.version !== 2)) {
		throw new Error('Not a valid budget backup file.');
	}
	await db.transaction(
		'rw',
		[db.accounts, db.categories, db.transactions, db.budgets, db.settings, db.businesses],
		async () => {
			if (mode === 'replace') {
				await Promise.all([
					db.accounts.clear(),
					db.categories.clear(),
					db.transactions.clear(),
					db.budgets.clear(),
					db.settings.clear(),
					db.businesses.clear()
				]);
			}
			if (file.accounts.length) await db.accounts.bulkPut(file.accounts);
			if (file.categories.length) await db.categories.bulkPut(file.categories);
			if (file.transactions.length) await db.transactions.bulkPut(file.transactions);
			if (file.budgets.length) await db.budgets.bulkPut(file.budgets);
			if (file.settings.length) await db.settings.bulkPut(file.settings);
			if (file.businesses?.length) await db.businesses.bulkPut(file.businesses);
		}
	);
}

export async function wipeAll() {
	await db.transaction(
		'rw',
		[db.accounts, db.categories, db.transactions, db.budgets, db.settings, db.businesses],
		async () => {
			await Promise.all([
				db.accounts.clear(),
				db.categories.clear(),
				db.transactions.clear(),
				db.budgets.clear(),
				db.settings.clear(),
				db.businesses.clear()
			]);
		}
	);
}
