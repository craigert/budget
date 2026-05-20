import Dexie, { type Table } from 'dexie';
import type { Account, Category, Transaction, Budget, Setting } from './types';

export class BudgetDB extends Dexie {
	accounts!: Table<Account, number>;
	categories!: Table<Category, number>;
	transactions!: Table<Transaction, number>;
	budgets!: Table<Budget, number>;
	settings!: Table<Setting, string>;

	constructor() {
		super('budget');
		this.version(1).stores({
			accounts: '++id, name, type, archived, createdAt',
			categories: '++id, name, kind, archived, sortOrder',
			transactions: '++id, date, accountId, categoryId, cleared, createdAt, [accountId+date], [categoryId+date]',
			budgets: '++id, &[categoryId+month], categoryId, month',
			settings: '&key'
		});
	}
}

export const db = new BudgetDB();
