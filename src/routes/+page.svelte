<script lang="ts">
	/*
	 * Home — exact recreation of proto/desktop.jsx DHome from the Claude
	 * Design Forest reference (Desktop.html).
	 *
	 *   <DRise delay={40}>  full-width dark hero w/ greeting + 76px net-worth + 3 inline KPIs
	 *   <DRise delay={120}> Sparrow Says insight banner
	 *   <DRise delay={200}> grid(1.7fr 1fr): net-worth chart card + dark goals / brass health stack
	 *   <DRise delay={280}> grid(1fr 1fr): Where money went + Recent activity
	 *
	 * All animations + spacing + typography from the bundle:
	 *   - cards: 20px radius, 22px (or 28px hero) padding, no border, soft shadow
	 *   - hero glow: solid 360x360 rgba(176,120,66,0.16) circle at top:-140 right:-40
	 *   - italic numerals everywhere money appears (Fraunces 400 italic, tabular-nums)
	 *   - Rise stagger 40/120/200/280, MoneyUp 900-1100ms ease-out-cubic, Bar 900ms
	 */
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import {
		netWorth,
		spendingByCategory,
		incomeForMonth,
		expensesForMonth
	} from '$lib/db/queries';
	import { goalCurrent, goalProgress } from '$lib/db/goals';
	import type { Account, Category, Goal, Transaction } from '$lib/db/types';
	import { money, money0, thisMonth, monthLabel, friendlyDate } from '$lib/utils/format';
	import { rollingMonthlySeries } from '$lib/utils/netWorthSeries';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import NetWorthChart from '$lib/components/NetWorthChart.svelte';
	import MoneyUp from '$lib/components/MoneyUp.svelte';
	import Bar from '$lib/components/Bar.svelte';
	import StackBar from '$lib/components/StackBar.svelte';
	import SparrowSays from '$lib/components/SparrowSays.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';

	const month = thisMonth();
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
	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const spending = live<{ categoryId: number | null; total: number }[]>(
		() => spendingByCategory(month),
		[]
	);
	const recent = live<Transaction[]>(
		() => db.transactions.orderBy('date').reverse().limit(6).toArray(),
		[]
	);
	const allAccounts = live<Account[]>(() => db.accounts.toArray(), []);
	const allTxs = live<Transaction[]>(() => db.transactions.toArray(), []);

	type Range = '1M' | '3M' | 'YTD' | '1Y';
	let nwRange = $state<Range>('YTD');

	const networthSeries = $derived(rollingMonthlySeries(allAccounts.value, allTxs.value, 12));
	const networthPoints = $derived.by(() => {
		if (networthSeries.length === 0) return networthSeries;
		const last = networthSeries[networthSeries.length - 1].date;
		const [ly, lm, ld] = last.split('-').map(Number);
		const lastDate = new Date(Date.UTC(ly, lm - 1, ld));
		const cutoff = new Date(lastDate);
		switch (nwRange) {
			case '1M':
				cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
				break;
			case '3M':
				cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
				break;
			case 'YTD':
				cutoff.setUTCMonth(0, 1);
				break;
			case '1Y':
				return networthSeries;
		}
		const cutIso = cutoff.toISOString().slice(0, 10);
		const filtered = networthSeries.filter((p) => p.date >= cutIso);
		// Always keep at least 2 points so there's a line to draw.
		return filtered.length >= 2 ? filtered : networthSeries.slice(-2);
	});
	const catMap = $derived(new Map(categories.value.map((c) => [c.id!, c])));

	const savedThisMonth = $derived(inc.value - exp.value);
	const savingsRate = $derived(inc.value > 0 ? (savedThisMonth / inc.value) * 100 : 0);

	const healthScore = $derived.by(() => {
		if (inc.value <= 0) return 0;
		if (savedThisMonth < 0) return Math.max(0, Math.round(50 + savingsRate));
		return Math.min(100, Math.round(50 + savingsRate * 1.5));
	});

	const incDelta = $derived(inc.value - incPrev.value);
	const expDelta = $derived(exp.value - expPrev.value);
	const savedPrev = $derived(incPrev.value - expPrev.value);
	const ytdDelta = $derived(savedThisMonth - savedPrev);

	const now = new Date();
	const hour = now.getHours();
	const greeting =
		hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
	const dateLabel = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	const displayName = live<string | null>(
		async () => {
			const s = await db.settings.get('displayName');
			return typeof s?.value === 'string' && s.value.trim() ? s.value.trim() : null;
		},
		null
	);
	const heroName = $derived(displayName.value ?? 'Jamie');
	const monthAbbr = monthLabel(month).split(' ')[0];
	const prevMonthAbbr = monthLabel(prevMonth).split(' ')[0];

	const goalRows = live<{ goal: Goal; current: number; pct: number; pace: string }[]>(
		async () => {
			const list = await db.nestEggs.where('archived').equals(0).toArray();
			const rows: { goal: Goal; current: number; pct: number; pace: string }[] = [];
			for (const g of list) {
				const current = await goalCurrent(g);
				const prog = goalProgress(g, current);
				rows.push({ goal: g, current, pct: Math.min(100, Math.max(0, prog.percent)), pace: prog.pace });
			}
			return rows.sort((a, b) => b.pct - a.pct);
		},
		[]
	);
	const onTrackCount = $derived(
		goalRows.value.filter((r) => r.pace === 'ahead' || r.pace === 'on-track' || r.pace === 'complete').length
	);
	const totalGoals = $derived(goalRows.value.length);

	const slices = $derived(
		spending.value
			.filter((s) => s.categoryId != null)
			.map((s) => {
				const c = catMap.get(s.categoryId!);
				return {
					label: c?.name ?? 'Uncategorized',
					value: s.total,
					color: c?.color ?? '#94a3b8'
				};
			})
	);
	const topSlices = $derived(slices.slice(0, 8));
	const legendSlices = $derived(topSlices.slice(0, 6));

	const sparrowText = $derived.by(() => {
		if (inc.value <= 0) {
			return `Log income for <em style="color: var(--bs-brand); font-weight: 500;">${monthLabel(month)}</em> and Sparrow will start tracking your pace.`;
		}
		const projected = Math.round(savedThisMonth);
		if (projected >= 0 && savingsRate >= 10) {
			return `You're on pace to save <em style="color: var(--bs-brand); font-weight: 500;">${money0(projected)}</em> this month — that's <em style="color: var(--bs-brand); font-weight: 500;">${savingsRate.toFixed(0)}%</em> of income.`;
		}
		if (projected >= 0) {
			return `Spending is up but you're still in the green — <em style="color: var(--bs-brand); font-weight: 500;">${money0(projected)}</em> saved so far this month.`;
		}
		return `You're tracking <em style="color: var(--bs-neg); font-weight: 500;">${money0(Math.abs(projected))} short</em> this month — time to revisit the budget.`;
	});

	let scrubLabel = $state<string | null>(null);

	function handleScrub(p: import('$lib/utils/netWorthSeries').NetWorthPoint | null) {
		scrubLabel = p
			? new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
			: null;
	}
