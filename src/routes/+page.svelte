<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import {
		netWorth,
		spendingByCategory,
		incomeForMonth,
		expensesForMonth,
		accountBalances
	} from '$lib/db/queries';
	import type { Account, Category, Transaction } from '$lib/db/types';
	import { money, thisMonth, monthLabel, formatDate } from '$lib/utils/format';
	import { base } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Donut from '$lib/components/Donut.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const month = thisMonth();

	const nw = live<number>(() => netWorth(), 0);
	const inc = live<number>(() => incomeForMonth(month), 0);
	const exp = live<number>(() => expensesForMonth(month), 0);
	const accounts = live<Account[]>(() => db.accounts.where('archived').equals(0).toArray(), []);
	const balances = live<Map<number, number>>(() => accountBalances(), new Map());
	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const spending = live<{ categoryId: number | null; total: number }[]>(
		() => spendingByCategory(month),
		[]
	);
	const recent = live<Transaction[]>(
		() => db.transactions.orderBy('date').reverse().limit(8).toArray(),
		[]
	);

	const catMap = $derived(new Map(categories.value.map((c) => [c.id!, c])));
	const accountMap = $derived(new Map(accounts.value.map((a) => [a.id!, a])));

	const slices = $derived(
		spending.value
			.filter((s) => s.categoryId != null)
			.map((s) => {
				const c = catMap.get(s.categoryId!);
				return {
					label: c?.name ?? 'Uncategorized',
					value: s.total,
					color: c?.color ?? '#94a3b8',
					icon: c?.icon
				};
			})
			.concat(
				spending.value
					.filter((s) => s.categoryId == null)
					.map((s) => ({ label: 'Uncategorized', value: s.total, color: '#94a3b8', icon: '•' }))
			)
	);
</script>

<PageHeader title="Home" subtitle={monthLabel(month)} />

<div class="space-y-6 p-4 md:p-8">
	<!-- KPI tiles -->
	<div class="grid gap-3 sm:grid-cols-3">
		<div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
			<div class="section-label">Net worth</div>
			<div class="mt-1.5 text-3xl font-bold tabular-nums {nw.value < 0 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}">{money(nw.value)}</div>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
			<div class="section-label">Income this month</div>
			<div class="mt-1.5 text-3xl font-bold tabular-nums text-brand-500">{money(inc.value)}</div>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
			<div class="section-label">Spending this month</div>
			<div class="mt-1.5 text-3xl font-bold tabular-nums">{money(exp.value)}</div>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Spending donut -->
		<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
			<h2 class="mb-4 text-lg font-semibold">Where money went</h2>
			<Donut slices={slices} centerLabel="spent" centerValue={money(exp.value)} />
		</section>

		<!-- Recent transactions -->
		<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Recent transactions</h2>
				<a href="{base}/transactions" class="text-sm text-brand-600 hover:underline dark:text-brand-300">View all →</a>
			</div>
			{#if recent.value.length === 0}
				<p class="py-6 text-center text-sm text-slate-500">Nothing logged yet.</p>
			{:else}
				<ul class="divide-y divide-slate-100 dark:divide-slate-800">
					{#each recent.value as t (t.id)}
						{@const c = t.categoryId != null ? catMap.get(t.categoryId) : null}
						<li class="flex items-center gap-3 py-2.5">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
								style="background:{c?.color ?? '#94a3b8'}22;color:{c?.color ?? '#475569'}"
							>
								{#if c?.icon}<Icon name={c.icon} size={18} />{:else}<span>·</span>{/if}
							</div>
							<div class="min-w-0 flex-1">
								<div class="truncate text-sm font-medium">{t.payee || c?.name || 'Transaction'}</div>
								<div class="text-xs text-slate-500">
									{formatDate(t.date)} · {accountMap.get(t.accountId)?.name ?? '?'}
								</div>
							</div>
							<div class="shrink-0 text-sm font-semibold tabular-nums {t.amount > 0 ? 'text-emerald-600' : ''}">
								{money(t.amount)}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<!-- Accounts strip -->
	{#if accounts.value.length > 0}
		<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Accounts</h2>
				<a href="{base}/accounts" class="text-sm text-brand-600 hover:underline dark:text-brand-300">Manage →</a>
			</div>
			<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				{#each accounts.value as a (a.id)}
					{@const bal = balances.value.get(a.id!) ?? a.openingBalance}
					<li class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
						<span class="truncate text-sm">{a.name}</span>
						<span class="shrink-0 text-sm font-medium tabular-nums {bal < 0 ? 'text-red-600' : ''}">{money(bal)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
