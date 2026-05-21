<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Account, Category, Goal, GoalContribution, Transaction } from '$lib/db/types';
	import { goalCurrent, goalProgress } from '$lib/db/goals';
	import { clearOnFocus } from '$lib/actions/clearOnFocus';
	import { money } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import GoalFormModal from '$lib/components/GoalFormModal.svelte';

	const goals = live<Goal[]>(
		() =>
			db.nestEggs
				.where('archived')
				.equals(0)
				.toArray()
				.then((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder)),
		[]
	);
	const accounts = live<Account[]>(() => db.accounts.toArray(), []);
	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const txs = live<Transaction[]>(() => db.transactions.toArray(), []);
	const contributions = live<GoalContribution[]>(
		() => db.goalContributions.orderBy('date').reverse().toArray(),
		[]
	);

	const categoryMap = $derived(new Map(categories.value.map((c) => [c.id!, c])));
	const accountMap = $derived(new Map(accounts.value.map((a) => [a.id!, a])));
	const contributionsByGoal = $derived.by(() => {
		const map = new Map<number, GoalContribution[]>();
		for (const c of contributions.value) {
			if (!map.has(c.goalId)) map.set(c.goalId, []);
			map.get(c.goalId)!.push(c);
		}
		return map;
	});

	let currents = $state<Map<number, number>>(new Map());
	$effect(() => {
		const list = goals.value;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		accounts.value;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		txs.value;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		contributions.value;
		(async () => {
			const next = new Map<number, number>();
			for (const g of list) {
				if (g.id == null) continue;
				next.set(g.id, await goalCurrent(g));
			}
			currents = next;
		})();
	});

	// Manual contribution form
	let showContribFor = $state<number | null>(null); // goalId
	let contribForm = $state({ date: '', amount: 0, notes: '' });

	function openContribForm(goalId: number) {
		showContribFor = goalId;
		contribForm = { date: new Date().toISOString().slice(0, 10), amount: 0, notes: '' };
	}

	async function saveContrib(goalId: number) {
		if (!(contribForm.amount > 0)) return;
		await db.goalContributions.add({
			goalId,
			date: contribForm.date,
			amount: Number(contribForm.amount),
			notes: contribForm.notes.trim(),
			createdAt: Date.now()
		} as GoalContribution);
		showContribFor = null;
	}

	async function deleteContrib(id: number) {
		await db.goalContributions.delete(id);
	}

	const totals = $derived.by(() => {
		let saved = 0;
		let target = 0;
		for (const g of goals.value) {
			target += g.targetAmount;
			saved += currents.get(g.id!) ?? 0;
		}
		return { saved, target };
	});

	let showModal = $state(false);
	let editing = $state<Goal | null>(null);
	function openCreate() {
		editing = null;
		showModal = true;
	}
	function openEdit(g: Goal) {
		editing = g;
		showModal = true;
	}

	function formatDate(iso: string | null): string {
		if (!iso) return 'No deadline';
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function paceLabel(pace: ReturnType<typeof goalProgress>['pace']) {
		switch (pace) {
			case 'complete':
				return { label: '✓ Reached', cls: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' };
			case 'ahead':
				return { label: 'Ahead', cls: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' };
			case 'on-track':
				return { label: 'On track', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' };
			case 'behind':
				return { label: 'Behind', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200' };
			case 'overdue':
				return { label: 'Overdue', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' };
			case 'no-deadline':
			default:
				return { label: 'No deadline', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
		}
	}

	function barColor(p: ReturnType<typeof goalProgress>): string {
		if (p.complete) return 'bg-brand-500';
		if (p.pace === 'overdue') return 'bg-red-500';
		if (p.pace === 'behind') return 'bg-amber-500';
		if (p.pace === 'ahead') return 'bg-brand-500';
		return 'bg-emerald-500';
	}

	function linkedAccountsLabel(g: Goal): string {
		const names = g.accountIds
			.map((id) => accountMap.get(id)?.name)
			.filter((n): n is string => Boolean(n));
		if (names.length === 0) return 'No accounts linked';
		if (names.length <= 2) return names.join(' + ');
		return `${names[0]} + ${names.length - 1} more`;
	}
</script>

<PageHeader title="Goals" subtitle="Track savings toward what matters">
	{#snippet actions()}
		<Button variant="onbrand" size="sm" onclick={openCreate}>+ New goal</Button>
	{/snippet}
</PageHeader>

<div class="space-y-6 p-4 md:p-8">
	{#if goals.value.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
			<div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15">
				<Icon name="finance-ecommerce/piggy-bank" size={28} />
			</div>
			<h2 class="text-lg font-semibold">Set your first goal</h2>
			<p class="mt-1 text-sm text-slate-500">
				Examples: Emergency Fund · Down Payment · Boat · Swimming Pool · Warhammer Figurines · Lego Sets
			</p>
			<div class="mt-4">
				<Button onclick={openCreate}>+ New goal</Button>
			</div>
		</div>
	{:else}
		<!-- Total summary -->
		<div class="grid gap-3 sm:grid-cols-3">
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">Total saved</div>
				<div class="mt-1 text-2xl font-bold tabular-nums text-brand-500">{money(totals.saved)}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">Total target</div>
				<div class="mt-1 text-2xl font-bold tabular-nums">{money(totals.target)}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
				<div class="section-label">{goals.value.length} active goal{goals.value.length === 1 ? '' : 's'}</div>
				<div class="mt-1 text-2xl font-bold tabular-nums {totals.target > 0 ? '' : 'text-slate-400'}">
					{totals.target > 0 ? `${Math.round((totals.saved / totals.target) * 100)}%` : '—'}
				</div>
			</div>
		</div>

		<!-- Goal cards -->
		<ul class="grid gap-4 md:grid-cols-2">
			{#each goals.value as g (g.id)}
				{@const current = currents.get(g.id!) ?? 0}
				{@const p = goalProgress(g, current)}
				{@const pl = paceLabel(p.pace)}
				{@const pct = Math.min(100, Math.max(0, p.percent))}
				<li class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div class="flex items-start gap-3">
						<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style="background:{g.color}22;color:{g.color}">
							<Icon name={g.icon} size={22} />
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline justify-between gap-2">
								<h3 class="truncate text-lg font-semibold">{g.name}</h3>
								<span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide {pl.cls}">{pl.label}</span>
							</div>
							<div class="mt-0.5 truncate text-xs text-slate-500">
								{#if g.trackingMode === 'account'}
									{linkedAccountsLabel(g)}
								{:else if g.trackingMode === 'category'}
									{categoryMap.get(g.categoryId ?? -1)?.name ?? 'Unlinked category'} contributions
								{:else}
									Manual contributions
								{/if}
							</div>
						</div>
						<button
							class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
							onclick={() => openEdit(g)}
							aria-label="Edit"
						>
							<Icon name="general/edit-01" size={16} />
						</button>
					</div>

					<!-- Big numbers -->
					<div class="mt-4 flex items-baseline justify-between gap-2">
						<div>
							<div class="text-3xl font-bold tabular-nums">{money(current)}</div>
							<div class="text-sm text-slate-500">of {money(g.targetAmount)}</div>
						</div>
						<div class="text-right">
							<div class="text-2xl font-bold tabular-nums {p.complete ? 'text-brand-500' : ''}">{Math.round(p.percent)}%</div>
							{#if p.complete}
								<div class="text-xs text-brand-600">Goal reached!</div>
							{:else}
								<div class="text-xs text-slate-500">{money(p.remaining)} to go</div>
							{/if}
						</div>
					</div>

					<!-- Progress bar with on-pace marker -->
					<div class="mt-3">
						<div class="relative h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
							<div class="h-full transition-all {barColor(p)}" style="width:{pct}%"></div>
							{#if p.expectedPercent != null && !p.complete}
								<div
									class="absolute top-0 h-full w-0.5 bg-slate-900/60 dark:bg-white/70"
									style="left:{p.expectedPercent}%"
									title="On-pace marker"
								></div>
							{/if}
						</div>
					</div>

					<!-- Linked accounts chips (when 2+) -->
					{#if g.trackingMode === 'account' && g.accountIds.length > 1}
						<div class="mt-3 flex flex-wrap gap-1.5">
							{#each g.accountIds as id (id)}
								{@const a = accountMap.get(id)}
								{#if a}
									<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
										<Icon name="finance-ecommerce/wallet" size={11} />
										{a.name}
									</span>
								{/if}
							{/each}
						</div>
					{/if}

					<!-- Footer info -->
					<div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
						<div>
							{#if g.deadline}
								<span class="font-medium">{formatDate(g.deadline)}</span>
								{#if p.daysLeft != null}
									· <span>{p.daysLeft >= 0 ? `${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left` : `${-p.daysLeft} day${p.daysLeft === -1 ? '' : 's'} past`}</span>
								{/if}
							{:else}
								<span>No deadline</span>
							{/if}
						</div>
						{#if p.projectedCompletion && !p.complete}
							<div>
								Projected at current pace: <span class="font-medium">{formatDate(p.projectedCompletion)}</span>
							</div>
						{/if}
					</div>

					{#if g.notes}
						<p class="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
							{g.notes}
						</p>
					{/if}

					{#if g.trackingMode === 'manual'}
						{@const goalContribs = contributionsByGoal.get(g.id!) ?? []}
						<div class="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
							{#if goalContribs.length > 0}
								<ul class="mb-2 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
									{#each goalContribs.slice(0, 5) as c (c.id)}
										<li class="flex items-center gap-2 px-3 py-1.5 text-xs">
											<span class="w-20 shrink-0 text-slate-500">{c.date}</span>
											<span class="flex-1 truncate text-slate-500">{c.notes || '—'}</span>
											<span class="shrink-0 font-medium tabular-nums text-emerald-600 dark:text-emerald-400">+{money(c.amount)}</span>
											<button
												class="shrink-0 text-slate-300 hover:text-red-500"
												onclick={() => deleteContrib(c.id!)}
												aria-label="Delete contribution"
											>×</button>
										</li>
									{/each}
									{#if goalContribs.length > 5}
										<li class="px-3 py-1.5 text-center text-xs text-slate-400">{goalContribs.length - 5} more…</li>
									{/if}
								</ul>
							{/if}

							{#if showContribFor === g.id}
								<div class="rounded-lg border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-500/30 dark:bg-brand-500/10">
									<div class="mb-2 flex gap-2">
										<input
											type="date"
											bind:value={contribForm.date}
											class="w-36 shrink-0 text-sm"
										/>
										<div class="relative flex-1">
											<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">$</span>
											<input
												type="number"
												step="0.01"
												min="0"
												bind:value={contribForm.amount}
												use:clearOnFocus
												placeholder="Amount"
												class="w-full pl-6 text-sm"
											/>
										</div>
									</div>
									<input
										type="text"
										bind:value={contribForm.notes}
										placeholder="Notes (optional)"
										class="mb-2 w-full text-sm"
									/>
									<div class="flex gap-2">
										<button
											class="flex-1 rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
											onclick={() => saveContrib(g.id!)}
										>Save</button>
										<button
											class="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
											onclick={() => (showContribFor = null)}
										>Cancel</button>
									</div>
								</div>
							{:else}
								<button
									class="w-full rounded-md border border-dashed border-slate-300 py-1.5 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:hover:border-brand-500"
									onclick={() => openContribForm(g.id!)}
								>+ Log contribution</button>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<GoalFormModal open={showModal} editing={editing} onclose={() => (showModal = false)} />
