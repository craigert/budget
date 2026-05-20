// Generate static/default-budget.xlsx (and .csv) from the same rolling
// 12-month dummy data the app autoloads on first launch.
// Run: node scripts/generate-default-budget.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const staticDir = join(__dirname, '..', 'static');

// --- deterministic RNG ---
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

// --- date range: 12 months ending today (2026-05-20) ---
const TODAY = new Date('2026-05-20T00:00:00Z');
const startDate = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - 12, 1));
const MONTHS = [];
{
	let cur = new Date(startDate);
	while (
		cur.getUTCFullYear() < TODAY.getUTCFullYear() ||
		(cur.getUTCFullYear() === TODAY.getUTCFullYear() && cur.getUTCMonth() + 1 <= TODAY.getUTCMonth() + 1)
	) {
		const y = cur.getUTCFullYear();
		const m = cur.getUTCMonth() + 1;
		const lastDay =
			y === TODAY.getUTCFullYear() && m === TODAY.getUTCMonth() + 1
				? TODAY.getUTCDate()
				: new Date(Date.UTC(y, m, 0)).getUTCDate();
		MONTHS.push({ y, m, lastDay });
		cur = new Date(Date.UTC(y, cur.getUTCMonth() + 1, 1));
	}
}
const iso = (y, m, d) =>
	`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dayOfWeek = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

const ACCOUNTS = ['Checking', 'Savings', 'Credit Card', 'Business Checking'];

const GROCERY_PAYEES = ["Trader Joe's", 'Safeway', 'Whole Foods', 'Costco', 'Aldi', 'Target Grocery'];
const DINING_PAYEES = ['Chipotle', "Peet's Coffee", "Joe's Diner", 'Sushi Bar', 'Thai Garden', 'Taco Bell', "Domino's", 'Local Pub', 'Starbucks', 'Subway'];
const GAS_PAYEES = ['Shell', 'Chevron', 'Costco Gas', '76 Station', 'Arco'];
const SHOPPING_PAYEES = ['Amazon', 'Target', 'Apple Store', 'Best Buy', 'IKEA', 'Nordstrom', "Macy's", 'Nike', 'REI'];
const HEALTH_PAYEES = ['CVS Pharmacy', 'Walgreens', 'Dr. Patel Clinic', 'Vision Center', 'Dental Care Plus'];
const ENTERTAINMENT_PAYEES = ['AMC Theater', 'Steam Games', 'Concert Tix', 'Bowling Alley', 'Mini Golf'];
const TRAVEL_PAYEES = ['United Airlines', 'Marriott', 'Airbnb', 'Hertz Car Rental', 'Delta Airlines', 'Hyatt'];
const BUSINESS_PAYEES = ['Adobe Subscription', 'GitHub Pro', 'AWS', 'Office Depot', 'Notion', 'Zoom', 'Figma', 'LinkedIn Premium', 'Domain Renewal'];

const transactions = [];
function isBusinessRow(account, category) {
	const a = account.toLowerCase();
	const c = category.toLowerCase();
	return a.startsWith('business') || c === 'business expenses';
}
function add(date, account, category, amount, payee, notes = '') {
	transactions.push({
		Date: date,
		Account: account,
		Business: isBusinessRow(account, category) ? 'My Business' : '',
		Type: amount < 0 ? 'Expense' : 'Income',
		Category: category,
		Payee: payee,
		Expense: amount < 0 ? dollars(-amount) : '',
		Income: amount > 0 ? dollars(amount) : '',
		Notes: notes
	});
}

// --- monthly recurring ---
for (const { y, m, lastDay } of MONTHS) {
	const safe = (d) => Math.min(d, lastDay);
	add(iso(y, m, safe(1)), 'Checking', 'Rent / Mortgage', -1800, 'Greystar Properties', 'Monthly rent');
	if (5 <= lastDay) add(iso(y, m, 5), 'Checking', 'Utilities', -(80 + rand() * 60), 'PG&E', 'Electricity & gas');
	if (3 <= lastDay) add(iso(y, m, 3), 'Checking', 'Internet / Phone', -65, 'Comcast', 'Internet');
	if (10 <= lastDay) add(iso(y, m, 10), 'Checking', 'Internet / Phone', -52, 'T-Mobile', 'Cell phone');
	if (15 <= lastDay) add(iso(y, m, 15), 'Credit Card', 'Subscriptions', -15.99, 'Netflix');
	if (8 <= lastDay) add(iso(y, m, 8), 'Credit Card', 'Subscriptions', -10.99, 'Spotify');
	if (m % 3 === 0 && 20 <= lastDay) add(iso(y, m, 20), 'Credit Card', 'Subscriptions', -9.99, 'iCloud Storage');
	add(iso(y, m, safe(1)), 'Checking', 'Health', -42, 'Fitness SF', 'Gym membership');
	if (20 <= lastDay) add(iso(y, m, 20), 'Checking', 'Insurance', -132, 'Geico', 'Auto insurance');
	add(iso(y, m, safe(1)), 'Checking', 'Insurance', -285, 'Blue Cross', 'Health insurance');
	if (7 <= lastDay) add(iso(y, m, 7), 'Business Checking', 'Business expenses', -54.99, 'Adobe Creative Cloud');
	if (12 <= lastDay) add(iso(y, m, 12), 'Business Checking', 'Business expenses', -21, 'GitHub Pro');
	if (18 <= lastDay) add(iso(y, m, 18), 'Business Checking', 'Business expenses', -10, 'Notion');
	if (25 <= lastDay) add(iso(y, m, 25), 'Business Checking', 'Business expenses', -29, 'Figma');
}

// --- bi-weekly paycheck ---
{
	let cursor = new Date(startDate);
	while (cursor.getUTCDay() !== 5) cursor.setUTCDate(cursor.getUTCDate() + 1);
	while (cursor <= TODAY) {
		const date = iso(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate());
		add(date, 'Checking', 'Salary', 3250 + intBetween(-50, 80), 'Acme Corp', 'Bi-weekly paycheck');
		cursor.setUTCDate(cursor.getUTCDate() + 14);
	}
}

// --- quarterly freelance income + interest ---
for (const { y, m, lastDay } of MONTHS) {
	if ([2, 5, 8, 11].includes(m) && 15 <= lastDay) {
		add(iso(y, m, 15), 'Business Checking', 'Other income', intBetween(1500, 3500), 'Freelance Client', 'Project invoice');
	}
	if ([3, 6, 9, 12].includes(m) && 28 <= lastDay) {
		add(iso(y, m, 28), 'Savings', 'Interest', dollars(12 + rand() * 18), 'High Yield Savings', 'Quarterly interest');
	}
}

// --- weekly: groceries & gas ---
for (const { y, m, lastDay } of MONTHS) {
	for (let d = 1; d <= lastDay; d++) {
		const dow = dayOfWeek(y, m, d);
		if (dow === 0 || (dow === 3 && chance(0.35))) {
			add(iso(y, m, d), 'Credit Card', 'Groceries', -(45 + rand() * 95), pick(GROCERY_PAYEES));
		}
		if (dow === 5 && chance(0.7)) {
			add(iso(y, m, d), 'Credit Card', 'Gas / Fuel', -(38 + rand() * 22), pick(GAS_PAYEES));
		}
	}
}

// --- daily-ish dining ---
for (const { y, m, lastDay } of MONTHS) {
	for (let d = 1; d <= lastDay; d++) {
		const meals = intBetween(0, 1) + (chance(0.35) ? 1 : 0);
		for (let i = 0; i < meals; i++) {
			const amt = chance(0.6) ? between(8, 22) : between(22, 65);
			add(iso(y, m, d), 'Credit Card', 'Dining', -amt, pick(DINING_PAYEES));
		}
	}
}

// --- monthly-ish: shopping, entertainment, health, transport, business ---
for (const { y, m, lastDay } of MONTHS) {
	for (let i = 0; i < intBetween(1, 4); i++) {
		const d = intBetween(2, Math.max(2, lastDay - 1));
		add(iso(y, m, d), 'Credit Card', 'Shopping', -between(25, 180), pick(SHOPPING_PAYEES));
	}
	for (let i = 0; i < intBetween(0, 3); i++) {
		const d = intBetween(2, Math.max(2, lastDay - 1));
		add(iso(y, m, d), 'Credit Card', 'Entertainment', -between(12, 75), pick(ENTERTAINMENT_PAYEES));
	}
	for (let i = 0; i < intBetween(0, 2); i++) {
		const d = intBetween(2, Math.max(2, lastDay - 1));
		const amt = chance(0.6) ? between(8, 35) : between(80, 220);
		add(iso(y, m, d), 'Credit Card', 'Health', -amt, pick(HEALTH_PAYEES));
	}
	for (let i = 0; i < intBetween(2, 6); i++) {
		const d = intBetween(2, Math.max(2, lastDay - 1));
		add(iso(y, m, d), 'Credit Card', 'Transport', -between(8, 40), chance(0.5) ? 'Uber' : 'Lyft');
	}
	if (chance(0.7)) {
		const d = intBetween(2, Math.max(2, lastDay - 1));
		add(iso(y, m, d), 'Business Checking', 'Business expenses', -between(45, 300), pick(BUSINESS_PAYEES));
	}
}

// --- travel + refunds + taxes + holiday ---
const tripIdxs = [Math.floor(MONTHS.length * 0.25), Math.floor(MONTHS.length * 0.55), Math.floor(MONTHS.length * 0.85)];
for (const idx of tripIdxs) {
	if (idx >= MONTHS.length) continue;
	const { y, m, lastDay } = MONTHS[idx];
	const start = intBetween(5, Math.max(5, lastDay - 5));
	add(iso(y, m, start), 'Credit Card', 'Travel', -between(280, 620), pick(TRAVEL_PAYEES), 'Flights');
	if (start + 1 <= lastDay) add(iso(y, m, start + 1), 'Credit Card', 'Travel', -between(180, 480), pick(TRAVEL_PAYEES), 'Hotel');
	if (start + 2 <= lastDay) add(iso(y, m, start + 2), 'Credit Card', 'Dining', -between(40, 110), 'Vacation Dining');
}
for (let i = 0; i < 4; i++) {
	const mo = MONTHS[Math.floor(rand() * MONTHS.length)];
	const d = intBetween(1, mo.lastDay);
	add(iso(mo.y, mo.m, d), 'Credit Card', 'Refunds', between(15, 95), pick(SHOPPING_PAYEES), 'Return');
}
for (const { y, m, lastDay } of MONTHS) {
	if (m === 4 && 15 <= lastDay) {
		add(iso(y, m, 15), 'Checking', 'Fees', -between(800, 2200), 'IRS', 'Federal income tax');
		add(iso(y, m, 15), 'Checking', 'Fees', -between(150, 500), 'State Tax Board', 'State income tax');
	}
}
for (const { y, m, lastDay } of MONTHS) {
	if (m !== 12) continue;
	for (let i = 0; i < 8; i++) {
		const d = intBetween(1, Math.min(24, lastDay));
		add(iso(y, m, d), 'Credit Card', 'Shopping', -between(30, 220), pick(SHOPPING_PAYEES), 'Holiday gifts');
	}
}

transactions.sort((a, b) => (a.Date < b.Date ? -1 : a.Date > b.Date ? 1 : 0));

await mkdir(staticDir, { recursive: true });

// --- CSV output ---
const csvHeaders = ['Date', 'Account', 'Business', 'Type', 'Category', 'Payee', 'Expense', 'Income', 'Notes'];
const escape = (s) =>
	s == null || s === ''
		? ''
		: String(s).includes(',') || String(s).includes('"')
			? `"${String(s).replace(/"/g, '""')}"`
			: String(s);
