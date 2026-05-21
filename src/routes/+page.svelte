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
	import { rollingMonthlySeries } from '$lib/utils/netWorthSeries';
	import { base } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Donut from '$lib/components/Donut.svelte';
	import NetWorthChart from '$lib/components/NetWorthChart.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const month = thisMonth();
	// Previous month, for vs-last-month deltas
	const prevMonth = $derived.by(() => {
		const [y, m] = month.split('-').map(Number);
		const d = new Date(y, m - 2, 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	});

	const nw = live<number>(() => netWorth(), 0);
	const inc = live<number>(() => incomeForMonth(month), 0);
	const exp = live<number>(() => expensesForMonth(month), 0);
	const incPrev = live<number>(() => incomeForMonth(prevMonth), 0);
	const expPrev = live<number>(() => expensesForMonth(prevMonth), 0);
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
	const allAccounts = live<Account[]>(() => db.accounts.toArray(), []);
	const allTxs = live<Transaction[]>(() => db.transactions.toArray(), []);

	// Rolling 12 months of monthly snapshots so the chart's range filter
	// (1M / 3M / 6M / YTD / 1Y / All) has real data behind every option.
	const networthPoints = $derived(rollingMonthlySeries(allAccounts.value, allTxs.value, 12));

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

	// Financial-health metric: savings rate = (income - expense) / income.
	const savedThisMonth = $derived(inc.value - exp.value);
	const savingsRate = $derived(inc.value > 0 ? (savedThisMonth / inc.value) * 100 : 0);
	const healthScore = $derived.by(() => {
		// Translate savings rate into a 0–100 score with light shaping so 20%
		// (the 50/30/20 rule's savings band) reads as "Excellent" ~80.
		if (inc.value <= 0) return 0;
		if (savedThisMonth < 0) return Math.max(0, 50 + savingsRate); // negative pulls below 50
		// Cap at 100; 20% saving = 80, 30% = 95, 40% = 100.
		return Math.min(100, Math.round(50 + savingsRate * 1.5));
	});
	const healthLabel = $derived.by(() => {
		if (inc.value <= 0) return 'Set income';
		if (savedThisMonth < 0) return 'Overspending';
		if (savingsRate >= 20) return 'Excellent';
		if (savingsRate >= 10) return 'Good';
		return 'Tight';
	});

	// Vs-last-month deltas for the KPI chips
	const incDelta = $derived(inc.value - incPrev.value);
	const expDelta = $derived(exp.value - expPrev.value);

	// Greeting hero
	const now = new Date();
	const hour = now.getHours();
	const greeting =
		hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
	const dayLabel = `${monthLabel(month).toUpperCase()} · DAY ${now.getDate()}`;
	// Display name — pulled from settings if user has set one; otherwise greeting
	// stands alone with an exclamation point.
	const displayName = live<string | null>(
		async () => {
			const s = await db.settings.get('displayName');
			return typeof s?.value === 'string' && s.value.trim() ? s.value.trim() : null;
		},
		null
	);

	// Savings pace — projects current spending forward to a full-month figure.
	const today = now.getDate();
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	const projectedSavings = $derived.by(() => {
		if (inc.value <= 0 || today <= 0) return 0;
		const ratio = daysInMonth / today;
		return Math.round((inc.value - exp.value * ratio + (inc.value * ratio - inc.value)) * 100) / 100;
	});
	const prevSaved = $derived(incPrev.value - expPrev.value);
	const paceDelta = $derived(prevSaved !== 0 ? ((projectedSavings - prevSaved) / Math.abs(prevSaved)) * 100 : 0);
</script>

<PageHeader title="Home" eyebrow={monthLabel(month).toUpperCase()}>
	{#snippet actions()}
		<a
			href="{base}/transactions"
			class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
			style="background: var(--bs-text); color: var(--bs-bg);"
		>
			<Icon name="general/plus" size={14} />
			Add transaction
		</a>
	{/snippet}
</PageHeader>

<div class="space-y-6 p-4 md:p-8">
	<!--
		Greeting hero. Per the design's screen-home.jsx:
		- Backdrop: 120° linear-gradient(brand-soft → accent-soft) — uses the
		  pre-mixed soft variants from the palette, NOT a runtime color-mix.
		- Eyebrow: 11px / 600 / 0.10em tracking / brand color (NOT text-3).
		- Title: 34px / 500 / -0.03em on desktop, 26px on mobile. Name is
		  italic Geist colored with --bs-brand.
		- Body: 14px text-2 with --bs-pos colored mono money inline.
		- Sparrow logo on the right: 170px desktop, drop-shadow filter.
	-->
	<section
		class="bs-hero relative overflow-hidden flex flex-wrap items-center gap-6"
		style="border: 0.5px solid var(--bs-border); border-radius: var(--bs-radius); padding: 20px 18px; box-shadow: var(--bs-shadow);"
	>
		<div class="relative z-[1] flex-1 min-w-[240px]">
			<div
				class="mb-1.5"
				style="font-size: 11px; font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase; color: var(--bs-brand);"
			>
				{dayLabel}
			</div>
			<h2
				class="m-0"
				style="font-family: var(--bs-font-display); font-size: 26px; font-weight: 500; letter-spacing: -0.03em; line-height: 1.05; color: var(--bs-text);"
			>
				{greeting}{#if displayName.value}, <span style="color: var(--bs-brand); font-style: italic; font-family: var(--bs-font-serif); font-weight: 400;">{displayName.value}</span>.{:else}!{/if}
			</h2>
			<p
				class="mt-2.5 max-w-[520px]"
				style="font-size: 13px; line-height: 1.5; letter-spacing: -0.005em; color: var(--bs-text-2);"
			>
				{#if inc.value > 0}
					{#if projectedSavings >= 0}
						You're on pace to save
						<span class="bs-mono" style="color: var(--bs-pos); font-weight: 600;">{money(projectedSavings)}</span>
						this month
						{#if Math.abs(paceDelta) > 1 && prevSaved !== 0}
							— <span style="color: var(--bs-text);">{paceDelta >= 0 ? `${paceDelta.toFixed(0)}% ahead` : `${Math.abs(paceDelta).toFixed(0)}% behind`}</span> of {monthLabel(prevMonth)}.
						{:else}
							.
						{/if}
					{:else}
						You're trending
						<span class="bs-mono" style="color: var(--bs-neg); font-weight: 600;">{money(Math.abs(projectedSavings))} short</span>
						this month — time to revisit the budget.
					{/if}
				{:else}
					Log some income for {monthLabel(month)} and we'll start tracking your savings pace.
				{/if}
			</p>
			<div class="mt-4 flex flex-wrap gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full"
					style="padding: 5px 10px; background: color-mix(in oklch, var(--bs-pos) 14%, transparent); color: var(--bs-pos); font-size: 11.5px; font-weight: 500;"
				>
					<Icon name="charts/trend-up" size={12} />
					{savingsRate >= 10 ? 'Strong savings rate' : 'Building savings'}
				</span>
				<span
					class="inline-flex items-center gap-1.5 rounded-full"
					style="padding: 5px 10px; background: color-mix(in oklch, var(--bs-accent) 12%, transparent); color: var(--bs-accent); font-size: 11.5px; font-weight: 500;"
				>
					<Icon name="general/target-04" size={12} />
					{accounts.value.length} account{accounts.value.length === 1 ? '' : 's'} tracked
				</span>
			</div>
		</div>
		<div
			class="relative shrink-0 hidden md:flex items-center justify-center"
			style="width: 170px; height: 170px;"
		>
			<img
				src="{base}/logo-hero.png"
				alt=""
				aria-hidden="true"
				class="w-full h-full object-contain"
				style="filter: drop-shadow(0 6px 16px rgba(40, 30, 12, 0.18));"
			/>
		</div>
	</section>

	<!--
		KPI tiles per design/components.jsx Stat:
		- 11px / 500 / 0.04em uppercase section label (via .section-label)
		- 30px / 500 value with -0.025em tracking (via .bs-kpi)
		- delta tag: tonal background at 12-14% color-mix, 12px text, tabular-nums
	-->
	<div class="grid gap-4 sm:grid-cols-3">
		<div class="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
			<div class="mb-3.5 flex items-center justify-between">
				<span class="section-label">Income</span>
				<span class="h-2 w-2 rounded-full" style="background: var(--bs-pos); opacity: 0.7;"></span>
			</div>
			<div class="bs-kpi" style="color: var(--bs-pos);">{money(inc.value)}</div>
			{#if incPrev.value > 0}
				<div class="mt-2.5 flex items-center gap-2" style="font-size: 12px;">
					<span
						class="bs-tag bs-mono"
						style="background: color-mix(in oklch, {incDelta >= 0 ? 'var(--bs-pos)' : 'var(--bs-neg)'} 12%, transparent); color: {incDelta >= 0 ? 'var(--bs-pos)' : 'var(--bs-neg)'};"
					>
						{incDelta >= 0 ? '↑' : '↓'} {money(Math.abs(incDelta))}
					</span>
					<span style="color: var(--bs-text-2);">vs. {monthLabel(prevMonth).split(' ')[0]}</span>
				</div>
			{/if}
		</div>
		<div class="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
			<div class="mb-3.5 flex items-center justify-between">
				<span class="section-label">Spending</span>
				<span class="h-2 w-2 rounded-full" style="background: var(--bs-neg); opacity: 0.7;"></span>
			</div>
			<div class="bs-kpi">{money(exp.value)}</div>
			{#if expPrev.value > 0}
				<div class="mt-2.5 flex items-center gap-2" style="font-size: 12px;">
					<span
						class="bs-tag bs-mono"
						style="background: color-mix(in oklch, {expDelta <= 0 ? 'var(--bs-pos)' : 'var(--bs-neg)'} 12%, transparent); color: {expDelta <= 0 ? 'var(--bs-pos)' : 'var(--bs-neg)'};"
					>
						{expDelta <= 0 ? '↓' : '↑'} {money(Math.abs(expDelta))}
					</span>
					<span style="color: var(--bs-text-2);">vs. {monthLabel(prevMonth).split(' ')[0]}</span>
				</div>
			{/if}
		</div>
		<div class="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
			<div class="mb-3.5 flex items-center justify-between">
				<span class="section-label">Financial health</span>
				<span
					class="bs-tag"
					style="background: color-mix(in oklch, var(--bs-pos) 12%, transparent); color: var(--bs-pos);"
				>
					{healthLabel}
				</span>
			</div>
			<div class="flex items-baseline gap-2">
				<span class="bs-kpi">{healthScore}</span>
				<span class="bs-mono" style="font-size: 14px; color: var(--bs-text-3);">/100</span>
			</div>
			<div
				class="mt-3 h-1 w-full overflow-hidden rounded-full"
				style="background: color-mix(in oklch, var(--bs-text-3) 18%, transparent);"
			>
				<div
					class="h-full rounded-full transition-all"
					style="width: {Math.max(2, Math.min(100, healthScore))}%; background: var(--bs-pos);"
				></div>
			</div>
			<div class="mt-2.5" style="font-size: 12px; color: var(--bs-text-2);">
				{#if inc.value > 0}
					{savedThisMonth >= 0 ? 'Saved' : 'Overspent'} <span class="bs-mono" style="color: var(--bs-text);">{money(Math.abs(savedThisMonth))}</span> this month
				{:else}
					Log some income to see your savings rate
				{/if}
			</div>
		</div>
	</div>

	<!-- Net worth over the year -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
		<NetWorthChart points={networthPoints} />
	</section>

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Spending donut -->
		<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
			<div class="mb-4 flex items-baseline justify-between">
				<div>
					<h2 class="text-base font-semibold" style="color: var(--bs-text);">Where money went</h2>
					<p class="text-xs" style="color: var(--bs-text-2);">{monthLabel(month)}</p>
				</div>
				<a
					href="{base}/budgets"
					class="text-sm transition-opacity hover:opacity-80"
					style="color: var(--bs-brand);"
				>
					All →
				</a>
			</div>
			<Donut slices={slices} centerLabel="spent" centerValue={money(exp.value)} />
		</section>

		<!-- Recent transactions -->
		<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
			<div class="mb-4 flex items-baseline justify-between">
				<div>
					<h2 class="text-base font-semibold" style="color: var(--bs-text);">Recent transactions</h2>
					<p class="text-xs" style="color: var(--bs-text-2);">Last 7 days</p>
				</div>
				<a
					href="{base}/transactions"
					class="text-sm transition-opacity hover:opacity-80"
					style="color: var(--bs-brand);"
				>
					View all →
				</a>
			</div>
			{#if recent.value.length === 0}
				<p class="py-6 text-center text-sm" style="color: var(--bs-text-2);">Nothing logged yet.</p>
			{:else}
				<ul class="divide-y" style="border-color: var(--bs-border);">
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
								<div class="truncate text-sm font-medium" style="color: var(--bs-text);">{t.payee || c?.name || 'Transaction'}</div>
								<div class="text-xs" style="color: var(--bs-text-3);">
									{formatDate(t.date)} · {accountMap.get(t.accountId)?.name ?? '?'}
								</div>
							</div>
							<div class="shrink-0 text-sm font-semibold tabular-nums" style="color: {t.amount > 0 ? 'var(--bs-pos)' : 'var(--bs-text)'};">
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
				<h2 class="text-base font-semibold" style="color: var(--bs-text);">Accounts</h2>
				<a
					href="{base}/accounts"
					class="text-sm transition-opacity hover:opacity-80"
					style="color: var(--bs-brand);"
				>
					Manage →
				</a>
			</div>
			<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				{#each accounts.value as a (a.id)}
					{@const bal = balances.value.get(a.id!) ?? a.openingBalance}
					<li
						class="flex items-center justify-between rounded-lg px-3 py-2"
						style="border: 0.5px solid var(--bs-border);"
					>
						<span class="truncate text-sm" style="color: var(--bs-text);">{a.name}</span>
						<span class="shrink-0 text-sm font-medium tabular-nums" style="color: {bal < 0 ? 'var(--bs-neg)' : 'var(--bs-text)'};">{money(bal)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	/*
	 * Greeting hero — soft brand→accent gradient backdrop. Keeps the warm
	 * jungle feel while remaining airy enough to set off the dark title text.
	 * In dark mode the gradient is much darker so it doesn't blow out.
	 */
	.bs-hero {
		background:
			linear-gradient(
				135deg,
				color-mix(in oklch, var(--bs-brand) 14%, var(--bs-surface)) 0%,
				color-mix(in oklch, var(--bs-accent) 12%, var(--bs-surface)) 60%,
				color-mix(in oklch, var(--bs-brand-tint, var(--bs-surface)) 100%, transparent) 100%
			);
		box-shadow: var(--bs-shadow);
	}
	:global(.dark) .bs-hero {
		background: linear-gradient(
			135deg,
			color-mix(in oklch, var(--bs-brand) 22%, var(--bs-surface)) 0%,
			color-mix(in oklch, var(--bs-accent) 20%, var(--bs-surface)) 100%
		);
	}
</style>
