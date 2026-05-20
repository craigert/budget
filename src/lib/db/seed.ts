import { db } from './index';
import type { Category } from './types';

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
	// expense
	{ name: 'Groceries', kind: 'expense', icon: 'finance-ecommerce/shopping-cart', color: '#16a34a', archived: 0, sortOrder: 10 },
	{ name: 'Dining', kind: 'expense', icon: 'finance-ecommerce/receipt', color: '#f97316', archived: 0, sortOrder: 20 },
	{ name: 'Rent / Mortgage', kind: 'expense', icon: 'general/home', color: '#0ea5e9', archived: 0, sortOrder: 30 },
	{ name: 'Utilities', kind: 'expense', icon: 'media-devices/lightbulb-01', color: '#eab308', archived: 0, sortOrder: 40 },
	{ name: 'Internet / Phone', kind: 'expense', icon: 'media-devices/wifi', color: '#06b6d4', archived: 0, sortOrder: 50 },
	{ name: 'Transport', kind: 'expense', icon: 'maps-travel/car', color: '#a855f7', archived: 0, sortOrder: 60 },
	{ name: 'Gas / Fuel', kind: 'expense', icon: 'maps-travel/truck', color: '#ef4444', archived: 0, sortOrder: 70 },
	{ name: 'Subscriptions', kind: 'expense', icon: 'arrows/refresh-cw-01', color: '#ec4899', archived: 0, sortOrder: 80 },
	{ name: 'Entertainment', kind: 'expense', icon: 'media-devices/tv', color: '#8b5cf6', archived: 0, sortOrder: 90 },
	{ name: 'Shopping', kind: 'expense', icon: 'finance-ecommerce/shopping-bag-01', color: '#f43f5e', archived: 0, sortOrder: 100 },
	{ name: 'Health', kind: 'expense', icon: 'general/heart', color: '#10b981', archived: 0, sortOrder: 110 },
	{ name: 'Travel', kind: 'expense', icon: 'maps-travel/plane', color: '#3b82f6', archived: 0, sortOrder: 120 },
	{ name: 'Insurance', kind: 'expense', icon: 'security/shield-tick', color: '#64748b', archived: 0, sortOrder: 130 },
	{ name: 'Fees', kind: 'expense', icon: 'finance-ecommerce/credit-card', color: '#737373', archived: 0, sortOrder: 140 },
	{ name: 'Other expense', kind: 'expense', icon: 'finance-ecommerce/coins-01', color: '#94a3b8', archived: 0, sortOrder: 999 },
	// income
	{ name: 'Salary', kind: 'income', icon: 'education/briefcase-01', color: '#22c55e', archived: 0, sortOrder: 10 },
	{ name: 'Interest', kind: 'income', icon: 'finance-ecommerce/piggy-bank', color: '#14b8a6', archived: 0, sortOrder: 20 },
	{ name: 'Refunds', kind: 'income', icon: 'arrows/reverse-left', color: '#84cc16', archived: 0, sortOrder: 30 },
	{ name: 'Other income', kind: 'income', icon: 'finance-ecommerce/coins-stacked-01', color: '#a3e635', archived: 0, sortOrder: 999 }
];

export async function seedIfEmpty() {
	const seeded = await db.settings.get('seeded');
	if (seeded?.value) return;

	await db.transaction('rw', db.categories, db.settings, async () => {
		const count = await db.categories.count();
		if (count === 0) {
			await db.categories.bulkAdd(DEFAULT_CATEGORIES as Category[]);
		}
		await db.settings.put({ key: 'seeded', value: true });
		await db.settings.put({ key: 'currency', value: 'USD' });
		await db.settings.put({ key: 'theme', value: 'system' });
	});
}
