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
			transactions:
				'++id, date, accountId, categoryId, cleared, createdAt, [accountId+date], [categoryId+date]',
			budgets: '++id, &[categoryId+month], categoryId, month',
			settings: '&key'
		});
		// v2: add isBusiness flag + index. Back-tag rows where the account name
		// starts with "Business" or the category is "Business expenses".
		this.version(2)
			.stores({
				transactions:
					'++id, date, accountId, categoryId, cleared, isBusiness, createdAt, [accountId+date], [categoryId+date]'
			})
			.upgrade(async (tx) => {
				const accounts = await tx.table('accounts').toArray();
				const categories = await tx.table('categories').toArray();
				const businessAccountIds = new Set(
					accounts.filter((a: Account) => a.name.toLowerCase().startsWith('business')).map((a: Account) => a.id)
				);
				const businessCategoryIds = new Set(
					categories
						.filter((c: Category) => c.name.toLowerCase() === 'business expenses')
						.map((c: Category) => c.id)
				);
				await tx.table('transactions').toCollection().modify((t: Transaction) => {
					t.isBusiness =
						businessAccountIds.has(t.accountId) ||
						(t.categoryId != null && businessCategoryIds.has(t.categoryId))
							? 1
							: 0;
				});
			});
	}
}

export const db = new BudgetDB();
