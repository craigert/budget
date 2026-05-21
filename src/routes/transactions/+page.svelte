<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Account, Business, Category, Transaction } from '$lib/db/types';
	import { money, formatDate, todayISO, thisMonth, monthLabel } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ReceiptLightbox from '$lib/components/ReceiptLightbox.svelte';
	import BusinessFormModal from '$lib/components/BusinessFormModal.svelte';
	import AddTransactionsToBusinessModal from '$lib/components/AddTransactionsToBusinessModal.svelte';
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

<PageHeader title="Transactions" subtitle={`${filtered.length} shown · net ${money(totalShown)}`}>
	{#snippet actions()}
		{#if businesses.value.length > 0 && businessFilter !== null && filtered.length > 0}
			<Button variant="secondary" onclick={exportCSV}>Export CSV</Button>
		{/if}
		{#if businesses.value.length > 0}
			<Button variant="secondary" onclick={() => (showAddTxModal = true)}>+ Add to business</Button>
		{/if}
		<Button variant="secondary" onclick={openAddBusiness}>+ New business</Button>
		<Button variant="onbrand" onclick={openCreate} disabled={accounts.value.length === 0}>+ Transaction</Button>
	{/snippet}
</PageHeader>

<div class="space-y-4 p-4 md:p-8">

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
		<ul class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
			{#each shown as t (t.id)}
				{@const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : null}
				{@const acct = accountMap.get(t.accountId)}
				{@const biz = t.businessId != null ? businessMap.get(t.businessId) : null}
				<li data-tx-id={t.id} class="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base"
						style="background:{cat?.color ?? '#94a3b8'}22;color:{cat?.color ?? '#475569'}"
					>
						{#if cat?.icon}<Icon name={cat.icon} size={20} />{:else}<span>·</span>{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<div class="truncate font-medium">{t.payee || '(no payee)'}</div>
							<div class="shrink-0 font-semibold tabular-nums {t.amount < 0 ? 'text-slate-900 dark:text-slate-100' : 'text-emerald-600 dark:text-emerald-400'}">
								{money(t.amount)}
							</div>
						</div>
						<div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
							<span>{formatDate(t.date)}</span>
							<span aria-hidden>·</span>
							<span class="truncate">{cat?.name ?? 'Uncategorized'}</span>
							<span aria-hidden>·</span>
							<span class="truncate">{acct?.name ?? '?'}</span>
							{#if t.cleared === 0}
								<span class="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">pending</span>
							{/if}
							{#if biz}
								<span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style="background:{biz.color}22;color:{biz.color}">
									<Icon name={biz.icon} size={10} />
									{biz.name}
								</span>
							{/if}
						</div>
						{#if t.notes}
							<div class="mt-0.5 truncate text-xs text-slate-500">{t.notes}</div>
						{/if}
					</div>
					<div class="flex shrink-0 items-center gap-1">
						{#if businesses.value.length > 0}
							<select
								class="shrink-0 text-xs"
								value={t.businessId ?? ''}
								onchange={(e) => {
									const v = (e.currentTarget as HTMLSelectElement).value;
									reassignTransaction(t, v === '' ? null : Number(v));
								}}
								aria-label="Assign business"
							>
								<option value="">Personal</option>
								{#each businesses.value as b (b.id)}
									<option value={b.id}>{b.name}</option>
								{/each}
							</select>
						{/if}
						{#if t.receiptBlob}
							<button
								class="rounded-md p-1.5 text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800"
								onclick={() => { lightboxBlob = t.receiptBlob ?? null; lightboxTitle = t.payee || formatDate(t.date); }}
								aria-label="View receipt"
								title="View receipt"
							>
								<Icon name="images/camera" size={16} />
							</button>
						{/if}
						<button
							class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
							onclick={() => openEdit(t)}
							aria-label="Edit"
						>
							<Icon name="general/edit-01" size={16} />
						</button>
						<button
							class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
							onclick={() => remove(t)}
							aria-label="Delete"
						>
							<Icon name="general/trash-01" size={16} />
						</button>
					</div>
				</li>
			{/each}
		</ul>

		{#if filtered.length > visibleCount}
			<div class="flex justify-center">
				<Button variant="secondary" onclick={loadMore}>Load more ({filtered.length - visibleCount} left)</Button>
			</div>
		{/if}
	{/if}
</div>

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