const csvLines = [csvHeaders.join(',')];
for (const t of transactions) {
	csvLines.push(csvHeaders.map((h) => escape(t[h])).join(','));
}
await writeFile(join(staticDir, 'default-budget.csv'), csvLines.join('\n'), 'utf8');

// --- XLSX output ---
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(transactions, { header: csvHeaders });
// Column widths
ws['!cols'] = [
	{ wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 9 }, { wch: 18 }, { wch: 22 },
	{ wch: 10 }, { wch: 10 }, { wch: 24 }
];
XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
XLSX.writeFile(wb, join(staticDir, 'default-budget.xlsx'), { bookType: 'xlsx' });

const totalExpense = transactions.filter((t) => t.Expense).reduce((s, t) => s + Number(t.Expense), 0);
const totalIncome = transactions.filter((t) => t.Income).reduce((s, t) => s + Number(t.Income), 0);
console.log(`Wrote ${transactions.length} transactions.`);
console.log(`  Income:  $${totalIncome.toFixed(2)}`);
console.log(`  Expense: $${totalExpense.toFixed(2)}`);
console.log(`  Net:     $${(totalIncome - totalExpense).toFixed(2)}`);
console.log('Files:');
console.log(`  ${join(staticDir, 'default-budget.csv')}`);
console.log(`  ${join(staticDir, 'default-budget.xlsx')}`);
