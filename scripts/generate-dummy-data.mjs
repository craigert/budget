// Generate a year of realistic dummy data.
// Output: data/budget-2025-dummy.csv (Google-Sheets-friendly)
//         data/budget-2025-dummy.json (BudgetSparrow Settings → Import format)
// Run: node scripts/generate-dummy-data.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'data');

// ---------- deterministic RNG so re-runs produce same output ----------
let _seed = 0x9e3779b9;
const rand = () => {
	_seed = (_seed * 1664525 + 1013904223) | 0;
	return ((_seed >>> 0) % 100000) / 100000;
};
const between = (lo, hi) => lo + rand() * (hi - lo);
const intBetween = (lo, hi) => Math.floor(between(lo, hi + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const dollars = (n) => Math.round(n * 100) / 100;
const chance = (p) => rand() < p;

// ---------- accounts ----------
const ACCOUNTS = [
	{ id: 1, name: 'Checking', type: 'checking', openingBalance: 2500, currency: 'USD', archived: 0, createdAt: Date.parse('2025-01-01') },
	{ id: 2, name: 'Savings', type: 'savings', openingBalance: 8000, currency: 'USD', archived: 0, createdAt: Date.parse('2025-01-01') },
	{ id: 3, name: 'Credit Card', type: 'credit', openingBalance: 0, currency: 'USD', archived: 0, createdAt: Date.parse('2025-01-01') },
	{ id: 4, name: 'Business Checking', type: 'checking', openingBalance: 4500, currency: 'USD', archived: 0, createdAt: Date.parse('2025-01-01') }
];

// ---------- categories (matches seed.ts + Business expenses) ----------
const CATEGORIES = [
	{ id: 1, name: 'Groceries', kind: 'expense', icon: 'finance-ecommerce/shopping-cart', color: '#16a34a', archived: 0, sortOrder: 10 },
	{ id: 2, name: 'Dining', kind: 'expense', icon: 'finance-ecommerce/receipt', color: '#f97316', archived: 0, sortOrder: 20 },
	{ id: 3, name: 'Rent / Mortgage', kind: 'expense', icon: 'general/home', color: '#0ea5e9', archived: 0, sortOrder: 30 },
	{ id: 4, name: 'Utilities', kind: 'expense', icon: 'media-devices/lightbulb-01', color: '#eab308', archived: 0, sortOrder: 40 },
	{ id: 5, name: 'Internet / Phone', kind: 'expense', icon: 'media-devices/wifi', color: '#06b6d4', archived: 0, sortOrder: 50 },
	{ id: 6, name: 'Transport', kind: 'expense', icon: 'maps-travel/car', color: '#a855f7', archived: 0, sortOrder: 60 },
	{ id: 7, name: 'Gas / Fuel', kind: 'expense', icon: 'maps-travel/truck', color: '#ef4444', archived: 0, sortOrder: 70 },
	{ id: 8, name: 'Subscriptions', kind: 'expense', icon: 'arrows/refresh-cw-01', color: '#ec4899', archived: 0, sortOrder: 80 },
	{ id: 9, name: 'Entertainment', kind: 'expense', icon: 'media-devices/tv', color: '#8b5cf6', archived: 0, sortOrder: 90 },
	{ id: 10, name: 'Shopping', kind: 'expense', icon: 'finance-ecommerce/shopping-bag-01', color: '#f43f5e', archived: 0, sortOrder: 100 },
	{ id: 11, name: 'Health', kind: 'expense', icon: 'general/heart', color: '#10b981', archived: 0, sortOrder: 110 },
	{ id: 12, name: 'Travel', kind: 'expense', icon: 'maps-travel/plane', color: '#3b82f6', archived: 0, sortOrder: 120 },
	{ id: 13, name: 'Insurance', kind: 'expense', icon: 'security/shield-tick', color: '#64748b', archived: 0, sortOrder: 130 },
	{ id: 14, name: 'Fees', kind: 'expense', icon: 'finance-ecommerce/credit-card', color: '#737373', archived: 0, sortOrder: 140 },
	{ id: 15, name: 'Business expenses', kind: 'expense', icon: 'education/briefcase-02', color: '#0f766e', archived: 0, sortOrder: 150 },
	{ id: 16, name: 'Other expense', kind: 'expense', icon: 'finance-ecommerce/coins-01', color: '#94a3b8', archived: 0, sortOrder: 999 },
	{ id: 17, name: 'Salary', kind: 'income', icon: 'education/briefcase-01', color: '#22c55e', archived: 0, sortOrder: 10 },
	{ id: 18, name: 'Interest', kind: 'income', icon: 'finance-ecommerce/piggy-bank', color: '#14b8a6', archived: 0, sortOrder: 20 },
	{ id: 19, name: 'Refunds', kind: 'income', icon: 'arrows/reverse-left', color: '#84cc16', archived: 0, sortOrder: 30 },
	{ id: 20, name: 'Other income', kind: 'income', icon: 'finance-ecommerce/coins-stacked-01', color: '#a3e635', archived: 0, sortOrder: 999 }
];
const catId = (name) => CATEGORIES.find((c) => c.name === name).id;
const acctId = (name) => ACCOUNTS.find((a) => a.name === name).id;

// ---------- helpers ----------
function isoDate(year, month, day) {
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function lastDayOfMonth(year, month) {
	return new Date(year, month, 0).getDate();
}
function dayOfWeek(year, month, day) {
	return new Date(year, month - 1, day).getDay(); // 0=Sun, 5=Fri
}
function* eachDay(year) {
	for (let m = 1; m <= 12; m++) {
		const last = lastDayOfMonth(year, m);
		for (let d = 1; d <= last; d++) yield { y: year, m, d };
	}
}

// ---------- payee pools ----------
const GROCERY_PAYEES = ["Trader Joe's", 'Safeway', 'Whole Foods', 'Costco', 'Aldi', 'Target Grocery'];
const DINING_PAYEES = ['Chipotle', "Peet's Coffee", "Joe's Diner", 'Sushi Bar', 'Thai Garden', 'Taco Bell', "Domino's", 'Local Pub', 'Starbucks', 'Subway'];
const GAS_PAYEES = ['Shell', 'Chevron', 'Costco Gas', '76 Station', 'Arco'];
const SHOPPING_PAYEES = ['Amazon', 'Target', 'Apple Store', 'Best Buy', 'IKEA', 'Nordstrom', "Macy's", 'Nike', 'REI'];
const HEALTH_PAYEES = ['CVS Pharmacy', 'Walgreens', 'Dr. Patel Clinic', 'Vision Center', 'Dental Care Plus'];
const ENTERTAINMENT_PAYEES = ['AMC Theater', 'Steam Games', 'Concert Tix', 'Bowling Alley', 'Mini Golf'];
const TRAVEL_PAYEES = ['United Airlines', 'Marriott', 'Airbnb', 'Hertz Car Rental', 'Delta Airlines', 'Hyatt'];
const BUSINESS_PAYEES = ['Adobe Subscription', 'GitHub Pro', 'AWS', 'Office Depot', 'Notion', 'Zoom', 'Figma', 'LinkedIn Premium', 'Domain Renewal'];

const transactions = [];
let txId = 1;
function add(date, accountId, categoryId, amount, payee, notes = '', cleared = 1) {
	transactions.push({
		id: txId++,
		date,
		accountId,
		categoryId,
		amount: dollars(amount),
		payee,
		notes,
		cleared,
		createdAt: Date.parse(date)
	});
}

const YEAR = 2025;

// ---------- monthly recurring (bills) ----------
for (let m = 1; m <= 12; m++) {
	// Rent — 1st of month, slight variance for late fees skipped
	add(isoDate(YEAR, m, 1), acctId('Checking'), catId('Rent / Mortgage'), -1800, 'Greystar Properties', 'Monthly rent');

	// Electricity — around the 5th
	add(isoDate(YEAR, m, 5), acctId('Checking'), catId('Utilities'), -(80 + rand() * 60), 'PG&E', 'Electricity & gas');

	// Internet — 3rd
	add(isoDate(YEAR, m, 3), acctId('Checking'), catId('Internet / Phone'), -65, 'Comcast', 'Internet');

	// Phone — 10th
	add(isoDate(YEAR, m, 10), acctId('Checking'), catId('Internet / Phone'), -52, 'T-Mobile', 'Cell phone');

	// Streaming subscriptions
	add(isoDate(YEAR, m, 15), acctId('Credit Card'), catId('Subscriptions'), -15.99, 'Netflix');
	add(isoDate(YEAR, m, 8), acctId('Credit Card'), catId('Subscriptions'), -10.99, 'Spotify');
	if (m % 3 === 0) add(isoDate(YEAR, m, 20), acctId('Credit Card'), catId('Subscriptions'), -9.99, 'iCloud Storage');

	// Gym
	add(isoDate(YEAR, m, 1), acctId('Checking'), catId('Health'), -42, 'Fitness SF', 'Gym membership');

	// Car insurance (monthly)
	add(isoDate(YEAR, m, 20), acctId('Checking'), catId('Insurance'), -132, 'Geico', 'Auto insurance');

	// Health insurance (out-of-pocket, monthly)
	add(isoDate(YEAR, m, 1), acctId('Checking'), catId('Insurance'), -285, 'Blue Cross', 'Health insurance');

	// Business: software subscriptions
	add(isoDate(YEAR, m, 7), acctId('Business Checking'), catId('Business expenses'), -54.99, 'Adobe Creative Cloud');
	add(isoDate(YEAR, m, 12), acctId('Business Checking'), catId('Business expenses'), -21, 'GitHub Pro');
	add(isoDate(YEAR, m, 18), acctId('Business Checking'), catId('Business expenses'), -10, 'Notion');
	add(isoDate(YEAR, m, 25), acctId('Business Checking'), catId('Business expenses'), -29, 'Figma');

	// Credit card minimum / payoff (skip — treated as transfer not a real expense)
}

// ---------- bi-weekly paycheck (every other Friday) ----------
// Find first Friday of the year then step by 14 days
{
	let cursor = new Date(YEAR, 0, 1);
	while (cursor.getDay() !== 5) cursor.setDate(cursor.getDate() + 1);
	while (cursor.getFullYear() === YEAR) {
		const date = isoDate(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
		add(date, acctId('Checking'), catId('Salary'), 3250 + intBetween(-50, 80), 'Acme Corp', 'Bi-weekly paycheck');
		cursor.setDate(cursor.getDate() + 14);
	}
}

// Quarterly business income (consulting / freelance)
for (const m of [2, 5, 8, 11]) {
	add(isoDate(YEAR, m, 15), acctId('Business Checking'), catId('Other income'), intBetween(1500, 3500), 'Freelance Client', 'Project invoice');
}

// Annual interest payouts (Q1, Q2, Q3, Q4)
for (const m of [3, 6, 9, 12]) {
	add(isoDate(YEAR, m, 28), acctId('Savings'), catId('Interest'), dollars(12 + rand() * 18), 'High Yield Savings', 'Quarterly interest');
}

// ---------- weekly: groceries & gas ----------
for (const { y, m, d } of eachDay(YEAR)) {
	const dow = dayOfWeek(y, m, d);
	// Groceries — Sundays mostly, sometimes Wednesdays
	if (dow === 0 || (dow === 3 && chance(0.35))) {
		add(isoDate(y, m, d), acctId('Credit Card'), catId('Groceries'), -(45 + rand() * 95), pick(GROCERY_PAYEES));
	}
	// Gas — roughly weekly
	if (dow === 5 && chance(0.7)) {
		add(isoDate(y, m, d), acctId('Credit Card'), catId('Gas / Fuel'), -(38 + rand() * 22), pick(GAS_PAYEES));
	}
}

// ---------- daily-ish: dining ----------
for (const { y, m, d } of eachDay(YEAR)) {
	const meals = intBetween(0, 1) + (chance(0.35) ? 1 : 0);
	for (let i = 0; i < meals; i++) {
		const amt = chance(0.6) ? between(8, 22) : between(22, 65);
		add(isoDate(y, m, d), acctId('Credit Card'), catId('Dining'), -amt, pick(DINING_PAYEES));
	}
}

// ---------- monthly-ish: shopping, entertainment, health, transport ----------
for (let m = 1; m <= 12; m++) {
	// Shopping 1-4 times per month
	const shops = intBetween(1, 4);
	for (let i = 0; i < shops; i++) {
		const d = intBetween(2, lastDayOfMonth(YEAR, m) - 1);
		add(isoDate(YEAR, m, d), acctId('Credit Card'), catId('Shopping'), -between(25, 180), pick(SHOPPING_PAYEES));
	}
	// Entertainment 0-3 per month
	const ents = intBetween(0, 3);
	for (let i = 0; i < ents; i++) {
		const d = intBetween(2, lastDayOfMonth(YEAR, m) - 1);
		add(isoDate(YEAR, m, d), acctId('Credit Card'), catId('Entertainment'), -between(12, 75), pick(ENTERTAINMENT_PAYEES));
	}
	// Health — 1-2 per month (pharmacy, copay)
	const hits = intBetween(0, 2);
	for (let i = 0; i < hits; i++) {
		const d = intBetween(2, lastDayOfMonth(YEAR, m) - 1);
		const amt = chance(0.6) ? between(8, 35) : between(80, 220);
		add(isoDate(YEAR, m, d), acctId('Credit Card'), catId('Health'), -amt, pick(HEALTH_PAYEES));
	}
	// Transport (rideshare/transit) — 2-6/mo
	const rides = intBetween(2, 6);
	for (let i = 0; i < rides; i++) {
		const d = intBetween(2, lastDayOfMonth(YEAR, m) - 1);
		add(isoDate(YEAR, m, d), acctId('Credit Card'), catId('Transport'), -between(8, 40), chance(0.5) ? 'Uber' : 'Lyft');
	}
	// Business misc — 1-2/mo (office supplies, hardware)
	if (chance(0.7)) {
		const d = intBetween(2, lastDayOfMonth(YEAR, m) - 1);
		add(isoDate(YEAR, m, d), acctId('Business Checking'), catId('Business expenses'), -between(45, 300), pick(BUSINESS_PAYEES));
	}
}

// ---------- occasional: travel, refunds ----------
// 2-3 trips
const tripMonths = [4, 7, 11];
for (const tm of tripMonths) {
	const start = intBetween(5, 20);
	add(isoDate(YEAR, tm, start), acctId('Credit Card'), catId('Travel'), -between(280, 620), pick(TRAVEL_PAYEES), 'Flights');
	add(isoDate(YEAR, tm, start + 1), acctId('Credit Card'), catId('Travel'), -between(180, 480), pick(TRAVEL_PAYEES), 'Hotel');
	add(isoDate(YEAR, tm, start + 2), acctId('Credit Card'), catId('Dining'), -between(40, 110), 'Vacation Dining');
}

// A few refunds spread through the year
for (let i = 0; i < 4; i++) {
	const m = intBetween(1, 12);
	const d = intBetween(1, lastDayOfMonth(YEAR, m));
	add(isoDate(YEAR, m, d), acctId('Credit Card'), catId('Refunds'), between(15, 95), pick(SHOPPING_PAYEES), 'Return');
}

// Annual taxes (April)
add(isoDate(YEAR, 4, 15), acctId('Checking'), catId('Fees'), -between(800, 2200), 'IRS', 'Federal income tax');
add(isoDate(YEAR, 4, 15), acctId('Checking'), catId('Fees'), -between(150, 500), 'State Tax Board', 'State income tax');

// Holiday spending bump in December
for (let i = 0; i < 8; i++) {
	const d = intBetween(1, 24);
	add(isoDate(YEAR, 12, d), acctId('Credit Card'), catId('Shopping'), -between(30, 220), pick(SHOPPING_PAYEES), 'Holiday gifts');
}

// ---------- budgets (typical monthly budget per category) ----------
const MONTHLY_BUDGET = {
	'Groceries': 600,
	'Dining': 400,
	'Rent / Mortgage': 1800,
	'Utilities': 130,
	'Internet / Phone': 120,
	'Transport': 120,
	'Gas / Fuel': 200,
	'Subscriptions': 50,
	'Entertainment': 100,
	'Shopping': 300,
	'Health': 200,
	'Travel': 250,
	'Insurance': 420,
	'Fees': 50,
	'Business expenses': 250,
	'Other expense': 50
};

const budgets = [];
let bId = 1;
for (let m = 1; m <= 12; m++) {
	const month = `${YEAR}-${String(m).padStart(2, '0')}`;
	for (const [name, amt] of Object.entries(MONTHLY_BUDGET)) {
		budgets.push({ id: bId++, categoryId: catId(name), month, amount: amt });
	}
}

// ---------- write outputs ----------
await mkdir(outDir, { recursive: true });

// sort transactions by date for cleaner CSV
transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
// re-id after sort (Dexie ids are arbitrary anyway)
transactions.forEach((t, i) => (t.id = i + 1));

// CSV: Date, Account, Type, Category, Payee, Expense, Income, Notes
const csvRows = ['Date,Account,Type,Category,Payee,Expense,Income,Notes'];
for (const t of transactions) {
	const acct = ACCOUNTS.find((a) => a.id === t.accountId).name;
	const cat = CATEGORIES.find((c) => c.id === t.categoryId);
	const isExpense = t.amount < 0;
	const expense = isExpense ? (-t.amount).toFixed(2) : '';
	const income = !isExpense ? t.amount.toFixed(2) : '';
	const escape = (s) => (String(s).includes(',') || String(s).includes('"') ? `"${String(s).replace(/"/g, '""')}"` : String(s));
	csvRows.push([
		t.date,
		escape(acct),
		isExpense ? 'Expense' : 'Income',
		escape(cat.name),
		escape(t.payee),
		expense,
		income,
		escape(t.notes ?? '')
	].join(','));
}
const csvPath = join(outDir, 'budget-2025-dummy.csv');
await writeFile(csvPath, csvRows.join('\n'), 'utf8');

// JSON backup format (BudgetSparrow Settings → Import)
const backup = {
	app: 'budget',
	version: 1,
	exportedAt: new Date().toISOString(),
	accounts: ACCOUNTS,
	categories: CATEGORIES,
	transactions,
	budgets,
	settings: [
		{ key: 'seeded', value: true },
		{ key: 'currency', value: 'USD' },
		{ key: 'theme', value: 'system' }
	]
};
const jsonPath = join(outDir, 'budget-2025-dummy.json');
await writeFile(jsonPath, JSON.stringify(backup, null, 2), 'utf8');

// ---------- summary ----------
const totalExpense = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
const totalIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
console.log(`Wrote ${transactions.length} transactions for ${YEAR}.`);
console.log(`  Income:  $${totalIncome.toFixed(2)}`);
console.log(`  Expense: $${totalExpense.toFixed(2)}`);
console.log(`  Net:     $${(totalIncome + totalExpense).toFixed(2)}`);
console.log('Files:');
console.log(`  ${csvPath}`);
console.log(`  ${jsonPath}`);
