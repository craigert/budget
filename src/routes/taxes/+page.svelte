<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type {
		Account,
		Business,
		Category,
		Mileage,
		MileageKind,
		Transaction
	} from '$lib/db/types';
	import { mileageRate } from '$lib/db/types';
	import { money, formatDate } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { clearOnFocus } from '$lib/actions/clearOnFocus';

	const today = new Date('2026-05-20T00:00:00Z');
	let year = $state(today.getUTCFullYear());

	const yearStart = $derived(`${year}-01-01`);
	const yearEnd = $derived(`${year}-12-31`);

	const txs = live<Transaction[]>(
		() =>
			db.transactions
				.toArray()
				.then((arr) => arr.filter((t) => t.date >= yearStart && t.date <= yearEnd)),
		[]
	);
	const businesses = live<Business[]>(
		() => db.businesses.where('archived').equals(0).toArray(),
		[]
	);
	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const accounts = live<Account[]>(() => db.accounts.toArray(), []);
	const mileageLogs = live<Mileage[]>(
		() =>
			db.mileage
				.toArray()
				.then((arr) =>
					arr
						.filter((m) => m.date >= yearStart && m.date <= yearEnd)
						.sort((a, b) => (a.date < b.date ? 1 : -1))
				),
		[]
	);

	const categoryMap = $derived(new Map(categories.value.map((c) => [c.id!, c])));
	const accountMap = $derived(new Map(accounts.value.map((a) => [a.id!, a])));
	const businessMap = $derived(new Map(businesses.value.map((b) => [b.id!, b])));

	function categoryByName(name: string): Category | undefined {
		return categories.value.find((c) => c.name.toLowerCase() === name.toLowerCase());
	}
	function txInCategory(name: string): Transaction[] {
		const c = categoryByName(name);
		if (!c) return [];
		return txs.value.filter((t) => t.categoryId === c.id);
	}
	const sumAbs = (arr: Transaction[]) => arr.reduce((s, t) => s + Math.abs(t.amount), 0);
	const sumExpenses = (arr: Transaction[]) => arr.filter((t) => t.amount < 0).reduce((s, t) => s + -t.amount, 0);
	const sumIncome = (arr: Transaction[]) => arr.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

	// === Schedule C expense subsection definitions ===
	// Display order (shown to user)
	const EXPENSE_SECTIONS = [
		{ key: 'labor',      label: 'Labor' },
		{ key: 'admin',      label: 'Administrative' },
		{ key: 'operations', label: 'Operations' },
		{ key: 'vehicle',    label: 'Vehicle' },
		{ key: 'health',     label: 'Health Insurance' },
		{ key: 'homeoffice', label: 'Home Office' },
	] as const;

	// Classification order — more specific patterns first to prevent false matches
	const EXPENSE_CLASSIFIERS: { key: string; pattern: RegExp }[] = [
		{ key: 'homeoffice', pattern: /home.?office/i },
		{ key: 'vehicle',    pattern: /vehicle|automobile|car.and.truck|\btruck\b|\bcar\b|\bgas\b|fuel|mileage|parking|toll|\bauto\b/i },
		{ key: 'health',     pattern: /health|medical|dental|vision|insur/i },
		{ key: 'labor',      pattern: /labor|payroll|contract.?labor|wage|salary|salari|subcontract|employee|freelance|staff/i },
		{ key: 'admin',      pattern: /admin|advertis|commission|legal|professional|software|subscript|office|postage|dues|license|permit|printing|bank.?fee/i },
		{ key: 'operations', pattern: /operat|material|suppli|equipment|repair|mainten|utilit|\brent\b|shipping|inventor|telephone|internet|hosting|phone|depreci|travel/i },
	];

	function classifyExpenseCat(categoryName: string): string {
		for (const c of EXPENSE_CLASSIFIERS) {
			if (c.pattern.test(categoryName)) return c.key;
		}
		return 'other';
	}

	// === Schedule C per business ===
	const businessSummary = $derived.by(() => {
		return businesses.value.map((b) => {
			const rows = txs.value.filter((t) => t.businessId === b.id);
			const income = sumIncome(rows);
			const expense = sumExpenses(rows);

			const incomeRows = rows.filter((t) => t.amount > 0);
			const expenseTxs = rows.filter((t) => t.amount < 0);

			// Bucket expense transactions into Schedule C subsections
			const sectionBuckets = new Map<string, typeof expenseTxs>();
			for (const t of expenseTxs) {
				const catName = t.categoryId != null ? (categoryMap.get(t.categoryId)?.name ?? '') : '';
				const sk = classifyExpenseCat(catName);
				if (!sectionBuckets.has(sk)) sectionBuckets.set(sk, []);
				sectionBuckets.get(sk)!.push(t);
			}
			const expenseSections = EXPENSE_SECTIONS.map((s) => ({
				key: s.key,
				label: s.label,
				txs: sectionBuckets.get(s.key) ?? [],
				total: sumAbs(sectionBuckets.get(s.key) ?? [])
			}));
			const otherExpenseTxs = sectionBuckets.get('other') ?? [];

			return { business: b, income, expense, profit: income - expense, rows, incomeRows, expenseSections, otherExpenseTxs };
		});
	});

	// === Charity (Schedule A line 11) ===
	const charityTxs = $derived.by(() => {
		const c = categoryByName('Charity');
		const explicit = c ? txs.value.filter((t) => t.categoryId === c.id) : [];
		// Also catch transactions whose payee/notes look charitable, even if categorized otherwise
		const looksLike = txs.value.filter((t) => {
			if (c && t.categoryId === c.id) return false;
			const blob = `${t.payee} ${t.notes}`.toLowerCase();
			return /\b(donat|charit|tithe|nonprofit|foundation|church|goodwill|salvation army|red cross|unicef)\b/.test(blob);
		});
		return [...explicit, ...looksLike].filter((t) => t.amount < 0);
	});
	const charityTotal = $derived(sumAbs(charityTxs));

	// === Medical (Schedule A — only amount over 7.5% of AGI is deductible) ===
	const medicalTxs = $derived(txInCategory('Health').filter((t) => t.amount < 0));
	const medicalTotal = $derived(sumAbs(medicalTxs));

	// === SALT — State + local + property + sales taxes, capped at $10k ===
	const saltTxs = $derived.by(() => {
		const taxesPaid = categoryByName('Taxes Paid');
		const fees = categoryByName('Fees');
		// Anything tagged "Taxes Paid", OR Fees-category transactions whose payee
		// matches state/local tax / treasury / department of revenue patterns.
		const direct = taxesPaid ? txs.value.filter((t) => t.categoryId === taxesPaid.id) : [];
		const heur = (fees ? txs.value.filter((t) => t.categoryId === fees.id) : []).filter((t) => {
			const blob = `${t.payee} ${t.notes}`.toLowerCase();
			return /\b(state|treasury|department of revenue|tax board|property tax|county tax|sales tax)\b/.test(blob);
		});
		return [...direct, ...heur].filter((t) => t.amount < 0);
	});
	const saltTotal = $derived(sumAbs(saltTxs));
	const saltDeductible = $derived(Math.min(saltTotal, 10000));

	// === Mortgage interest ===
	const mortgageTxs = $derived.by(() => {
		const mi = categoryByName('Mortgage Interest');
		const direct = mi ? txs.value.filter((t) => t.categoryId === mi.id) : [];
		// Also surface transactions in Rent/Mortgage whose notes mention "interest"
		const rentMortgage = categoryByName('Rent / Mortgage');
		const heur = (rentMortgage ? txs.value.filter((t) => t.categoryId === rentMortgage.id) : []).filter((t) => /\binterest\b/i.test(`${t.payee} ${t.notes}`));
		return [...direct, ...heur].filter((t) => t.amount < 0);
	});
	const mortgageTotal = $derived(sumAbs(mortgageTxs));

	// === Estimated tax payments — federal vs state (Q1-Q4) ===
	const estimatedCandidates = $derived.by(() => {
		const tp = categoryByName('Taxes Paid');
		const fees = categoryByName('Fees');
		return txs.value.filter((t) => t.amount < 0 && (
			(tp && t.categoryId === tp.id) || (fees && t.categoryId === fees.id)
		));
	});
	const federalEstimatedTaxTxs = $derived.by(() =>
		estimatedCandidates.filter((t) =>
			/\b(irs|internal revenue|treasury|1040|federal)\b/i.test(`${t.payee} ${t.notes}`)
		)
	);
	const stateEstimatedTaxTxs = $derived.by(() =>
		estimatedCandidates.filter((t) =>
			/\b(state tax|department of revenue|dept\.? of revenue|state treasurer|state income)\b/i.test(`${t.payee} ${t.notes}`)
		)
	);
	function quarterOf(date: string): 1 | 2 | 3 | 4 {
		const m = Number(date.slice(5, 7));
		if (m <= 3) return 1;
		if (m <= 6) return 2;
		if (m <= 9) return 3;
		return 4;
	}
	const federalQuarterlyTotals = $derived.by(() => {
		const buckets: Record<1 | 2 | 3 | 4, Transaction[]> = { 1: [], 2: [], 3: [], 4: [] };
		for (const t of federalEstimatedTaxTxs) buckets[quarterOf(t.date)].push(t);
		return buckets;
	});
	const stateQuarterlyTotals = $derived.by(() => {
		const buckets: Record<1 | 2 | 3 | 4, Transaction[]> = { 1: [], 2: [], 3: [], 4: [] };
		for (const t of stateEstimatedTaxTxs) buckets[quarterOf(t.date)].push(t);
		return buckets;
	});
	const federalEstimatedTotal = $derived(sumAbs(federalEstimatedTaxTxs));
	const stateEstimatedTotal = $derived(sumAbs(stateEstimatedTaxTxs));

	// === Mileage ===
	const mileageBuckets = $derived.by(() => {
		const buckets: Record<MileageKind, { miles: number; deduction: number; logs: Mileage[] }> = {
			business: { miles: 0, deduction: 0, logs: [] },
			medical: { miles: 0, deduction: 0, logs: [] },
			charity: { miles: 0, deduction: 0, logs: [] }
		};
		for (const m of mileageLogs.value) {
			const b = buckets[m.kind];
			b.miles += m.miles;
			b.deduction += m.miles * mileageRate(year, m.kind);
			b.logs.push(m);
		}
		return buckets;
	});
	const mileageTotalDeduction = $derived(
		mileageBuckets.business.deduction +
			mileageBuckets.medical.deduction +
			mileageBuckets.charity.deduction
	);

	// === Retirement & HSA contributions ===
	interface RetirementPlan {
		categoryName: string;
		label: string;
		limit: number;
		limitNote: string;
		deductible: boolean;
		schedule: string; // where it goes on the return
	}
	const RETIREMENT_PLANS: RetirementPlan[] = [
		{
			categoryName: 'Traditional IRA',
			label: 'Traditional IRA',
			limit: 7000,
			limitNote: '$7,000 / $8,000 if 50+ (shared with Roth IRA)',
			deductible: true,
			schedule: 'Schedule 1, line 20'
		},
		{
			categoryName: 'Roth IRA',
			label: 'Roth IRA',
			limit: 7000,
			limitNote: '$7,000 / $8,000 if 50+ (shared with Traditional IRA)',
			deductible: false,
			schedule: 'Not deductible — informational'
		},
		{
			categoryName: 'Solo 401(k) / SEP-IRA',
			label: 'Solo 401(k) / SEP-IRA',
			limit: 69000,
			limitNote: 'Up to 25% of net SE earnings, $69,000 max',
			deductible: true,
			schedule: 'Schedule 1, line 16'
		},
		{
			categoryName: 'HSA Contribution',
			label: 'HSA contribution',
			limit: 4150,
			limitNote: '$4,150 self / $8,300 family / +$1,000 if 55+',
			deductible: true,
			schedule: 'Schedule 1, line 13 (Form 8889)'
		}
	];
	const retirementBuckets = $derived(
		RETIREMENT_PLANS.map((p) => {
			const c = categoryByName(p.categoryName);
			const tx = c ? txs.value.filter((t) => t.categoryId === c.id && t.amount < 0) : [];
			const total = tx.reduce((s, t) => s + -t.amount, 0);
			return { plan: p, category: c, txs: tx, total };
		})
	);
	const retirementDeductibleTotal = $derived(
		retirementBuckets.filter((b) => b.plan.deductible).reduce((s, b) => s + b.total, 0)
	);

	// === College & education expenses (Form 8863) ===
	const educationTxs = $derived.by(() => {
		// Category-name match
		const eduCats = categories.value.filter((c) =>
			/tuition|education|college|universit|school|textbook|course|class/i.test(c.name)
		);
		const eduCatIds = new Set(eduCats.map((c) => c.id!));
		const fromCat = txs.value.filter(
			(t) => t.amount < 0 && t.categoryId != null && eduCatIds.has(t.categoryId)
		);
		// Payee / notes heuristic for uncategorised transactions
		const heur = txs.value.filter((t) => {
			if (t.categoryId != null && eduCatIds.has(t.categoryId)) return false;
			const blob = `${t.payee} ${t.notes}`.toLowerCase();
			return t.amount < 0 && /\b(tuition|universit|college|textbook|course fee|enrollment fee|registration fee)\b/.test(blob);
		});
		return [...fromCat, ...heur];
	});

	const educationByType = $derived.by(() => {
		const buckets: Record<'tuition' | 'books' | 'supplies' | 'equipment' | 'other', Transaction[]> = {
			tuition: [], books: [], supplies: [], equipment: [], other: []
		};
		for (const t of educationTxs) {
			const catName = t.categoryId != null ? (categoryMap.get(t.categoryId)?.name ?? '') : '';
			const blob = `${catName} ${t.payee} ${t.notes}`.toLowerCase();
			if (/tuition|enrollment|registrat|course.?fee|college|universit|school.?fee/.test(blob)) {
				buckets.tuition.push(t);
			} else if (/book|textbook|reading|course.?material/.test(blob)) {
				buckets.books.push(t);
			} else if (/suppli|stationar|notebook|binder|folder/.test(blob)) {
				buckets.supplies.push(t);
			} else if (/equipment|laptop|computer|calculat|software|tablet/.test(blob)) {
				buckets.equipment.push(t);
			} else {
				buckets.other.push(t);
			}
		}
		return buckets;
	});

	const educationTotal = $derived(sumAbs(educationTxs));

	// === AGI (user-supplied, persisted to settings) ===
	let agi = $state(0);
	$effect(() => {
		(async () => {
			const v = await db.settings.get(`agi_${year}`);
			agi = typeof v?.value === 'number' ? v.value : 0;
		})();
	});
	let agiInput = $state('');
	$effect(() => {
		agiInput = agi > 0 ? String(agi) : '';
	});
	async function saveAGI() {
		const n = Number(agiInput) || 0;
		agi = n;
		await db.settings.put({ key: `agi_${year}`, value: n });
	}
	const medicalThreshold = $derived(agi > 0 ? agi * 0.075 : 0);
	const medicalDeductible = $derived(agi > 0 ? Math.max(0, medicalTotal - medicalThreshold) : 0);

	// === Drilldown expansion state ===
	let expanded = $state<Set<string>>(new Set());
	function toggleExpand(key: string) {
		const next = new Set(expanded);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expanded = next;
	}
	const isOpen = (key: string) => expanded.has(key);

	// === Mileage quick-add form ===
	let showMileageForm = $state(false);
	let mileageForm = $state({
		date: today.toISOString().slice(0, 10),
		miles: 0,
		kind: 'business' as MileageKind,
		purpose: '',
		businessId: null as number | null,
		notes: ''
	});
	function openMileageForm() {
		mileageForm = {
			date: today.toISOString().slice(0, 10),
			miles: 0,
			kind: 'business',
			purpose: '',
			businessId: businesses.value[0]?.id ?? null,
			notes: ''
		};
		showMileageForm = true;
	}
	async function saveMileage(e: Event) {
		e.preventDefault();
		if (mileageForm.miles <= 0) return;
		await db.mileage.add({
			date: mileageForm.date,
			miles: Number(mileageForm.miles) || 0,
			kind: mileageForm.kind,
			purpose: mileageForm.purpose.trim(),
			businessId: mileageForm.kind === 'business' ? mileageForm.businessId : null,
			notes: mileageForm.notes.trim(),
			createdAt: Date.now()
		} as Mileage);
		showMileageForm = false;
	}
	async function deleteMileage(m: Mileage) {
		if (!m.id) return;
		if (!confirm(`Delete mileage entry: ${m.miles} mi on ${m.date}?`)) return;
		await db.mileage.delete(m.id);
	}

	// === Year availability — based on any data in DB ===
	const availableYears = $derived.by(() => {
		const set = new Set<number>([year]);
		// Add current + previous 2 years as defaults
		set.add(today.getUTCFullYear());
		set.add(today.getUTCFullYear() - 1);
		set.add(today.getUTCFullYear() - 2);
		return Array.from(set).sort((a, b) => b - a);
	});

	function renderTxRow(t: Transaction) {
		const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : null;
		const acct = accountMap.get(t.accountId);
		return { cat, acct };
	}

	/**
	 * Bundles every computed figure on this page into a single plain-text
	 * summary, formatted as a FreeTaxUSA hand-off worksheet. Each section
	 * cites the matching IRS form/schedule line so you can drop numbers
	 * straight into FreeTaxUSA without hunting.
	 *
	 * Plain text rather than CSV because the user is transcribing values
	 * into a tax product, not feeding a spreadsheet.
	 */
	function buildFreeTaxUSAReport(): string {
		const usd = (n: number) =>
			n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
		const line = (label: string, value: string | number, indent = 0) => {
			const pad = '  '.repeat(indent);
			const v = typeof value === 'number' ? usd(value) : value;
			return `${pad}${label.padEnd(60 - indent * 2)} ${v}`;
		};
		const rule = '─'.repeat(72);
		// Schedule C line numbers per EXPENSE_SECTIONS key. Single representative
		// line per category — actual filings may split across multiple Sch C lines.
		const SCH_C_LINE: Record<string, string> = {
			labor: 'Sch C line 11 (Contract labor) / line 26 (Wages)',
			admin: 'Sch C line 8 (Advertising) / line 17 (Legal & prof) / line 18 (Office)',
			operations: 'Sch C line 20–25 (Rent, repairs, supplies, utilities)',
			vehicle: 'Sch C line 9 (Car & truck expenses)',
			health: 'Schedule 1 line 16 (Self-employed health insurance)',
			homeoffice: 'Sch C line 30 (Home office — via Form 8829)'
		};
		const out: string[] = [];

		out.push(`BudgetSparrow — FreeTaxUSA hand-off worksheet`);
		out.push(`Tax year ${year}`);
		out.push(`Generated ${new Date().toLocaleString()}`);
		out.push('');
		out.push(`Drop these numbers into FreeTaxUSA's matching screens. Each section`);
		out.push(`cites the relevant IRS form/schedule line. Estimates only — verify`);
		out.push(`against statements & receipts before filing.`);
		out.push('');

		// --- Schedule C: Business income / expenses ---
		if (businessSummary.length > 0) {
			out.push(rule);
			out.push(`SCHEDULE C — Self-employment (Form 1040)`);
			out.push(rule);
			for (const b of businessSummary) {
				out.push('');
				out.push(`Business: ${b.business.name}`);
				out.push(line('Gross receipts (line 1)', b.income, 1));
				out.push(line('Total expenses (line 28)', b.expense, 1));
				out.push(line('Net profit (line 31)', b.profit, 1));
				if (b.expenseSections.some((s) => s.total > 0)) {
					out.push('');
					out.push(`  Expense breakdown:`);
					for (const s of b.expenseSections) {
						if (s.total > 0) {
							out.push(line(`${s.label}`, s.total, 2));
							const ref = SCH_C_LINE[s.key];
							if (ref) out.push(`      → ${ref}`);
						}
					}
					if (b.otherExpenseTxs.length > 0) {
						const otherTotal = sumAbs(b.otherExpenseTxs);
						out.push(line('Other expenses', otherTotal, 2));
						out.push(`      → Sch C line 27a (Other expenses, itemize Part V)`);
					}
				}
			}
			out.push('');
		}

		// --- Schedule A: Itemized deductions ---
		out.push(rule);
		out.push(`SCHEDULE A — Itemized deductions`);
		out.push(rule);
		out.push(line('Medical & dental expenses (line 1)', medicalTotal));
		out.push(line('State & local taxes paid', saltTotal));
		out.push(line('  ↳ Deductible (capped at $10,000, line 5e)', saltDeductible));
		out.push(line('Mortgage interest (line 8a)', mortgageTotal));
		out.push(line('Charitable contributions — cash (line 11)', charityTotal));
		out.push('');

		// --- Mileage (Schedule C or Schedule A) ---
		if (mileageTotalDeduction > 0) {
			out.push(rule);
			out.push(`MILEAGE`);
			out.push(rule);
			if (mileageBuckets.business.deduction > 0) {
				out.push(line(`Business — ${mileageBuckets.business.miles} mi → deduction`, mileageBuckets.business.deduction));
				out.push(`  → Schedule C line 9 (Car and truck expenses)`);
			}
			if (mileageBuckets.medical.deduction > 0) {
				out.push(line(`Medical — ${mileageBuckets.medical.miles} mi → deduction`, mileageBuckets.medical.deduction));
				out.push(`  → Schedule A line 1 (Medical & dental expenses)`);
			}
			if (mileageBuckets.charity.deduction > 0) {
				out.push(line(`Charity — ${mileageBuckets.charity.miles} mi → deduction`, mileageBuckets.charity.deduction));
				out.push(`  → Schedule A line 11 (Charitable contributions)`);
			}
			out.push('');
		}

		// --- Retirement & HSA ---
		const usedRetirement = retirementBuckets.filter((b) => b.total > 0);
		if (usedRetirement.length > 0) {
			out.push(rule);
			out.push(`RETIREMENT & HSA CONTRIBUTIONS`);
			out.push(rule);
			for (const b of usedRetirement) {
				out.push(line(`${b.plan.label}`, b.total));
				out.push(`  → ${b.plan.schedule}`);
				if (b.plan.limit) {
					out.push(`  → Limit: ${b.plan.limitNote ?? usd(b.plan.limit)}`);
				}
			}
			out.push('');
			out.push(line('Total above-the-line retirement deduction', retirementDeductibleTotal));
			out.push('');
		}

		// --- Education ---
		if (educationTotal > 0) {
			out.push(rule);
			out.push(`EDUCATION (Form 8863 — credits) / Form 1040 line 21 (deduction)`);
			out.push(rule);
			if (educationByType.tuition.length > 0)
				out.push(line('Tuition & enrollment fees', sumAbs(educationByType.tuition)));
			if (educationByType.books.length > 0)
				out.push(line('Books & course materials', sumAbs(educationByType.books)));
			if (educationByType.supplies.length > 0)
				out.push(line('Supplies', sumAbs(educationByType.supplies)));
			if (educationByType.equipment.length > 0)
				out.push(line('Equipment (laptop, software)', sumAbs(educationByType.equipment)));
			if (educationByType.other.length > 0)
				out.push(line('Other education-related', sumAbs(educationByType.other)));
			out.push('');
			out.push(line('Total education expenses', educationTotal));
			out.push('');
		}

		// --- AGI if user set one ---
		if (agi > 0) {
			out.push(rule);
			out.push(`AGI REFERENCE`);
			out.push(rule);
			out.push(line(`AGI (user-supplied for ${year})`, agi));
			out.push('');
		}

		out.push(rule);
		out.push(`These figures are estimates. Verify against your statements and`);
		out.push(`receipts. Consult a tax professional for advice on your situation.`);
		out.push('');

		return out.join('\n');
	}

	function exportFreeTaxUSA() {
		const text = buildFreeTaxUSAReport();
		const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `BudgetSparrow-FreeTaxUSA-${year}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

<PageHeader title="Taxes" subtitle="Year-end summary for FreeTaxUSA — {year}">
	{#snippet actions()}
		<select
			class="text-sm"
			value={year}
			onchange={(e) => (year = Number((e.currentTarget as HTMLSelectElement).value))}
			aria-label="Tax year"
		>
			{#each availableYears as y (y)}
				<option value={y}>{y}</option>
			{/each}
		</select>
	{/snippet}
</PageHeader>

<div class="space-y-6 p-4 md:p-8">
	<!-- Schedule C per business -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-4 flex items-start justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">Schedule C — Self-employment</h2>
				<p class="mt-1 text-xs text-slate-500">Per business: income, deductible expenses, and net profit. Plug each business into a separate Schedule C in FreeTaxUSA.</p>
			</div>
		</div>
		{#if businessSummary.length === 0}
			<p class="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
				No businesses set up. Add one on the <a class="text-brand-600 underline" href="/business">Business page</a>.
			</p>
		{:else}
			<div class="space-y-4">
				{#each businessSummary as b (b.business.id)}
					{@const key = `biz-${b.business.id}`}
					<div class="rounded-lg border border-slate-200 dark:border-slate-800">
						<div class="flex items-center gap-3 px-4 py-3">
							<div class="flex h-9 w-9 items-center justify-center rounded-full" style="background:{b.business.color}22;color:{b.business.color}">
								<Icon name={b.business.icon} size={18} />
							</div>
							<div class="flex-1">
								<div class="font-medium">{b.business.name}</div>
								<div class="text-xs text-slate-500">{b.rows.length} transactions this year</div>
							</div>
							<div class="grid grid-cols-3 gap-3 text-right">
								<div>
									<div class="section-label">Income</div>
									<div class="tabular-nums text-brand-500">{money(b.income)}</div>
								</div>
								<div>
									<div class="section-label">Expenses</div>
									<div class="tabular-nums">{money(b.expense)}</div>
								</div>
								<div>
									<div class="section-label">Net</div>
									<div class="tabular-nums font-semibold {b.profit < 0 ? 'text-red-600' : ''}">{money(b.profit)}</div>
								</div>
							</div>
							<button
								class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
								onclick={() => toggleExpand(key)}
								aria-label={isOpen(key) ? 'Collapse' : 'Expand'}
							>
								{isOpen(key) ? '−' : '+'}
							</button>
						</div>
						{#if isOpen(key)}
							<div class="border-t border-slate-200 dark:border-slate-800">

								<!-- Income -->
								<div class="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
									<button
										class="flex w-full items-center justify-between text-left"
										onclick={() => toggleExpand(`${key}-income`)}
									>
										<span class="text-sm font-semibold text-slate-700 dark:text-slate-300">Income</span>
										<div class="flex items-center gap-3">
											<span class="tabular-nums font-medium text-brand-500">{money(b.income)}</span>
											<span class="text-xs text-slate-400">{isOpen(`${key}-income`) ? '−' : '+'}</span>
										</div>
									</button>
									{#if isOpen(`${key}-income`)}
										{#if b.incomeRows.length > 0}
											<ul class="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
												{#each b.incomeRows as t (t.id)}
													{@const r = renderTxRow(t)}
													<li class="flex items-center gap-2 px-2 py-1.5 text-xs">
														<span class="w-20 shrink-0 text-slate-500">{t.date}</span>
														<span class="flex-1 truncate">{t.payee || '(no payee)'}</span>
														<span class="w-28 shrink-0 truncate text-slate-500">{r.cat?.name ?? ''}</span>
														<span class="w-20 shrink-0 text-right tabular-nums text-brand-500">{money(t.amount)}</span>
													</li>
												{/each}
											</ul>
										{:else}
											<p class="mt-2 text-xs text-slate-500">No income transactions for this business.</p>
										{/if}
									{/if}
								</div>

								<!-- Expenses -->
								<div class="px-4 py-3">
									<div class="mb-3 flex items-center justify-between">
										<span class="text-sm font-semibold text-slate-700 dark:text-slate-300">Expenses</span>
										<span class="tabular-nums font-medium">{money(b.expense)}</span>
									</div>
									<div class="space-y-2">
										{#each b.expenseSections as section (section.key)}
											{#if section.txs.length > 0}
												{@const subkey = `${key}-${section.key}`}
												<div class="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
													<button
														class="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
														onclick={() => toggleExpand(subkey)}
													>
														<span class="text-sm font-medium">{section.label}</span>
														<div class="flex items-center gap-3">
															<span class="tabular-nums text-sm">{money(section.total)}</span>
															<span class="text-xs text-slate-400">{isOpen(subkey) ? '−' : '+'}</span>
														</div>
													</button>
													{#if isOpen(subkey)}
														<ul class="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
															{#each section.txs as t (t.id)}
																{@const r = renderTxRow(t)}
																<li class="flex items-center gap-2 px-3 py-1.5 text-xs">
																	<span class="w-20 shrink-0 text-slate-500">{t.date}</span>
																	<span class="flex-1 truncate">{t.payee || '(no payee)'}</span>
																	<span class="w-28 shrink-0 truncate text-slate-500">{r.cat?.name ?? ''}</span>
																	<span class="w-20 shrink-0 text-right tabular-nums">{money(t.amount)}</span>
																</li>
															{/each}
														</ul>
													{/if}
												</div>
											{/if}
										{/each}

										{#if b.otherExpenseTxs.length > 0}
											{@const subkey = `${key}-other`}
											<div class="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
												<button
													class="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
													onclick={() => toggleExpand(subkey)}
												>
													<span class="text-sm font-medium">Other</span>
													<div class="flex items-center gap-3">
														<span class="tabular-nums text-sm">{money(sumAbs(b.otherExpenseTxs))}</span>
														<span class="text-xs text-slate-400">{isOpen(subkey) ? '−' : '+'}</span>
													</div>
												</button>
												{#if isOpen(subkey)}
													<ul class="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
														{#each b.otherExpenseTxs as t (t.id)}
															{@const r = renderTxRow(t)}
															<li class="flex items-center gap-2 px-3 py-1.5 text-xs">
																<span class="w-20 shrink-0 text-slate-500">{t.date}</span>
																<span class="flex-1 truncate">{t.payee || '(no payee)'}</span>
																<span class="w-28 shrink-0 truncate text-slate-500">{r.cat?.name ?? ''}</span>
																<span class="w-20 shrink-0 text-right tabular-nums">{money(t.amount)}</span>
															</li>
														{/each}
													</ul>
												{/if}
											</div>
										{/if}

										{#if b.expense === 0}
											<p class="text-xs text-slate-500">No expense transactions for this business.</p>
										{/if}
									</div>
								</div>

							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Mileage -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-4 flex items-start justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">Mileage deduction</h2>
				<p class="mt-1 text-xs text-slate-500">
					{year} IRS standard rates: business {(mileageRate(year, 'business') * 100).toFixed(0)}¢/mi · medical {(mileageRate(year, 'medical') * 100).toFixed(0)}¢/mi · charity {(mileageRate(year, 'charity') * 100).toFixed(0)}¢/mi
				</p>
			</div>
			<Button size="sm" onclick={openMileageForm}>+ Log miles</Button>
		</div>
		<div class="grid gap-3 sm:grid-cols-3">
			{#each ['business', 'medical', 'charity'] as const as kind (kind)}
				{@const b = mileageBuckets[kind]}
				{@const key = `mileage-${kind}`}
				<div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
					<div class="section-label capitalize">{kind} miles</div>
					<div class="mt-1 text-2xl font-semibold tabular-nums">{b.miles.toLocaleString()}</div>
					<div class="mt-1 text-sm text-slate-500 tabular-nums">{money(b.deduction)} deduction</div>
					{#if b.logs.length > 0}
						<button class="mt-2 text-xs text-brand-600 hover:underline" onclick={() => toggleExpand(key)}>
							{isOpen(key) ? 'Hide' : 'Show'} {b.logs.length} entries
						</button>
						{#if isOpen(key)}
							<ul class="mt-2 max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
								{#each b.logs as m (m.id)}
									<li class="flex items-center gap-2 px-2 py-1 text-xs">
										<span class="w-20 shrink-0 text-slate-500">{m.date}</span>
										<span class="flex-1 truncate">{m.purpose || '(no purpose)'}</span>
										<span class="w-14 shrink-0 text-right tabular-nums">{m.miles.toLocaleString()} mi</span>
										<button class="text-slate-400 hover:text-red-600" onclick={() => deleteMileage(m)} aria-label="Delete">×</button>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
		<div class="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
			Total mileage deduction · {money(mileageTotalDeduction)}
		</div>
	</section>

	<!-- Charity -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-3 flex items-start justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">Charitable contributions</h2>
				<p class="mt-1 text-xs text-slate-500">Schedule A, line 11. Single donations ≥ $250 need written acknowledgment from the charity.</p>
			</div>
			<div class="text-right">
				<div class="text-2xl font-semibold tabular-nums">{money(charityTotal)}</div>
				<div class="text-xs text-slate-500">{charityTxs.length} donation(s)</div>
			</div>
		</div>
		{#if charityTxs.length > 0}
			<button class="text-xs text-brand-600 hover:underline" onclick={() => toggleExpand('charity')}>
				{isOpen('charity') ? 'Hide' : 'Show'} transactions
			</button>
			{#if isOpen('charity')}
				<ul class="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
					{#each charityTxs as t (t.id)}
						{@const r = renderTxRow(t)}
						{@const flag = -t.amount >= 250}
						<li class="flex items-center gap-2 px-3 py-1.5 text-sm">
							<span class="w-24 shrink-0 text-slate-500">{formatDate(t.date)}</span>
							<span class="flex-1 truncate">{t.payee || '(no payee)'}</span>
							<span class="w-24 shrink-0 truncate text-slate-500">{r.cat?.name ?? ''}</span>
							<span class="w-24 shrink-0 text-right tabular-nums">{money(t.amount)}</span>
							{#if flag}
								<span class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title="Donations ≥ $250 require written acknowledgment">≥$250</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<p class="text-sm text-slate-500">No charitable donations detected for {year}.</p>
		{/if}
	</section>

	<!-- Medical -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-3 flex items-start justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">Medical expenses</h2>
				<p class="mt-1 text-xs text-slate-500">Schedule A, line 4. Only the amount exceeding 7.5% of AGI is deductible.</p>
			</div>
			<div class="text-right">
				<div class="text-2xl font-semibold tabular-nums">{money(medicalTotal)}</div>
				<div class="text-xs text-slate-500">{medicalTxs.length} transaction(s)</div>
			</div>
		</div>
		<div class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
			<div>
				<label for="agi" class="mb-1 block text-xs font-medium">Your {year} Adjusted Gross Income (AGI)</label>
				<div class="relative">
					<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">$</span>
					<input
						id="agi"
						type="number"
						inputmode="decimal"
						step="100"
						min="0"
						bind:value={agiInput}
						use:clearOnFocus
						onblur={saveAGI}
						placeholder="Enter AGI to compute the deductible portion"
						class="w-full pl-6"
					/>
				</div>
			</div>
			<div class="text-xs text-slate-500">
				{#if agi > 0}
					7.5% threshold: <span class="font-medium tabular-nums">{money(medicalThreshold)}</span>
				{:else}
					Enter AGI →
				{/if}
			</div>
		</div>
		{#if agi > 0}
			{@const pct = Math.min(100, (medicalTotal / Math.max(1, medicalThreshold)) * 100)}
			<div class="mt-3">
				<div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
					<div class="h-full {medicalTotal >= medicalThreshold ? 'bg-brand-500' : 'bg-amber-400'}" style="width:{pct}%"></div>
				</div>
				<div class="mt-1.5 flex justify-between text-xs">
					<span class="text-slate-500">{money(medicalTotal)} / {money(medicalThreshold)} threshold</span>
					<span class="font-semibold {medicalDeductible > 0 ? 'text-brand-600' : 'text-slate-500'}">
						Deductible: {money(medicalDeductible)}
					</span>
				</div>
			</div>
		{/if}
		{#if medicalTxs.length > 0}
			<button class="mt-3 text-xs text-brand-600 hover:underline" onclick={() => toggleExpand('medical')}>
				{isOpen('medical') ? 'Hide' : 'Show'} transactions
			</button>
			{#if isOpen('medical')}
				<ul class="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
					{#each medicalTxs.slice(0, 200) as t (t.id)}
						{@const r = renderTxRow(t)}
						<li class="flex items-center gap-2 px-3 py-1.5 text-sm">
							<span class="w-24 shrink-0 text-slate-500">{formatDate(t.date)}</span>
							<span class="flex-1 truncate">{t.payee || '(no payee)'}</span>
							<span class="w-24 shrink-0 truncate text-slate-500">{r.acct?.name ?? ''}</span>
							<span class="w-24 shrink-0 text-right tabular-nums">{money(t.amount)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</section>

	<!-- SALT -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-3 flex items-start justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">State &amp; local taxes (SALT)</h2>
				<p class="mt-1 text-xs text-slate-500">Schedule A, lines 5–7. State + local income or sales + property + personal property taxes. Capped at $10,000.</p>
			</div>
			<div class="text-right">
				<div class="text-2xl font-semibold tabular-nums">{money(saltTotal)}</div>
				<div class="text-xs text-slate-500">{saltTxs.length} payment(s)</div>
			</div>
		</div>
		<div>
			<div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
				<div class="h-full {saltTotal >= 10000 ? 'bg-red-500' : 'bg-brand-500'}" style="width:{Math.min(100, (saltTotal / 10000) * 100)}%"></div>
			</div>
			<div class="mt-1.5 flex justify-between text-xs">
				<span class="text-slate-500">{money(saltTotal)} of $10,000 cap</span>
				<span class="font-semibold text-brand-600">Deductible: {money(saltDeductible)}</span>
			</div>
		</div>
		{#if saltTxs.length > 0}
			<button class="mt-3 text-xs text-brand-600 hover:underline" onclick={() => toggleExpand('salt')}>
				{isOpen('salt') ? 'Hide' : 'Show'} transactions
			</button>
			{#if isOpen('salt')}
				<ul class="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
					{#each saltTxs as t (t.id)}
						{@const r = renderTxRow(t)}
						<li class="flex items-center gap-2 px-3 py-1.5 text-sm">
							<span class="w-24 shrink-0 text-slate-500">{formatDate(t.date)}</span>
							<span class="flex-1 truncate">{t.payee || '(no payee)'}</span>
							<span class="w-24 shrink-0 truncate text-slate-500">{r.cat?.name ?? ''}</span>
							<span class="w-24 shrink-0 text-right tabular-nums">{money(t.amount)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</section>

	<!-- Mortgage interest -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-3 flex items-start justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">Mortgage interest paid</h2>
				<p class="mt-1 text-xs text-slate-500">Schedule A, line 8. Use the interest portion of your mortgage payments — your lender's 1098 has the exact figure.</p>
			</div>
			<div class="text-right">
				<div class="text-2xl font-semibold tabular-nums">{money(mortgageTotal)}</div>
				<div class="text-xs text-slate-500">{mortgageTxs.length} payment(s)</div>
			</div>
		</div>
		{#if mortgageTxs.length > 0}
			<button class="text-xs text-brand-600 hover:underline" onclick={() => toggleExpand('mortgage')}>
				{isOpen('mortgage') ? 'Hide' : 'Show'} transactions
			</button>
			{#if isOpen('mortgage')}
				<ul class="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
					{#each mortgageTxs as t (t.id)}
						{@const r = renderTxRow(t)}
						<li class="flex items-center gap-2 px-3 py-1.5 text-sm">
							<span class="w-24 shrink-0 text-slate-500">{formatDate(t.date)}</span>
							<span class="flex-1 truncate">{t.payee || '(no payee)'}</span>
							<span class="w-24 shrink-0 truncate text-slate-500">{r.cat?.name ?? ''}</span>
							<span class="w-24 shrink-0 text-right tabular-nums">{money(t.amount)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<p class="text-sm text-slate-500">
				No mortgage-interest payments tagged for {year}. Tag relevant payments with the
				<strong>Mortgage Interest</strong> category to populate this section.
			</p>
		{/if}
	</section>

	<!-- Estimated tax payments -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-4 flex items-start justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">Estimated tax payments</h2>
				<p class="mt-1 text-xs text-slate-500">Federal and state quarterly payments tracked separately. Tag payees with "IRS" or "Treasury" for federal, "Department of Revenue" or "State Tax" for state.</p>
			</div>
			<div class="flex gap-5 text-right">
				<div>
					<div class="text-xs text-slate-500">Federal</div>
					<div class="text-xl font-semibold tabular-nums">{money(federalEstimatedTotal)}</div>
				</div>
				<div>
					<div class="text-xs text-slate-500">State</div>
					<div class="text-xl font-semibold tabular-nums">{money(stateEstimatedTotal)}</div>
				</div>
			</div>
		</div>

		<!-- Federal Q1–Q4 -->
		<div class="mb-5">
			<div class="mb-2 flex items-baseline gap-2">
				<span class="text-sm font-semibold text-slate-700 dark:text-slate-300">Federal</span>
				<span class="text-xs text-slate-500">IRS · Form 1040, line 26</span>
			</div>
			<div class="grid gap-3 sm:grid-cols-4">
				{#each [1, 2, 3, 4] as const as q (q)}
					{@const key = `feq-${q}`}
					{@const rows = federalQuarterlyTotals[q]}
					{@const total = sumAbs(rows)}
					<div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
						<div class="section-label">Q{q}</div>
						<div class="mt-1 text-xl font-semibold tabular-nums">{money(total)}</div>
						<div class="mt-0.5 text-xs text-slate-500">{rows.length} payment(s)</div>
						{#if rows.length > 0}
							<button class="mt-1 text-xs text-brand-600 hover:underline" onclick={() => toggleExpand(key)}>
								{isOpen(key) ? 'Hide' : 'Show'}
							</button>
							{#if isOpen(key)}
								<ul class="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
									{#each rows as t (t.id)}
										<li class="flex items-center gap-2 px-2 py-1 text-xs">
											<span class="w-16 shrink-0 text-slate-500">{t.date}</span>
											<span class="flex-1 truncate">{t.payee}</span>
											<span class="shrink-0 tabular-nums">{money(t.amount)}</span>
										</li>
									{/each}
								</ul>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- State Q1–Q4 -->
		<div>
			<div class="mb-2 flex items-baseline gap-2">
				<span class="text-sm font-semibold text-slate-700 dark:text-slate-300">State</span>
				<span class="text-xs text-slate-500">Dept. of Revenue · state return equivalent</span>
			</div>
			<div class="grid gap-3 sm:grid-cols-4">
				{#each [1, 2, 3, 4] as const as q (q)}
					{@const key = `seq-${q}`}
					{@const rows = stateQuarterlyTotals[q]}
					{@const total = sumAbs(rows)}
					<div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
						<div class="section-label">Q{q}</div>
						<div class="mt-1 text-xl font-semibold tabular-nums">{money(total)}</div>
						<div class="mt-0.5 text-xs text-slate-500">{rows.length} payment(s)</div>
						{#if rows.length > 0}
							<button class="mt-1 text-xs text-brand-600 hover:underline" onclick={() => toggleExpand(key)}>
								{isOpen(key) ? 'Hide' : 'Show'}
							</button>
							{#if isOpen(key)}
								<ul class="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
									{#each rows as t (t.id)}
										<li class="flex items-center gap-2 px-2 py-1 text-xs">
											<span class="w-16 shrink-0 text-slate-500">{t.date}</span>
											<span class="flex-1 truncate">{t.payee}</span>
											<span class="shrink-0 tabular-nums">{money(t.amount)}</span>
										</li>
									{/each}
								</ul>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Retirement & HSA contributions -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-3 flex items-start justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">Retirement &amp; HSA contributions</h2>
				<p class="mt-1 text-xs text-slate-500">
					Tag a transaction with one of these categories every time you contribute. Deductible amounts feed Schedule 1; Roth is informational.
				</p>
			</div>
			<div class="text-right">
				<div class="text-2xl font-semibold tabular-nums text-brand-500">{money(retirementDeductibleTotal)}</div>
				<div class="text-xs text-slate-500">deductible YTD</div>
			</div>
		</div>
		<div class="grid gap-3 sm:grid-cols-2">
			{#each retirementBuckets as b (b.plan.categoryName)}
				{@const key = `ret-${b.plan.categoryName}`}
				{@const pct = b.plan.limit > 0 ? Math.min(100, (b.total / b.plan.limit) * 100) : 0}
				{@const over = b.total > b.plan.limit}
				<div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
					<div class="flex items-start justify-between gap-2">
						<div>
							<div class="flex items-center gap-2 font-medium">
								{#if b.category}
									<span style="color:{b.category.color}"><Icon name={b.category.icon} size={16} /></span>
								{/if}
								{b.plan.label}
								{#if b.plan.deductible}
									<span class="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/20 dark:text-brand-100">Deductible</span>
								{:else}
									<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">Info</span>
								{/if}
							</div>
							<div class="mt-0.5 text-xs text-slate-500">{b.plan.schedule}</div>
						</div>
						<div class="shrink-0 text-right">
							<div class="text-xl font-semibold tabular-nums">{money(b.total)}</div>
							<div class="text-xs text-slate-500">{b.txs.length} payment(s)</div>
						</div>
					</div>
					<div class="mt-3">
						<div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
							<div
								class="h-full {over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-brand-500'}"
								style="width:{pct}%"
							></div>
						</div>
						<div class="mt-1 text-[11px] text-slate-500">{b.plan.limitNote}</div>
					</div>
					{#if b.txs.length > 0}
						<button class="mt-2 text-xs text-brand-600 hover:underline" onclick={() => toggleExpand(key)}>
							{isOpen(key) ? 'Hide' : 'Show'} transactions
						</button>
						{#if isOpen(key)}
							<ul class="mt-2 max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
								{#each b.txs as t (t.id)}
									{@const r = renderTxRow(t)}
									<li class="flex items-center gap-2 px-2 py-1 text-xs">
										<span class="w-20 shrink-0 text-slate-500">{t.date}</span>
										<span class="flex-1 truncate">{t.payee || '(no payee)'}</span>
										<span class="w-20 shrink-0 truncate text-slate-500">{r.acct?.name ?? ''}</span>
										<span class="w-20 shrink-0 text-right tabular-nums">{money(t.amount)}</span>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- College & education expenses -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-3 flex items-start justify-between gap-2">
			<div>
				<h2 class="text-lg font-semibold">College &amp; education expenses</h2>
				<p class="mt-1 text-xs text-slate-500">Form 8863 — American Opportunity Credit &amp; Lifetime Learning Credit. Qualifying expenses: tuition, fees, books, supplies, and required equipment.</p>
			</div>
			<div class="text-right">
				<div class="text-2xl font-semibold tabular-nums">{money(educationTotal)}</div>
				<div class="text-xs text-slate-500">{educationTxs.length} expense(s)</div>
			</div>
		</div>

		{#if educationTxs.length > 0}
			<!-- Summary rows by type -->
			<div class="mb-3 grid gap-2 sm:grid-cols-2">
				{#each [
					{ key: 'tuition',   label: 'Tuition & Fees',  txs: educationByType.tuition },
					{ key: 'books',     label: 'Books',           txs: educationByType.books },
					{ key: 'supplies',  label: 'Supplies',        txs: educationByType.supplies },
					{ key: 'equipment', label: 'Equipment',       txs: educationByType.equipment },
					{ key: 'edu-other', label: 'Other',           txs: educationByType.other },
				] as row (row.key)}
					{#if row.txs.length > 0}
						{@const subkey = `edu-${row.key}`}
						<div class="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
							<button
								class="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
								onclick={() => toggleExpand(subkey)}
							>
								<span class="text-sm font-medium">{row.label}</span>
								<div class="flex items-center gap-3">
									<span class="tabular-nums text-sm">{money(sumAbs(row.txs))}</span>
									<span class="text-xs text-slate-400">{isOpen(subkey) ? '−' : '+'}</span>
								</div>
							</button>
							{#if isOpen(subkey)}
								<ul class="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
									{#each row.txs as t (t.id)}
										{@const r = renderTxRow(t)}
										<li class="flex items-center gap-2 px-3 py-1.5 text-xs">
											<span class="w-24 shrink-0 text-slate-500">{formatDate(t.date)}</span>
											<span class="flex-1 truncate">{t.payee || '(no payee)'}</span>
											<span class="w-24 shrink-0 truncate text-slate-500">{r.cat?.name ?? ''}</span>
											<span class="w-24 shrink-0 text-right tabular-nums">{money(t.amount)}</span>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
			<p class="text-[11px] text-slate-500">
				AOC max credit: $2,500 (first 4 years). LLC max credit: $2,000 (20% of first $10,000). Cannot claim both in the same year.
			</p>
		{:else}
			<p class="text-sm text-slate-500">
				No education expenses detected for {year}. Tag transactions with a category containing "Tuition", "Education", "College", or similar to populate this section.
			</p>
		{/if}
	</section>

	<!-- FreeTaxUSA handoff banner -->
	<section class="rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-500/30 dark:bg-brand-500/10">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0 flex-1">
				<h2 class="text-lg font-semibold text-brand-700 dark:text-brand-200">Ready for FreeTaxUSA</h2>
				<p class="mt-1 text-sm text-brand-700/80 dark:text-brand-200/80">
					Type the numbers above into the matching screens in FreeTaxUSA, or download the
					worksheet below to keep a clean reference open while you fill out your return.
				</p>
			</div>
			<button
				type="button"
				onclick={exportFreeTaxUSA}
				class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
				style="background: var(--bs-text); color: var(--bs-bg);"
			>
				<Icon name="general/download-01" size={14} />
				Export to FreeTaxUSA
			</button>
		</div>
		<div class="mt-3 rounded-lg border border-brand-200/60 bg-white/50 px-4 py-3 text-xs text-brand-800/70 dark:border-brand-500/20 dark:bg-slate-900/40 dark:text-brand-200/60">
			<span class="font-semibold">Heads up:</span> The figures on this page are estimates based on how your transactions are categorized — they're a helpful starting point, not a guarantee. IRS definitions can be nuanced, and not every transaction that looks like a deduction will qualify. Review each amount against your actual receipts and statements, apply your own judgment, and consult a tax professional if you're unsure.
		</div>
	</section>
</div>

<!-- Mileage quick-add modal -->
{#if showMileageForm}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm md:items-center md:p-4" role="dialog" aria-modal="true" onclick={() => (showMileageForm = false)} onkeydown={(e) => e.key === 'Escape' && (showMileageForm = false)} tabindex="-1">
		<div class="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl md:rounded-2xl dark:bg-slate-900" onclick={(e) => e.stopPropagation()} role="document" onkeydown={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
				<h2 class="text-lg font-semibold">Log miles</h2>
				<button type="button" onclick={() => (showMileageForm = false)} class="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">✕</button>
			</div>
			<form onsubmit={saveMileage} class="space-y-4 px-5 py-4">
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="m-date" class="mb-1 block text-sm font-medium">Date</label>
						<input id="m-date" type="date" bind:value={mileageForm.date} class="w-full" required />
					</div>
					<div>
						<label for="m-miles" class="mb-1 block text-sm font-medium">Miles</label>
						<input id="m-miles" type="number" inputmode="decimal" step="0.1" min="0" bind:value={mileageForm.miles} use:clearOnFocus class="w-full" required />
					</div>
				</div>
				<div>
					<div class="mb-1 block text-sm font-medium">Kind</div>
					<div class="flex rounded-md border border-slate-300 dark:border-slate-700">
						{#each ['business', 'medical', 'charity'] as const as k (k)}
							<button
								type="button"
								class="flex-1 py-2 text-sm font-medium capitalize first:rounded-l-md last:rounded-r-md {mileageForm.kind === k
									? 'bg-brand-500 text-white'
									: 'bg-transparent text-slate-700 dark:text-slate-300'}"
								onclick={() => (mileageForm.kind = k)}
							>
								{k}
							</button>
						{/each}
					</div>
					<p class="mt-1 text-xs text-slate-500">
						Rate: {(mileageRate(year, mileageForm.kind) * 100).toFixed(0)}¢/mi · deduction:
						<span class="font-medium tabular-nums">{money((Number(mileageForm.miles) || 0) * mileageRate(year, mileageForm.kind))}</span>
					</p>
				</div>
				{#if mileageForm.kind === 'business' && businesses.value.length > 0}
					<div>
						<label for="m-biz" class="mb-1 block text-sm font-medium">Business (optional)</label>
						<select id="m-biz" bind:value={mileageForm.businessId} class="w-full">
							<option value={null}>— None —</option>
							{#each businesses.value as b (b.id)}
								<option value={b.id}>{b.name}</option>
							{/each}
						</select>
					</div>
				{/if}
				<div>
					<label for="m-purpose" class="mb-1 block text-sm font-medium">Purpose</label>
					<input id="m-purpose" type="text" bind:value={mileageForm.purpose} placeholder="e.g. Client meeting in SF" class="w-full" />
				</div>
				<div>
					<label for="m-notes" class="mb-1 block text-sm font-medium">Notes</label>
					<textarea id="m-notes" bind:value={mileageForm.notes} rows="2" class="w-full"></textarea>
				</div>
			</form>
			<div class="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
				<Button variant="secondary" onclick={() => (showMileageForm = false)}>Cancel</Button>
				<Button onclick={saveMileage}>Save</Button>
			</div>
		</div>
	</div>
{/if}
