<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Account, Business, Category, Transaction } from '$lib/db/types';
	import { money, formatDate, todayISO, thisMonth, monthLabel } from '$lib/utils/format';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ReceiptLightbox from '$lib/components/ReceiptLightbox.svelte';
	import BusinessFormModal from '$lib/components/BusinessFormModal.svelte';
	import AddTransactionsToBusinessModal from '$lib/components/AddTransactionsToBusinessModal.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import ScreenTitle from '$lib/components/ScreenTitle.svelte';

	type SignFilter = 'all' | 'spend' | 'income';
	let signFilter = $state<SignFilter>('all');
	let showAdvanced = $state(false);
	import { compressImage } from '$lib/utils/image';
	import { scanReceiptWithAzure } from '$lib/utils/receiptOcr';
	import { clearOnFocus } from '$lib/actions/clearOnFocus';

	const accounts = live<Account[]>(() => db.accounts.toArray(), []);
	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const businesses = live<Business[]>(
		() =>
			db.businesses
				.where('archived')
				.equals(0)
				.toArray()
				.then((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder)),
		[]
	);
	const txs = live<Transaction[]>(
		() => db.transactions.orderBy('date').reverse().toArray(),
		[]
	);

	const accountMap = $derived(new Map(accounts.value.map((a) => [a.id!, a])));
	const categoryMap = $derived(new Map(categories.value.map((c) => [c.id!, c])));
	const businessMap = $derived(new Map(businesses.value.map((b) => [b.id!, b])));

	// Business filter: null = all transactions, 'all' = all business-tagged, number = specific business
	let businessFilter = $state<null | 'all' | number>(null);

	// Text / account / category / date filters
	let q = $state(page.url.searchParams.get('q') ?? '');
	$effect(() => {
		const initial = page.url.searchParams.get('q');
		if (initial && initial !== q) q = initial;
	});
	let accountFilter = $state<number | ''>('');
	let categoryFilter = $state<number | ''>('');
	let fromDate = $state('');
	let toDate = $state('');
	let pageSize = $state(50);
	let visibleCount = $state(50);

	// ?highlight=<txId>: scroll into view + flash
	let highlightId = $state<number | null>(null);
	$effect(() => {
		const raw = page.url.searchParams.get('highlight');
		const id = raw ? Number(raw) : null;
		if (!id || Number.isNaN(id)) return;
		highlightId = id;
	});
	$effect(() => {
		if (highlightId == null) return;
		const inList = shown.some((t) => t.id === highlightId);
		if (!inList) {
			const idx = filtered.findIndex((t) => t.id === highlightId);
			if (idx >= 0 && idx >= visibleCount) visibleCount = idx + 25;
			return;
		}
		requestAnimationFrame(() => {
			const el = document.querySelector<HTMLElement>(`[data-tx-id="${highlightId}"]`);
			if (!el) return;
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			el.classList.add('tx-flash');
			setTimeout(() => el.classList.remove('tx-flash'), 2400);
			highlightId = null;
		});
	});

	// Scoped set (business filter only) — used for KPI tiles
	const scoped = $derived.by(() => {
		if (businessFilter === null) return txs.value;
		if (businessFilter === 'all') return txs.value.filter((t) => t.businessId != null);
		return txs.value.filter((t) => t.businessId === businessFilter);
	});

	const filtered = $derived.by(() => {
		const qq = q.trim().toLowerCase();
		return txs.value.filter((t) => {
			if (signFilter === 'spend' && t.amount >= 0) return false;
			if (signFilter === 'income' && t.amount <= 0) return false;
			if (businessFilter === 'all' && t.businessId == null) return false;
			if (typeof businessFilter === 'number' && t.businessId !== businessFilter) return false;
			if (accountFilter !== '' && t.accountId !== accountFilter) return false;
			if (categoryFilter !== '' && t.categoryId !== categoryFilter) return false;
			if (fromDate && t.date < fromDate) return false;
			if (toDate && t.date > toDate) return false;
			if (qq) {
				const hay = `${t.payee} ${t.notes}`.toLowerCase();
				if (!hay.includes(qq)) return false;
			}
			return true;
		});
	});

	const shown = $derived(filtered.slice(0, visibleCount));
	const totalShown = $derived(filtered.reduce((sum, t) => sum + t.amount, 0));

	/* Mobile-only: group the shown list by relative date label so we can
	   render Today / Yesterday / "May 24" / Earlier sections per the design
	   screenshot. `shown` is already sorted date DESC (newest first) by the
	   base Dexie query, so we just key the Map by label and let insertion
	   order drive section order — Today appears first when present, then
	   Yesterday, then the most recent specific date, etc. */
	function dateBucketLabel(iso: string): string {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const [y, m, d] = iso.split('-').map(Number);
		const tx = new Date(y, m - 1, d);
		const diffDays = Math.round((today.getTime() - tx.getTime()) / 86400000);
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays > 1 && diffDays < 30) {
			return tx.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		}
		return 'Earlier';
	}

	const groupedShown = $derived.by(() => {
		const map = new Map<string, { label: string; items: Transaction[] }>();
		for (const t of shown) {
			const label = dateBucketLabel(t.date);
			if (!map.has(label)) map.set(label, { label, items: [] });
			map.get(label)!.items.push(t);
		}
		return Array.from(map.values());
	});

	function initial(name: string): string {
		const c = (name || '?').trim().charAt(0).toUpperCase();
		return c || '?';
	}

	function resetFilters() {
		q = '';
		accountFilter = '';
		categoryFilter = '';
		fromDate = '';
		toDate = '';
		visibleCount = pageSize;
	}

	// KPI tiles (shown when a business filter is active)
	const now = thisMonth();
	const monthStart = `${now}-01`;
	const monthEnd = `${now}-32`;
	const ytdStart = $derived(`${now.slice(0, 4)}-01-01`);
	const ytdEnd = $derived(`${now.slice(0, 4)}-12-31`);

	const monthIncome = $derived(
		scoped.filter((t) => t.amount > 0 && t.date >= monthStart && t.date <= monthEnd)
			.reduce((s, t) => s + t.amount, 0)
	);
	const monthExpense = $derived(
		scoped.filter((t) => t.amount < 0 && t.date >= monthStart && t.date <= monthEnd)
			.reduce((s, t) => s + -t.amount, 0)
	);
	const ytdIncome = $derived(
		scoped.filter((t) => t.amount > 0 && t.date >= ytdStart && t.date <= ytdEnd)
			.reduce((s, t) => s + t.amount, 0)
	);
	const ytdExpense = $derived(
		scoped.filter((t) => t.amount < 0 && t.date >= ytdStart && t.date <= ytdEnd)
			.reduce((s, t) => s + -t.amount, 0)
	);

	// Per-business counts for pill badges
	const bizTotals = $derived.by(() => {
		const map = new Map<number, { count: number }>();
		for (const t of txs.value) {
			if (t.businessId == null) continue;
			const entry = map.get(t.businessId) ?? { count: 0 };
			entry.count++;
			map.set(t.businessId, entry);
		}
		return map;
	});

	const businessTaggedCount = $derived(txs.value.filter((t) => t.businessId != null).length);
	const selectedBiz = $derived(
		typeof businessFilter === 'number' ? (businessMap.get(businessFilter) ?? null) : null
	);

	// Business management
	let showBizModal = $state(false);
	let editingBiz = $state<Business | null>(null);
	let showAddTxModal = $state(false);

	function openAddBusiness() {
		editingBiz = null;
		showBizModal = true;
	}
	function openEditBusiness(b: Business) {
		editingBiz = b;
		showBizModal = true;
	}
	async function archiveBusiness(b: Business) {
		if (!b.id) return;
		const count = await db.transactions
			.toArray()
			.then((all) => all.filter((t) => t.businessId === b.id).length);
		const msg = count
			? `Archive "${b.name}"? ${count} transaction(s) will become unassigned.`
			: `Archive "${b.name}"?`;
		if (!confirm(msg)) return;
		await db.transaction('rw', [db.businesses, db.transactions], async () => {
			if (count) {
				await db.transactions.toCollection().modify((t) => {
					if (t.businessId === b.id) t.businessId = null;
				});
			}
			await db.businesses.update(b.id!, { archived: 1 });
		});
		if (businessFilter === b.id) businessFilter = null;
	}

	async function reassignTransaction(t: Transaction, bizId: number | null) {
		if (!t.id) return;
		await db.transactions.update(t.id, { businessId: bizId });
	}

	function exportCSV() {
		const headers = ['Date', 'Account', 'Business', 'Category', 'Payee', 'Expense', 'Income', 'Notes'];
		const escape = (s: unknown) => {
			const str = s == null ? '' : String(s);
			return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
		};
		const lines = [headers.join(',')];
		for (const t of filtered) {
			const acct = accountMap.get(t.accountId)?.name ?? '';
			const cat = t.categoryId != null ? categoryMap.get(t.categoryId)?.name ?? '' : '';
			const biz = t.businessId != null ? businessMap.get(t.businessId)?.name ?? '' : '';
			const expense = t.amount < 0 ? (-t.amount).toFixed(2) : '';
			const income = t.amount > 0 ? t.amount.toFixed(2) : '';
			lines.push(
				[t.date, escape(acct), escape(biz), escape(cat), escape(t.payee), expense, income, escape(t.notes)].join(',')
			);
		}
		const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const tag =
			businessFilter === 'all'
				? 'all-businesses'
				: selectedBiz
					? selectedBiz.name.toLowerCase().replace(/\s+/g, '-')
					: 'transactions';
		a.download = `${tag}-${now}.csv`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	// Transaction edit form
	let showModal = $state(false);
	let editing = $state<Transaction | null>(null);
	let form = $state({
		date: todayISO(),
		accountId: 0,
		categoryId: null as number | null,
		amount: 0,
		isExpense: true,
		payee: '',
		notes: '',
		cleared: true,
		businessId: null as number | null,
		receiptBlob: null as Blob | null
	});

	// Receipt capture
	let receiptInput: HTMLInputElement | undefined = $state();
	let receiptObjectUrl = $state<string | null>(null);
	let receiptBusy = $state(false);
	let receiptScanStatus = $state<{ ok: boolean; message: string } | null>(null);

	$effect(() => {
		const blob = form.receiptBlob;
		if (!blob) {
			if (receiptObjectUrl) URL.revokeObjectURL(receiptObjectUrl);
			receiptObjectUrl = null;
			return;
		}
		const url = URL.createObjectURL(blob);
		receiptObjectUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	async function onPickReceipt(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		receiptBusy = true;
		receiptScanStatus = null;
		try {
			const compressed = await compressImage(file).catch((err) => {
				console.warn('Receipt compress failed, using raw file', err);
				return file;
			});
			form.receiptBlob = compressed;
			receiptScanStatus = { ok: true, message: 'Scanning receipt…' };
			try {
				const result = await scanReceiptWithAzure(compressed);
				const parts: string[] = [];
				if (result.merchant && !form.payee.trim()) {
					form.payee = result.merchant;
					parts.push(`payee → ${result.merchant}`);
				}
				if (typeof result.total === 'number' && result.total > 0 && form.amount === 0) {
					form.amount = result.total;
					parts.push(`amount → $${result.total.toFixed(2)}`);
				}
				if (result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
					form.date = result.date;
					parts.push(`date → ${result.date}`);
				}
				receiptScanStatus = parts.length
					? { ok: true, message: `Filled ${parts.join(', ')}. Confirm before saving.` }
					: { ok: true, message: 'Receipt scanned, but no fields could be extracted. Fill in manually.' };
			} catch (err) {
				const message = (err as Error).message;
				if (/not configured/i.test(message)) {
					receiptScanStatus = null;
				} else {
					receiptScanStatus = { ok: false, message: `OCR failed: ${message}` };
				}
			}
		} finally {
			receiptBusy = false;
		}
	}

	function removeReceipt() {
		form.receiptBlob = null;
		receiptScanStatus = null;
	}

	function openCreate() {
		editing = null;
		form = {
			date: todayISO(),
			accountId: accounts.value[0]?.id ?? 0,
			categoryId: null,
			amount: 0,
			isExpense: true,
			payee: '',
			notes: '',
			cleared: true,
			businessId: typeof businessFilter === 'number' ? businessFilter : null,
			receiptBlob: null
		};
		receiptScanStatus = null;
		showModal = true;
	}

	function openEdit(t: Transaction) {
		editing = t;
		form = {
			date: t.date,
			accountId: t.accountId,
			categoryId: t.categoryId,
			amount: Math.abs(t.amount),
			isExpense: t.amount < 0,
			payee: t.payee,
			notes: t.notes,
			cleared: t.cleared === 1,
			businessId: t.businessId ?? null,
			receiptBlob: t.receiptBlob ?? null
		};
		receiptScanStatus = null;
		showModal = true;
	}

	async function save(e: Event) {
		e.preventDefault();
		if (!form.accountId) return;
		const signed = form.isExpense ? -Math.abs(form.amount) : Math.abs(form.amount);
		const payload = {
			date: form.date,
			accountId: form.accountId,
			categoryId: form.categoryId,
			amount: Number(signed) || 0,
			payee: form.payee.trim(),
			notes: form.notes.trim(),
			cleared: form.cleared ? 1 : 0,
			businessId: form.businessId,
			receiptBlob: form.receiptBlob
		};
		if (editing?.id) {
			await db.transactions.update(editing.id, payload);
		} else {
			await db.transactions.add({ ...payload, createdAt: Date.now() } as Transaction);
		}
		showModal = false;
	}

	async function remove(t: Transaction) {
		if (!t.id) return;
		if (!confirm(`Delete "${t.payee || 'transaction'}"?`)) return;
		await db.transactions.delete(t.id);
	}

	function loadMore() {
		visibleCount += pageSize;
	}

	// auto-switch isExpense based on category kind
	$effect(() => {
		if (form.categoryId == null) return;
		const cat = categoryMap.get(form.categoryId);
		if (cat) form.isExpense = cat.kind === 'expense';
	});

	// Lightbox
	let lightboxBlob = $state<Blob | null>(null);
	let lightboxTitle = $state('');
</script>

<ScreenTitle
	title="Transactions"
	eyebrow={`All accounts · ${monthLabel(now).split(' ')[0]}`}
>
	{#snippet actions()}
		<button
			type="button"
			class="bs-screen-action"
			onclick={() => (showAdvanced = !showAdvanced)}
			aria-pressed={showAdvanced}
		>
			{showAdvanced ? 'Hide filters' : 'More filters'}
		</button>
		<Button variant="onbrand" onclick={openCreate} disabled={accounts.value.length === 0}>+ Transaction</Button>
	{/snippet}
</ScreenTitle>

<!-- Mobile-only search bar. Desktop has the same search reachable from
     the TopNav, so we don't duplicate it there. -->
<label class="bs-tx-search-mobile">
	<Icon name="general/search-md" size={15} />
	<input
		type="search"
		bind:value={q}
		placeholder="Search transactions"
		aria-label="Search transactions"
	/>
</label>

<!-- Sign filter pills — the headline filter from the design's DTransactions.
     Each section below is a direct child of the layout's .bs-tab-content so
     the universal stagger animation reveals them in order. -->
<div class="bs-filter-row">
		{#each [{ id: 'all' as const, label: 'All' }, { id: 'spend' as const, label: 'Spending' }, { id: 'income' as const, label: 'Income' }] as f (f.id)}
			<button
				type="button"
				class="bs-filter-pill"
				class:active={signFilter === f.id}
				onclick={() => (signFilter = f.id)}
			>{f.label}</button>
		{/each}
	</div>

	<!-- Advanced controls — hidden by default per the design's clean view.
	     Toggle from the "More filters" button in the header. -->
	{#if showAdvanced}
	<!-- Business filter pills (only when businesses exist) -->
	{#if businesses.value.length > 0}
		<div class="flex flex-wrap items-center gap-2">
			<button
				class="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors {businessFilter === null
					? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
					: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}"
				onclick={() => (businessFilter = null)}
			>
				All transactions
			</button>
			<button
				class="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors {businessFilter === 'all'
					? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
					: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}"
				onclick={() => (businessFilter = 'all')}
			>
				<span>All businesses</span>
				<span class="rounded-full bg-slate-200 px-1.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">{businessTaggedCount}</span>
			</button>
			{#each businesses.value as b (b.id)}
				<button
					class="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors {businessFilter === b.id
						? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
						: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}"
					onclick={() => (businessFilter = b.id!)}
				>
					<span style="color:{b.color}"><Icon name={b.icon} size={14} /></span>
					<span>{b.name}</span>
					<span class="rounded-full bg-slate-200 px-1.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">{bizTotals.get(b.id!)?.count ?? 0}</span>
				</button>
			{/each}
			{#if selectedBiz}
				<button
					class="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
					onclick={() => openEditBusiness(selectedBiz!)}
				>Edit</button>
				<button
					class="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
					onclick={() => archiveBusiness(selectedBiz!)}
				>Archive</button>
			{/if}
		</div>
	{/if}

	<!-- KPI tiles (shown when a business filter is active) -->
	{#if businessFilter !== null}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">Income · {monthLabel(now)}</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums text-brand-500">{money(monthIncome)}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">Expenses · {monthLabel(now)}</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums">{money(monthExpense)}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">Income · YTD</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums text-brand-500">{money(ytdIncome)}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">Net · YTD</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums {ytdIncome - ytdExpense < 0 ? 'text-red-600' : ''}">{money(ytdIncome - ytdExpense)}</div>
			</div>
		</div>
	{/if}

	<!-- Filter bar -->
	<div class="grid gap-2 md:grid-cols-6">
		<input type="search" bind:value={q} placeholder="Search payee or notes" class="md:col-span-2" />
		<select bind:value={accountFilter}>
			<option value="">All accounts</option>
			{#each accounts.value.filter((a) => a.archived === 0) as a (a.id)}
				<option value={a.id}>{a.name}</option>
			{/each}
		</select>
		<select bind:value={categoryFilter}>
			<option value="">All categories</option>
			{#each categories.value.filter((c) => c.archived === 0) as c (c.id)}
				<option value={c.id}>{c.name}</option>
			{/each}
		</select>
		<input type="date" bind:value={fromDate} aria-label="From date" />
		<input type="date" bind:value={toDate} aria-label="To date" />
	</div>
	<div class="flex items-center gap-2 text-sm">
		<button class="text-slate-500 hover:underline" onclick={resetFilters}>Clear filters</button>
	</div>
	{/if}

	{#if accounts.value.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
			Create an account first, then log transactions.
		</div>
	{:else if filtered.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
			{#if businessFilter !== null && scoped.length === 0}
				{#if selectedBiz}
					No transactions tagged to <strong>{selectedBiz.name}</strong> yet. Edit a transaction and assign it to this business.
				{:else}
					No business-tagged transactions yet.
				{/if}
			{:else}
				No transactions match.
			{/if}
		</div>
	{:else}
		<!-- Mobile (<768): grouped-by-date cards per the design screenshot.
		     Each bucket (Today / Yesterday / "May 24" / Earlier) gets its
		     own white card with a small italic Fraunces header above. Soft
		     category-color monogram chips instead of the brand-color BrandMark. -->
		<div class="bs-tx-groups">
			{#each groupedShown as g (g.label)}
				<section class="bs-tx-group">
					<h2 class="bs-tx-group-label">{g.label}</h2>
					<ul class="bs-tx-group-card">
						{#each g.items as t (t.id)}
							{@const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : null}
							{@const color = cat?.color ?? 'var(--bs-text-3)'}
							{@const pos = t.amount > 0}
							{@const biz = t.businessId != null ? businessMap.get(t.businessId) : null}
							<li data-tx-id={t.id} class="bs-tx-mobile-li">
								<button
									type="button"
									class="bs-tx-mobile-row"
									onclick={() => openEdit(t)}
									aria-label="Edit transaction"
								>
									<div class="bs-tx-mobile-main">
										<span
											class="bs-tx-mobile-chip"
											style="background: color-mix(in oklch, {color} 16%, transparent); color: {color};"
										>{initial(t.payee || cat?.name || '')}</span>
										<div class="bs-tx-mobile-text">
											<div class="bs-tx-mobile-name">{t.payee || '(no payee)'}</div>
											<div class="bs-tx-mobile-sub">
												{cat?.name ?? 'Uncategorized'} · {formatDate(t.date)}
											</div>
										</div>
										<span
											class="bs-tx-mobile-amount"
											style="color: {pos ? 'var(--bs-pos)' : 'var(--bs-text)'};"
										>
											{pos ? '+' : '−'}{money(Math.abs(t.amount))}
										</span>
									</div>
									{#if biz}
										<span
											class="bs-tx-mobile-biz"
											style="background: color-mix(in oklch, {biz.color} 18%, transparent); color: {biz.color};"
										>
											<Icon name={biz.icon} size={10} />
											{biz.name}
										</span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>

		<!-- Desktop (>=768): table card. Each row uses the merchant brand mark
		     from BrandMark, category icon chip, italic-Fraunces amount aligned
		     right. Click to open the existing edit modal so all the legacy
		     add/edit/business/receipt logic stays functional underneath. -->
		<div class="bs-tx-card">
			<div class="bs-tx-header">
				<span>Merchant</span>
				<span>Category</span>
				<span>Account</span>
				<span style="text-align: right;">Amount</span>
			</div>
		<ul class="bs-tx-list">
			{#each shown as t (t.id)}
				{@const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : null}
				{@const acct = accountMap.get(t.accountId)}
				{@const biz = t.businessId != null ? businessMap.get(t.businessId) : null}
				<li data-tx-id={t.id} class="bs-tx-li" class:bs-tx-li-first={false}>
					<button
						type="button"
						class="bs-tx-row"
						onclick={() => openEdit(t)}
						aria-label="Edit transaction"
					>
						<div class="bs-tx-merchant">
							<BrandMark name={t.payee || cat?.name || 'Transaction'} size={38} radius={12} />
							<div class="bs-tx-merchant-text">
								<div class="bs-tx-merchant-name">{t.payee || '(no payee)'}</div>
								<div class="bs-tx-merchant-sub">{formatDate(t.date)}</div>
							</div>
						</div>
						<div class="bs-tx-category">
							{#if cat}
								<span class="bs-tx-cat-icon" style="background: color-mix(in oklch, {cat.color} 15%, transparent); color: {cat.color};">
									{#if cat.icon}<Icon name={cat.icon} size={11} />{/if}
								</span>
								<span class="bs-tx-cat-label">{cat.name}</span>
							{:else}
								<span class="bs-tx-cat-label" style="color: var(--bs-text-3);">Uncategorized</span>
							{/if}
						</div>
						<div class="bs-tx-account">{acct?.name ?? '?'}</div>
						<div class="bs-tx-amount" style="color: {t.amount > 0 ? 'var(--bs-pos)' : 'var(--bs-text)'};">
							{t.amount > 0 ? '+' : '−'}{money(Math.abs(t.amount))}
						</div>
						{#if biz}
							<span class="bs-tx-biz-tag" style="background: color-mix(in oklch, {biz.color} 18%, transparent); color: {biz.color};">
								<Icon name={biz.icon} size={10} />
								{biz.name}
							</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
		</div>

		{#if filtered.length > visibleCount}
			<div class="flex justify-center">
				<Button variant="secondary" onclick={loadMore}>Load more ({filtered.length - visibleCount} left)</Button>
			</div>
		{/if}
	{/if}

<Modal
	open={showModal}
	title={editing ? 'Edit transaction' : 'New transaction'}
	onclose={() => (showModal = false)}
>
	<form id="tx-form" onsubmit={save} class="space-y-4">
		<div class="flex rounded-md border border-slate-300 dark:border-slate-700">
			<button
				type="button"
				class="flex-1 rounded-l-md py-2 text-sm font-medium {form.isExpense ? 'bg-red-500 text-white' : 'bg-transparent text-slate-700 dark:text-slate-300'}"
				onclick={() => (form.isExpense = true)}
			>Expense</button>
			<button
				type="button"
				class="flex-1 rounded-r-md py-2 text-sm font-medium {!form.isExpense ? 'bg-emerald-500 text-white' : 'bg-transparent text-slate-700 dark:text-slate-300'}"
				onclick={() => (form.isExpense = false)}
			>Income</button>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="tx-date" class="mb-1 block text-sm font-medium">Date</label>
				<input id="tx-date" type="date" bind:value={form.date} class="w-full" required />
			</div>
			<div>
				<label for="tx-amount" class="mb-1 block text-sm font-medium">Amount</label>
				<div class="relative">
					<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">$</span>
					<input id="tx-amount" type="number" inputmode="decimal" step="0.01" min="0" bind:value={form.amount} use:clearOnFocus class="w-full pl-6" required />
				</div>
			</div>
		</div>

		<div>
			<label for="tx-account" class="mb-1 block text-sm font-medium">Account</label>
			<select id="tx-account" bind:value={form.accountId} class="w-full" required>
				{#each accounts.value.filter((a) => a.archived === 0) as a (a.id)}
					<option value={a.id}>{a.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="tx-cat" class="mb-1 block text-sm font-medium">Category</label>
			<select id="tx-cat" bind:value={form.categoryId} class="w-full">
				<option value={null}>Uncategorized</option>
				{#each categories.value.filter((c) => c.archived === 0 && c.kind === (form.isExpense ? 'expense' : 'income')) as c (c.id)}
					<option value={c.id}>{c.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="tx-payee" class="mb-1 block text-sm font-medium">Payee</label>
			<input id="tx-payee" type="text" bind:value={form.payee} class="w-full" placeholder="e.g. Trader Joe's" />
		</div>

		<div>
			<label for="tx-notes" class="mb-1 block text-sm font-medium">Notes</label>
			<textarea id="tx-notes" bind:value={form.notes} class="w-full" rows="2"></textarea>
		</div>

		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={form.cleared} class="rounded" />
			Cleared (transaction has posted)
		</label>

		{#if businesses.value.length > 0}
			<div>
				<label for="tx-biz" class="mb-1 block text-sm font-medium">Business</label>
				<select id="tx-biz" bind:value={form.businessId} class="w-full">
					<option value={null}>— Personal —</option>
					{#each businesses.value as b (b.id)}
						<option value={b.id}>{b.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<!-- Receipt photo: mobile-only -->
		<div class="md:hidden">
			<div class="mb-1 block text-sm font-medium">Receipt</div>
			{#if form.receiptBlob && receiptObjectUrl}
				<div class="flex items-start gap-3">
					<button
						type="button"
						onclick={() => { if (form.receiptBlob) { lightboxBlob = form.receiptBlob; lightboxTitle = form.payee || 'Receipt'; } }}
						class="block h-24 w-24 shrink-0 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
						aria-label="View receipt"
					>
						<img src={receiptObjectUrl} alt="" class="h-full w-full object-cover" />
					</button>
					<div class="flex flex-col gap-2">
						<Button size="sm" variant="secondary" onclick={() => receiptInput?.click()} disabled={receiptBusy}>Replace</Button>
						<Button size="sm" variant="ghost" onclick={removeReceipt} disabled={receiptBusy}>Remove</Button>
					</div>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => receiptInput?.click()}
					disabled={receiptBusy}
					class="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-600 transition-colors hover:border-brand-500 hover:text-brand-600 active:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:active:bg-slate-800"
				>
					<Icon name="images/camera" size={18} />
					{receiptBusy ? 'Processing…' : 'Take or upload receipt'}
				</button>
			{/if}
			<input bind:this={receiptInput} type="file" accept="image/*" capture="environment" class="hidden" onchange={onPickReceipt} />
			{#if receiptScanStatus}
				<p class="mt-2 rounded-md border px-3 py-2 text-xs {receiptScanStatus.ok ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'}">
					{receiptScanStatus.message}
				</p>
			{/if}
		</div>
	</form>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showModal = false)}>Cancel</Button>
		<Button type="submit" onclick={save}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Modal>

<BusinessFormModal open={showBizModal} editing={editingBiz} onclose={() => (showBizModal = false)} />

<AddTransactionsToBusinessModal
	open={showAddTxModal}
	businesses={businesses.value}
	defaultBusinessId={typeof businessFilter === 'number' ? businessFilter : null}
	onclose={() => (showAddTxModal = false)}
	ontagged={(_count, bizId) => { businessFilter = bizId; }}
/>

<ReceiptLightbox blob={lightboxBlob} title={lightboxTitle} onclose={() => (lightboxBlob = null)} />

<style>
	/* Layout's .bs-tab-content provides flex column + gap; pages just
	   render sections as direct children. */

	.bs-filter-row {
		display: flex;
		gap: 8px;
	}
	:global(.bs-filter-pill) {
		padding: 8px 16px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 500;
		color: var(--bs-text-2);
		background: var(--bs-surface);
		border: 1px solid var(--bs-border);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
		transition: background 160ms, color 160ms, transform 0.05s ease;
	}
	:global(.bs-filter-pill:hover) {
		color: var(--bs-text);
	}
	:global(.bs-filter-pill.active) {
		background: var(--bs-panel, var(--bs-text));
		color: var(--bs-panel-tx, var(--bs-bg));
		border-color: transparent;
		box-shadow: none;
	}
	:global(.bs-filter-pill:active) {
		transform: scale(0.97);
	}

	:global(.bs-screen-action) {
		padding: 7px 14px;
		border-radius: 999px;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--bs-text-2);
		background: var(--bs-surface);
		border: 1px solid var(--bs-border);
		transition: background 140ms, color 140ms;
	}
	:global(.bs-screen-action:hover) {
		background: var(--bs-surface-2);
		color: var(--bs-text);
	}

	/* ── Mobile search bar (matches the screenshot's full-width pill) ─── */
	.bs-tx-search-mobile {
		display: none;
		align-items: center;
		gap: 10px;
		padding: 11px 16px;
		background: var(--bs-surface);
		border: 1px solid var(--bs-border);
		border-radius: 999px;
		color: var(--bs-text-3);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}
	.bs-tx-search-mobile input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		color: var(--bs-text);
		font-family: var(--bs-font-sans);
		font-size: 14px;
		padding: 0;
		box-shadow: none;
		border-radius: 0;
	}
	.bs-tx-search-mobile input::placeholder {
		color: var(--bs-text-3);
	}
	@media (max-width: 767px) {
		.bs-tx-search-mobile {
			display: flex;
		}
	}

	/* ── Mobile grouped layout (Today / Yesterday / May 24 / Earlier) ─── */
	.bs-tx-groups {
		display: none;
		flex-direction: column;
		gap: 18px;
	}
	.bs-tx-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.bs-tx-group-label {
		margin: 0 4px;
		font-family: var(--bs-font-serif);
		font-style: italic;
		font-weight: 400;
		font-size: 16px;
		color: var(--bs-text);
		letter-spacing: -0.005em;
	}
	.bs-tx-group-card {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--bs-surface);
		border-radius: 18px;
		overflow: hidden;
		box-shadow: 0 1px 2px rgba(26, 20, 8, 0.04), 0 6px 18px rgba(26, 20, 8, 0.05);
	}
	.bs-tx-mobile-li + .bs-tx-mobile-li {
		border-top: 1px solid var(--bs-border);
	}
	.bs-tx-mobile-row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		padding: 12px 14px;
		background: transparent;
		border: none;
		text-align: left;
		transition: background 120ms ease;
	}
	.bs-tx-mobile-row:hover {
		background: color-mix(in oklch, var(--bs-text) 3%, var(--bs-surface));
	}
	.bs-tx-mobile-main {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
	}
	.bs-tx-mobile-biz {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 10.5px;
		font-weight: 500;
		/* Indent past the chip (38px) + gap (12px) so it aligns with the
		   merchant name above. */
		margin-left: 50px;
	}
	.bs-tx-mobile-chip {
		flex-shrink: 0;
		width: 38px;
		height: 38px;
		border-radius: 10px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--bs-font-sans);
		font-weight: 600;
		font-size: 15px;
		letter-spacing: -0.02em;
	}
	.bs-tx-mobile-text {
		flex: 1;
		min-width: 0;
	}
	.bs-tx-mobile-name {
		font-size: 14.5px;
		font-weight: 600;
		color: var(--bs-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bs-tx-mobile-sub {
		font-size: 12px;
		color: var(--bs-text-3);
		margin-top: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bs-tx-mobile-amount {
		flex-shrink: 0;
		font-family: var(--bs-font-serif);
		font-style: italic;
		font-size: 16px;
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 767px) {
		.bs-tx-groups {
			display: flex;
		}
		.bs-tx-card {
			display: none;
		}
	}

	/* ── Table card ──────────────────────────────────────────────────── */
	.bs-tx-card {
		background: var(--bs-surface);
		border-radius: 20px;
		overflow: hidden;
		box-shadow: 0 1px 2px rgba(26, 20, 8, 0.04), 0 6px 20px rgba(26, 20, 8, 0.05);
	}
	.bs-tx-header {
		display: grid;
		grid-template-columns: 2.2fr 1.2fr 1fr 0.9fr;
		padding: 14px 24px;
		font-size: 11.5px;
		color: var(--bs-text-3);
		font-weight: 500;
		text-transform: capitalize;
		border-bottom: 1px solid var(--bs-border);
	}
	@media (max-width: 720px) {
		.bs-tx-header {
			display: none;
		}
	}
	.bs-tx-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.bs-tx-li {
		border-top: 1px solid var(--bs-border);
	}
	.bs-tx-li:first-child {
		border-top: none;
	}
	.bs-tx-row {
		display: grid;
		grid-template-columns: 2.2fr 1.2fr 1fr 0.9fr;
		align-items: center;
		padding: 13px 24px;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		transition: background 0.12s ease;
		gap: 12px;
	}
	.bs-tx-row:hover {
		background: color-mix(in oklch, var(--bs-text) 3%, var(--bs-surface));
	}
	.bs-tx-row:active {
		transform: scale(0.997);
	}
	@media (max-width: 720px) {
		.bs-tx-row {
			grid-template-columns: auto 1fr auto;
			grid-template-areas:
				'mark merchant amount'
				'mark category category';
			padding: 12px 16px;
			row-gap: 4px;
		}
		.bs-tx-account {
			display: none;
		}
		.bs-tx-merchant {
			grid-area: merchant;
		}
		.bs-tx-category {
			grid-area: category;
		}
		.bs-tx-amount {
			grid-area: amount;
		}
	}

	.bs-tx-merchant {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.bs-tx-merchant-text {
		min-width: 0;
	}
	.bs-tx-merchant-name {
		font-size: 14px;
		font-weight: 500;
		color: var(--bs-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bs-tx-merchant-sub {
		font-size: 11.5px;
		color: var(--bs-text-3);
		margin-top: 2px;
	}
	.bs-tx-category {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 12.5px;
		color: var(--bs-text-2);
		min-width: 0;
	}
	.bs-tx-cat-icon {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.bs-tx-cat-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bs-tx-account {
		font-size: 12.5px;
		color: var(--bs-text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bs-tx-amount {
		font-family: var(--bs-font-serif);
		font-style: italic;
		font-size: 16px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.bs-tx-biz-tag {
		grid-column: 1 / -1;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 7px;
		border-radius: 999px;
		font-size: 10.5px;
		font-weight: 500;
		justify-self: start;
		margin-top: 4px;
	}
</style>
