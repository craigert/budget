<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Account, Business, Category, Transaction } from '$lib/db/types';
	import { money, formatDate, thisMonth, monthLabel } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import BusinessFormModal from '$lib/components/BusinessFormModal.svelte';

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
		() =>
			db.transactions
				.toArray()
				.then((arr) =>
					arr
						.filter((t) => t.businessId != null)
						.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
				),
		[]
	);

	const accountMap = $derived(new Map(accounts.value.map((a) => [a.id!, a])));
	const categoryMap = $derived(new Map(categories.value.map((c) => [c.id!, c])));
	const businessMap = $derived(new Map(businesses.value.map((b) => [b.id!, b])));

	// Selected business: number = id, or 'all' = aggregate of all businesses
	let selected = $state<number | 'all'>('all');

	// Filters
	let q = $state('');
	let fromDate = $state('');
	let toDate = $state('');
	let pageSize = $state(50);
	let visibleCount = $state(50);

	const scoped = $derived.by(() => {
		if (selected === 'all') return txs.value;
		return txs.value.filter((t) => t.businessId === selected);
	});

	const filtered = $derived.by(() => {
		const qq = q.trim().toLowerCase();
		return scoped.filter((t) => {
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

	function resetFilters() {
		q = '';
		fromDate = '';
		toDate = '';
		visibleCount = pageSize;
	}
	function loadMore() {
		visibleCount += pageSize;
	}

	const now = thisMonth();
	const monthStart = `${now}-01`;
	const monthEnd = `${now}-32`;
	const ytdStart = $derived(`${now.slice(0, 4)}-01-01`);
	const ytdEnd = $derived(`${now.slice(0, 4)}-12-31`);

	const monthIncome = $derived(
		scoped
			.filter((t) => t.amount > 0 && t.date >= monthStart && t.date <= monthEnd)
			.reduce((s, t) => s + t.amount, 0)
	);
	const monthExpense = $derived(
		scoped
			.filter((t) => t.amount < 0 && t.date >= monthStart && t.date <= monthEnd)
			.reduce((s, t) => s + -t.amount, 0)
	);
	const ytdIncome = $derived(
		scoped
			.filter((t) => t.amount > 0 && t.date >= ytdStart && t.date <= ytdEnd)
			.reduce((s, t) => s + t.amount, 0)
	);
	const ytdExpense = $derived(
		scoped
			.filter((t) => t.amount < 0 && t.date >= ytdStart && t.date <= ytdEnd)
			.reduce((s, t) => s + -t.amount, 0)
	);

	// Business management
	let showBizModal = $state(false);
	let editingBiz = $state<Business | null>(null);

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
		const count = await db.transactions.toArray().then((all) => all.filter((t) => t.businessId === b.id).length);
		const msg = count
			? `Archive "${b.name}"? ${count} transaction(s) will become Unassigned (kept, but no longer tagged to this business).`
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
		if (selected === b.id) selected = 'all';
	}

	async function untagTransaction(t: Transaction) {
		if (!t.id) return;
		await db.transactions.update(t.id, { businessId: null });
	}

	async function reassignTransaction(t: Transaction, businessId: number | null) {
		if (!t.id) return;
		await db.transactions.update(t.id, { businessId });
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
		const tag = selected === 'all' ? 'all' : (businessMap.get(selected)?.name ?? 'business').toLowerCase().replace(/\s+/g, '-');
		a.download = `business-${tag}-${thisMonth()}.csv`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	const selectedBiz = $derived(selected === 'all' ? null : businessMap.get(selected) ?? null);

	const bizTotals = $derived.by(() => {
		const map = new Map<number, { income: number; expense: number; count: number }>();
		for (const t of txs.value) {
			if (t.businessId == null) continue;
			const entry = map.get(t.businessId) ?? { income: 0, expense: 0, count: 0 };
			if (t.amount > 0) entry.income += t.amount;
			else entry.expense += -t.amount;
			entry.count++;
			map.set(t.businessId, entry);
		}
		return map;
	});
</script>

<PageHeader title="Business" subtitle={selectedBiz ? selectedBiz.name : 'All businesses'}>
	{#snippet actions()}
		<Button variant="onbrand" size="sm" onclick={openAddBusiness}>+ New business</Button>
		{#if selectedBiz}
			<Button variant="onbrand" size="sm" onclick={() => openEditBusiness(selectedBiz)}>Edit</Button>
		{/if}
		<Button variant="onbrand" size="sm" onclick={exportCSV} disabled={filtered.length === 0}>Export CSV</Button>
	{/snippet}
</PageHeader>

<div class="space-y-6 p-4 md:p-8">
	<!-- Business pills -->
	<div class="flex flex-wrap gap-2">
		<button
			class="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors {selected === 'all'
				? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
				: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}"
			onclick={() => (selected = 'all')}
		>
			<span>All</span>
			<span class="rounded-full bg-slate-200 px-1.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">{txs.value.length}</span>
		</button>
		{#each businesses.value as b (b.id)}
			{@const totals = bizTotals.get(b.id!)}
			<button
				class="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors {selected === b.id
					? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
					: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}"
				onclick={() => (selected = b.id!)}
			>
				<span style="color:{b.color}"><Icon name={b.icon} size={14} /></span>
				<span>{b.name}</span>
				<span class="rounded-full bg-slate-200 px-1.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">{totals?.count ?? 0}</span>
			</button>
		{/each}
	</div>

	{#if businesses.value.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
			<p class="font-medium">No businesses yet.</p>
			<p class="mt-2 text-sm">Create one to start tagging transactions.</p>
			<div class="mt-4">
				<Button onclick={openAddBusiness}>+ New business</Button>
			</div>
		</div>
	{:else}
		<!-- KPI tiles for selected scope -->
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">Income · {monthLabel(now)}</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums text-brand-500">{money(monthIncome)}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">Expense · {monthLabel(now)}</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums">{money(monthExpense)}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">Income · YTD</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums text-brand-500">{money(ytdIncome)}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">Net · YTD</div>
				<div class="mt-1 text-2xl font-semibold tabular-nums {ytdIncome - ytdExpense < 0 ? 'text-red-600' : ''}">
					{money(ytdIncome - ytdExpense)}
				</div>
			</div>
		</div>

		<!-- Filters -->
		<div class="grid gap-2 md:grid-cols-4">
			<input type="search" bind:value={q} placeholder="Search payee or notes" class="md:col-span-2" />
			<input type="date" bind:value={fromDate} aria-label="From date" />
			<input type="date" bind:value={toDate} aria-label="To date" />
		</div>
		<div class="flex items-center gap-2 text-sm">
			<button class="text-slate-500 hover:underline" onclick={resetFilters}>Clear filters</button>
			<span class="text-slate-400">·</span>
			<span class="text-slate-500">{filtered.length} of {scoped.length} transactions</span>
			{#if selectedBiz}
				<span class="text-slate-400">·</span>
				<button class="text-red-600 hover:underline" onclick={() => archiveBusiness(selectedBiz!)}>Archive "{selectedBiz.name}"</button>
			{/if}
		</div>

		{#if scoped.length === 0}
			<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
				{#if selectedBiz}
					<p>No transactions tagged to <strong>{selectedBiz.name}</strong> yet.</p>
					<p class="mt-2 text-sm">Edit a transaction and pick this business from the dropdown to tag it.</p>
				{:else}
					<p>No business-tagged transactions.</p>
				{/if}
			</div>
		{:else if filtered.length === 0}
			<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
				No transactions match.
			</div>
		{:else}
			<ul class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
				{#each shown as t (t.id)}
					{@const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : null}
					{@const acct = accountMap.get(t.accountId)}
					{@const biz = t.businessId != null ? businessMap.get(t.businessId) : null}
					<li class="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base"
							style="background:{cat?.color ?? '#94a3b8'}22;color:{cat?.color ?? '#475569'}"
						>
							{#if cat?.icon}<Icon name={cat.icon} size={20} />{:else}<span>·</span>{/if}
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline justify-between gap-2">
								<div class="truncate font-medium">{t.payee || '(no payee)'}</div>
								<div
									class="shrink-0 font-semibold tabular-nums {t.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}"
								>
									{money(t.amount)}
								</div>
							</div>
							<div class="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
								<span>{formatDate(t.date)}</span>
								<span aria-hidden>·</span>
								<span class="truncate">{cat?.name ?? 'Uncategorized'}</span>
								<span aria-hidden>·</span>
								<span class="truncate">{acct?.name ?? '?'}</span>
								{#if selected === 'all' && biz}
									<span aria-hidden>·</span>
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
						<select
							class="shrink-0 text-xs"
							value={t.businessId ?? ''}
							onchange={(e) => {
								const v = (e.currentTarget as HTMLSelectElement).value;
								reassignTransaction(t, v === '' ? null : Number(v));
							}}
							aria-label="Reassign business"
						>
							<option value="">Untag</option>
							{#each businesses.value as b (b.id)}
								<option value={b.id}>{b.name}</option>
							{/each}
						</select>
					</li>
				{/each}
			</ul>

			{#if filtered.length > visibleCount}
				<div class="flex justify-center">
					<Button variant="secondary" onclick={loadMore}>Load more ({filtered.length - visibleCount} left)</Button>
				</div>
			{/if}
		{/if}
	{/if}
</div>

<BusinessFormModal open={showBizModal} editing={editingBiz} onclose={() => (showBizModal = false)} />
