<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Account, Category, Transaction } from '$lib/db/types';
	import { money, formatDate, thisMonth, monthLabel, addMonths } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const accounts = live<Account[]>(() => db.accounts.toArray(), []);
	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const txs = live<Transaction[]>(
		() =>
			db.transactions
				.where('isBusiness')
				.equals(1)
				.toArray()
				.then((arr) => arr.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))),
		[]
	);

	const accountMap = $derived(new Map(accounts.value.map((a) => [a.id!, a])));
	const categoryMap = $derived(new Map(categories.value.map((c) => [c.id!, c])));

	// Filters
	let q = $state('');
	let fromDate = $state('');
	let toDate = $state('');
	let pageSize = $state(50);
	let visibleCount = $state(50);

	const filtered = $derived.by(() => {
		const qq = q.trim().toLowerCase();
		return txs.value.filter((t) => {
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

	// Year-to-date and current month KPIs
	const now = thisMonth();
	const monthStart = `${now}-01`;
	const monthEnd = `${now}-32`;

	const ytdStart = $derived(`${now.slice(0, 4)}-01-01`);
	const ytdEnd = $derived(`${now.slice(0, 4)}-12-31`);

	const monthIncome = $derived(
		txs.value
			.filter((t) => t.amount > 0 && t.date >= monthStart && t.date <= monthEnd)
			.reduce((s, t) => s + t.amount, 0)
	);
	const monthExpense = $derived(
		txs.value
			.filter((t) => t.amount < 0 && t.date >= monthStart && t.date <= monthEnd)
			.reduce((s, t) => s + -t.amount, 0)
	);
	const ytdIncome = $derived(
		txs.value
			.filter((t) => t.amount > 0 && t.date >= ytdStart && t.date <= ytdEnd)
			.reduce((s, t) => s + t.amount, 0)
	);
	const ytdExpense = $derived(
		txs.value
			.filter((t) => t.amount < 0 && t.date >= ytdStart && t.date <= ytdEnd)
			.reduce((s, t) => s + -t.amount, 0)
	);

	async function toggleBusiness(t: Transaction) {
		if (!t.id) return;
		const next = t.isBusiness === 1 ? 0 : 1;
		await db.transactions.update(t.id, { isBusiness: next });
	}

	async function bulkAutoTag() {
		const businessAccountIds = new Set(
			accounts.value
				.filter((a) => a.name.toLowerCase().startsWith('business'))
				.map((a) => a.id!)
		);
		const businessCategoryIds = new Set(
			categories.value
				.filter((c) => c.name.toLowerCase() === 'business expenses')
				.map((c) => c.id!)
		);
		const candidates = await db.transactions
			.where('isBusiness')
			.equals(0)
			.toArray();
		let tagged = 0;
		for (const t of candidates) {
			if (
				businessAccountIds.has(t.accountId) ||
				(t.categoryId != null && businessCategoryIds.has(t.categoryId))
			) {
				await db.transactions.update(t.id!, { isBusiness: 1 });
				tagged++;
			}
		}
		if (tagged === 0) alert('Nothing to tag — all matching rows already business.');
	}

	function exportCSV() {
		const headers = ['Date', 'Account', 'Category', 'Payee', 'Expense', 'Income', 'Notes'];
		const escape = (s: unknown) => {
			const str = s == null ? '' : String(s);
			return str.includes(',') || str.includes('"')
				? `"${str.replace(/"/g, '""')}"`
				: str;
		};
		const lines = [headers.join(',')];
		for (const t of filtered) {
			const acct = accountMap.get(t.accountId)?.name ?? '';
			const cat = t.categoryId != null ? categoryMap.get(t.categoryId)?.name ?? '' : '';
			const expense = t.amount < 0 ? (-t.amount).toFixed(2) : '';
			const income = t.amount > 0 ? t.amount.toFixed(2) : '';
			lines.push([t.date, escape(acct), escape(cat), escape(t.payee), expense, income, escape(t.notes)].join(','));
		}
		const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `business-${thisMonth()}.csv`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}
</script>

<PageHeader title="Business" subtitle="Transactions tagged for your business">
	{#snippet actions()}
		<Button variant="onbrand" size="sm" onclick={bulkAutoTag}>Auto-tag matches</Button>
		<Button variant="onbrand" size="sm" onclick={exportCSV} disabled={filtered.length === 0}>Export CSV</Button>
	{/snippet}
</PageHeader>

<div class="space-y-6 p-4 md:p-8">
	<!-- KPI tiles -->
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
		<span class="text-slate-500">{filtered.length} of {txs.value.length} business transactions</span>
	</div>

	{#if txs.value.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
			<p>No transactions are tagged as business yet.</p>
			<p class="mt-2 text-sm">
				Tag rows by editing them and checking "Business transaction", or click
				<button class="text-brand-600 underline" onclick={bulkAutoTag}>Auto-tag matches</button>
				to flag everything in a Business account / Business expenses category.
			</p>
		</div>
	{:else if filtered.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
			No business transactions match.
		</div>
	{:else}
		<ul class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
			{#each shown as t (t.id)}
				{@const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : null}
				{@const acct = accountMap.get(t.accountId)}
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
						</div>
						{#if t.notes}
							<div class="mt-0.5 truncate text-xs text-slate-500">{t.notes}</div>
						{/if}
					</div>
					<button
						class="rounded-md p-1.5 text-brand-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800"
						onclick={() => toggleBusiness(t)}
						aria-label="Remove business tag"
						title="Tagged as business — click to untag"
					>
						<Icon name="general/check-circle" size={16} />
					</button>
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