</script>

<!-- Hero — auto-staggered as the 1st child of .bs-tab-content (40ms delay). -->
<div class="d-card d-card-dark" style="padding: 28px;">
	<div class="d-hero-glow" aria-hidden="true"></div>
	<div class="d-hero-grid">
			<div>
				<div class="d-hero-greeting">{greeting}, {heroName} · {dateLabel}</div>
				<div class="d-italic d-hero-nest">Your nest is worth</div>
				<div class="d-italic d-hero-value">
					<MoneyUp value={nw.value} duration={1100} />
				</div>
				<div class="d-hero-meta">
					{#if ytdDelta !== 0}
						<span class="d-italic d-hero-pill">
							{ytdDelta >= 0 ? '↑' : '↓'} {money0(Math.abs(ytdDelta))} since {prevMonthAbbr}
						</span>
					{/if}
					{#if accounts.value.length > 0}
						<span class="d-hero-sub">across {accounts.value.length} account{accounts.value.length === 1 ? '' : 's'}</span>
					{/if}
				</div>
			</div>
			<div class="d-hero-kpis">
				<div>
					<div class="d-hero-kpi-label">{monthAbbr} income</div>
					<div class="d-italic d-hero-kpi-value" style="color: var(--bs-brand-3);">
						<MoneyUp value={inc.value} delay={150} />
					</div>
					<div class="d-hero-kpi-delta">
						{#if incPrev.value > 0}
							{incDelta >= 0 ? '↑' : '↓'} {money0(Math.abs(incDelta))} vs {prevMonthAbbr}
						{:else}
							&nbsp;
						{/if}
					</div>
				</div>
				<div>
					<div class="d-hero-kpi-label">{monthAbbr} spending</div>
					<div class="d-italic d-hero-kpi-value">
						<MoneyUp value={exp.value} delay={240} />
					</div>
					<div class="d-hero-kpi-delta">
						{#if expPrev.value > 0}
							{expDelta <= 0 ? '↓' : '↑'} {money0(Math.abs(expDelta))} vs {prevMonthAbbr}
						{:else}
							&nbsp;
						{/if}
					</div>
				</div>
				<div>
					<div class="d-hero-kpi-label">Saved</div>
					<div
						class="d-italic d-hero-kpi-value"
						style="color: {savedThisMonth >= 0 ? 'var(--bs-brand-3)' : 'var(--bs-neg)'};"
					>
						<MoneyUp value={savedThisMonth} delay={330} />
					</div>
					<div class="d-hero-kpi-delta">{savingsRate.toFixed(0)}% of income</div>
				</div>
			</div>
		</div>
</div>

<!-- Sparrow Says — 2nd child, 120ms delay. -->
<SparrowSays cta="See plan" onclick={() => goto(`${base}/budgets`)}>
	{@html sparrowText}
</SparrowSays>

<!-- Net worth chart + Goals/Health stack — 3rd child, 200ms delay. -->
<div class="d-grid-7-3">
		<div class="d-card">
			<div class="d-card-head">
				<div>
					<h3 class="d-italic d-card-title">Net worth, year to date</h3>
					<div class="d-card-sub">{scrubLabel ?? `${networthPoints.length} months`}</div>
				</div>
				<div class="d-range-pill">
					{#each ['1M', '3M', 'YTD', '1Y'] as r (r)}
						<button
							type="button"
							class="d-range-chip"
							class:active={nwRange === r}
							onclick={() => (nwRange = r as Range)}
						>{r}</button>
					{/each}
				</div>
			</div>
			<NetWorthChart points={networthPoints} height={220} onScrub={handleScrub} />
		</div>

		<div class="d-stack">
			<div class="d-card d-card-dark" style="flex: 1;">
				<div class="d-card-head" style="margin-bottom: 10px;">
					<span class="d-card-eyebrow">Goals on track</span>
					<span class="d-card-eyebrow">{onTrackCount} of {totalGoals}</span>
				</div>
				<div class="d-italic d-card-display">
					{onTrackCount}<span class="d-card-display-sub"> / {totalGoals}</span>
				</div>
				{#if totalGoals === 0}
					<p class="d-card-empty">No goals yet — <a href="{base}/goals" class="d-link">set one</a>.</p>
				{:else}
					{#each goalRows.value.slice(0, 2) as row, i (row.goal.id)}
						<div class="d-goal-row">
							<div class="d-goal-row-head">
								<span>{row.goal.name}</span>
								<span class="d-italic" style="color: var(--bs-panel-tx-2, rgba(232,224,204,0.66));">{row.pct.toFixed(0)}%</span>
							</div>
							<Bar
								value={row.current}
								max={row.goal.targetAmount}
								color="var(--bs-brand-3)"
								track="rgba(232,224,204,0.13)"
								delay={500 + i * 90}
							/>
						</div>
					{/each}
				{/if}
			</div>
			<div class="d-card d-card-accent" style="flex: 1;">
				<div class="d-card-eyebrow" style="color: rgba(255,255,255,0.8); margin-bottom: 8px;">Financial Health</div>
				<div class="d-italic d-card-display" style="color: #fff;">
					{healthScore}<span class="d-card-display-sub" style="opacity: 0.7;"> / 100</span>
				</div>
				<div class="d-card-body" style="color: rgba(255,255,255,0.85);">
					{#if inc.value > 0}
						{savedThisMonth >= 0 ? `Saving ${savingsRate.toFixed(0)}% of income` : 'Overspending'} — your {healthScore >= 80 ? 'best' : healthScore >= 60 ? 'solid' : 'tight'} ratio this month.
					{:else}
						Log income to start scoring your savings ratio.
					{/if}
				</div>
			</div>
		</div>
</div>

<!-- Where money went + Recent activity — 4th child, 280ms delay. -->
<div class="d-grid-1-1">
		<a href="{base}/budgets" class="d-card d-card-link">
			<div class="d-card-head">
				<h3 class="d-italic d-card-title">Where money went</h3>
				<span class="d-card-sub-inline">{monthLabel(month)}</span>
			</div>
			<div class="d-spend-headline">
				<span class="d-italic d-spend-amount">{money0(exp.value)}</span>
				{#if inc.value > 0}
					<span class="d-spend-of">of {money0(inc.value)} earned</span>
				{/if}
			</div>
			<div style="margin-bottom: 16px;">
				<StackBar
					slices={topSlices.map((s) => ({ value: Math.max(1, s.value), color: s.color, label: s.label }))}
					delay={500}
				/>
			</div>
			{#if legendSlices.length === 0}
				<p class="d-card-empty">No spending yet this month.</p>
			{:else}
				<div class="d-spend-legend">
					{#each legendSlices as s, i (i)}
						<div class="d-spend-legend-row">
							<span class="d-spend-dot" style="background: {s.color};"></span>
							<span class="d-spend-legend-label">{s.label}</span>
							<span class="d-italic" style="font-size: 14px; color: var(--bs-text-2);">{money0(s.value)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</a>

		<a href="{base}/transactions" class="d-card d-card-link" style="padding: 0 0 12px;">
			<div class="d-card-head" style="padding: 22px 22px 12px; margin-bottom: 0;">
				<h3 class="d-italic d-card-title">Recent activity</h3>
				<span class="d-link">All →</span>
			</div>
			{#if recent.value.length === 0}
				<p class="d-card-empty" style="padding: 0 22px 22px;">Nothing logged yet.</p>
			{:else}
				{#each recent.value as t (t.id)}
					{@const c = t.categoryId != null ? catMap.get(t.categoryId) : null}
					{@const pos = t.amount > 0}
					<div class="d-recent-row">
						<BrandMark name={t.payee || c?.name || 'Transaction'} size={34} radius={12} />
						<div class="d-recent-body">
							<div class="d-recent-name">{t.payee || c?.name || 'Transaction'}</div>
							<div class="d-recent-sub">{friendlyDate(t.date)}</div>
						</div>
						<span class="d-italic d-recent-amount" style="color: {pos ? 'var(--bs-pos)' : 'var(--bs-text)'};">
							{pos ? '+' : '−'}{money(Math.abs(t.amount))}
						</span>
					</div>
				{/each}
			{/if}
		</a>
</div>

<style>
	/* ── Italic-Fraunces tabular numerals (iNum from desktop.jsx) ────── */
	.d-italic {
		font-family: var(--bs-font-serif);
		font-style: italic;
		font-variant-numeric: tabular-nums;
		font-weight: 400;
	}

	/* ── Card primitive (DCard from desktop.jsx) ──────────────────────── */
	.d-card {
		border-radius: 20px;
		padding: 22px;
		position: relative;
		overflow: hidden;
		background: var(--bs-surface);
		color: var(--bs-text);
		box-shadow: 0 1px 2px rgba(26, 20, 8, 0.04), 0 6px 20px rgba(26, 20, 8, 0.05);
		display: block;
		text-decoration: none;
	}
	.d-card-dark {
		background: var(--bs-panel, #1a2118);
		color: var(--bs-panel-tx, #e8e0cc);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18), 0 18px 40px rgba(0, 0, 0, 0.16);
	}
	.d-card-accent {
		background: var(--bs-accent);
		color: #fff;
		box-shadow: 0 8px 24px rgba(176, 120, 66, 0.26);
	}
	/* Dark mode: full-saturation brass on the forest bg is jarring. Tone it
	   down by mixing the accent with the dark panel — keeps the warm
	   "accent" cue while sitting comfortably against the page bg. */
	:global(.dark) .d-card-accent {
		background: color-mix(in oklch, var(--bs-accent) 30%, var(--bs-panel, #1a2118));
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
	}
	.d-card-link {
		cursor: pointer;
		transition: transform 140ms cubic-bezier(.3, .7, .4, 1);
	}
	.d-card-link:hover {
		transform: translateY(-1px);
	}
	.d-card-link:active {
		transform: scale(0.99);
	}

	/* ── Hero ─────────────────────────────────────────────────────────── */
	.d-hero-glow {
		position: absolute;
		top: -140px;
		right: -40px;
		width: 360px;
		height: 360px;
		border-radius: 50%;
		background: rgba(176, 120, 66, 0.16);
		pointer-events: none;
	}
	.d-hero-grid {
		position: relative;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 32px;
		flex-wrap: wrap;
	}
	.d-hero-greeting {
		font-size: 13px;
		color: var(--bs-panel-tx-2, rgba(232, 224, 204, 0.66));
		margin-bottom: 6px;
	}
	.d-hero-nest {
		font-weight: 300;
		font-size: 15px;
		color: var(--bs-panel-tx-2, rgba(232, 224, 204, 0.66));
	}
	.d-hero-value {
		font-weight: 400;
		font-size: 76px;
		line-height: 1;
		color: var(--bs-panel-tx, #e8e0cc);
		letter-spacing: -0.035em;
		margin-top: 2px;
	}
	.d-hero-meta {
		margin-top: 14px;
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.d-hero-pill {
		padding: 5px 12px;
		border-radius: 999px;
		font-size: 13px;
		background: color-mix(in oklch, var(--bs-brand-3) 22%, transparent);
		color: var(--bs-brand-3);
	}
	.d-hero-sub {
		font-size: 13px;
		color: var(--bs-panel-tx-2, rgba(232, 224, 204, 0.66));
	}
	.d-hero-kpis {
		display: flex;
		gap: 36px;
		padding-left: 32px;
		border-left: 1px solid var(--bs-panel-line, rgba(232, 224, 204, 0.12));
	}
	.d-hero-kpi-label {
		font-size: 11.5px;
		color: var(--bs-panel-tx-2, rgba(232, 224, 204, 0.66));
		margin-bottom: 6px;
	}
	.d-hero-kpi-value {
		font-size: 30px;
		line-height: 1;
		color: var(--bs-panel-tx, #e8e0cc);
	}
	.d-hero-kpi-delta {
		font-size: 11px;
		color: var(--bs-panel-tx-3, rgba(232, 224, 204, 0.42));
		margin-top: 5px;
	}

	/* On narrow viewports drop the vertical separator and stack KPIs under. */
	@media (max-width: 900px) {
		.d-hero-kpis {
			padding-left: 0;
			border-left: none;
			width: 100%;
			justify-content: space-between;
			gap: 16px;
		}
		.d-hero-value {
			font-size: 56px;
		}
	}
	@media (max-width: 480px) {
		.d-card[style*='padding: 28px'] {
			padding: 20px !important;
		}
		.d-hero-value {
			font-size: 44px;
		}
		.d-hero-kpis {
			gap: 12px;
		}
		.d-hero-kpi-value {
			font-size: 22px;
		}
		.d-hero-kpi-label,
		.d-hero-kpi-delta {
			font-size: 10.5px;
		}
		.d-spend-legend {
			grid-template-columns: 1fr;
			gap: 6px;
		}
		.d-spend-amount {
			font-size: 28px;
		}
		.d-card-display {
			font-size: 34px;
		}
		.d-recent-row {
			padding: 10px 18px;
		}
	}

	/* ── Card head ────────────────────────────────────────────────────── */
	.d-card-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 6px;
		flex-wrap: wrap;
	}
	.d-card-title {
		margin: 0;
		font-size: 18px;
		font-weight: 400;
		color: inherit;
	}
	.d-card-sub {
		font-size: 12px;
		color: var(--bs-text-3);
		margin-top: 2px;
	}
	.d-card-sub-inline {
		font-size: 12px;
		color: var(--bs-text-3);
	}
	.d-card-eyebrow {
		font-size: 12px;
		color: var(--bs-panel-tx-2, rgba(232, 224, 204, 0.66));
	}
	.d-card-display {
		font-size: 40px;
		line-height: 1;
		color: var(--bs-panel-tx, #e8e0cc);
		margin: 14px 0 12px;
	}
	.d-card-display-sub {
		font-size: 18px;
		color: var(--bs-panel-tx-2, rgba(232, 224, 204, 0.66));
	}
	.d-card-body {
		font-size: 12px;
		margin-top: 10px;
		line-height: 1.4;
	}
	.d-card-empty {
		margin: 0;
		padding: 14px 0;
		font-size: 13px;
		color: var(--bs-text-3);
		text-align: center;
	}

	/* ── Range pill (inset on bg3, active lifts to surface) ──────────── */
	.d-range-pill {
		display: flex;
		gap: 2px;
		padding: 3px;
		background: var(--bs-bg-2);
		border-radius: 999px;
	}
	.d-range-chip {
		padding: 5px 12px;
		border-radius: 999px;
		font-size: 11.5px;
		font-weight: 500;
		background: transparent;
		color: var(--bs-text-3);
		border: none;
		cursor: pointer;
		transition: background 160ms, color 160ms;
	}
	.d-range-chip.active {
		background: var(--bs-surface);
		color: var(--bs-text);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	/* ── Grids ────────────────────────────────────────────────────────── */
	.d-grid-7-3 {
		display: grid;
		grid-template-columns: 1.7fr 1fr;
		gap: 16px;
	}
	.d-grid-1-1 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.d-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	@media (max-width: 1100px) {
		.d-grid-7-3 {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 900px) {
		.d-grid-1-1 {
			grid-template-columns: 1fr;
		}
	}

	/* ── Goals row ────────────────────────────────────────────────────── */
	.d-goal-row {
		margin-bottom: 10px;
	}
	.d-goal-row:last-child {
		margin-bottom: 0;
	}
	.d-goal-row-head {
		display: flex;
		justify-content: space-between;
		margin-bottom: 5px;
		font-size: 12.5px;
		color: var(--bs-panel-tx, #e8e0cc);
	}

	/* ── Where money went ─────────────────────────────────────────────── */
	.d-spend-headline {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 14px;
	}
	.d-spend-amount {
		font-size: 34px;
		line-height: 1;
		color: var(--bs-text);
	}
	.d-spend-of {
		font-size: 12.5px;
		color: var(--bs-text-3);
	}
	.d-spend-legend {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px 24px;
	}
	.d-spend-legend-row {
		display: flex;
		align-items: center;
		gap: 9px;
		min-width: 0;
	}
	.d-spend-dot {
		width: 9px;
		height: 9px;
		border-radius: 3px;
		flex-shrink: 0;
	}
	.d-spend-legend-label {
		flex: 1;
		min-width: 0;
		font-size: 12.5px;
		color: var(--bs-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Recent activity ──────────────────────────────────────────────── */
	.d-recent-row {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 10px 22px;
		border-top: 1px solid var(--bs-border);
	}
	.d-recent-body {
		flex: 1;
		min-width: 0;
	}
	.d-recent-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--bs-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.d-recent-sub {
		font-size: 11px;
		color: var(--bs-text-3);
	}
	.d-recent-amount {
		font-size: 14.5px;
		flex-shrink: 0;
	}

	/* ── Brass accent link ────────────────────────────────────────────── */
	.d-link {
		color: var(--bs-accent);
		font-size: 12px;
		font-weight: 500;
		text-decoration: none;
	}
	.d-link:hover {
		text-decoration: underline;
	}
</style>
