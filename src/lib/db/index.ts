import Dexie, { type Table } from 'dexie';
import type {
	Account,
	Business,
	Category,
	Goal,
	GoalContribution,
	Mileage,
	Transaction,
	Budget,
	Setting
} from './types';

export class BudgetDB extends Dexie {
	accounts!: Table<Account, number>;
	categories!: Table<Category, number>;
	transactions!: Table<Transaction, number>;
	budgets!: Table<Budget, number>;
	settings!: Table<Setting, string>;
	businesses!: Table<Business, number>;
	mileage!: Table<Mileage, number>;
	/** Stored under the legacy `nestEggs` table name; user-facing term is "Goals". */
	nestEggs!: Table<Goal, number>;
	goalContributions!: Table<GoalContribution, number>;

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

		// v3: multi-business support. New businesses table; transactions get
		// businessId (FK). Migrate any isBusiness=1 rows into a "My Business"
		// entity so the existing tagged set carries over.
		this.version(3)
			.stores({
				businesses: '++id, name, archived, sortOrder, createdAt',
				transactions:
					'++id, date, accountId, categoryId, cleared, businessId, createdAt, [accountId+date], [categoryId+date]'
			})
			.upgrade(async (tx) => {
				// Full-table scan: we can't query by isBusiness anymore (it's been
				// dropped from the v3 index list), so peek at the raw stored fields.
				const allRows = await tx.table('transactions').toArray();
				const anyFlagged = allRows.some((t: Transaction) => t.isBusiness === 1);
				let id: number | null = null;
				if (anyFlagged) {
					id = (await tx.table('businesses').add({
						name: 'My Business',
						icon: 'education/briefcase-01',
						color: '#0f766e',
						archived: 0,
						sortOrder: 10,
						createdAt: Date.now()
					})) as number;
				}
				await tx.table('transactions').toCollection().modify((t: Transaction) => {
					t.businessId = t.isBusiness === 1 && id !== null ? id : null;
				});
			});

		// v4: mileage logs for tax dashboard
		this.version(4).stores({
			mileage: '++id, date, kind, businessId, createdAt'
		});

		// v5: nest eggs (savings goals)
		this.version(5).stores({
			nestEggs: '++id, name, archived, sortOrder, deadline, createdAt'
		});

		// v6: manual goal contributions
		this.version(6).stores({
			goalContributions: '++id, goalId, date, createdAt'
		});

		// v7: accounts can be assigned to a business (Personal = null)
		this.version(7)
			.stores({
				accounts: '++id, name, type, businessId, archived, createdAt'
			})
			.upgrade(async (tx) => {
				await tx.table('accounts').toCollection().modify((a: Account) => {
					if (a.businessId === undefined) a.businessId = null;
				});
			});
	}
}

export const db = new BudgetDB();
