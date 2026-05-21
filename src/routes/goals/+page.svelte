<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Account, Category, Goal, GoalContribution, Transaction } from '$lib/db/types';
	import { goalCurrent, goalProgress } from '$lib/db/goals';
	import { money } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import GoalFormModal from '$lib/components/GoalFormModal.svelte';
	import { base } from '$app/paths';

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

	function formatTargetDate(iso: string | null): string {
		if (!iso) return 'No target';
		const [y, m, d] = iso.split('-').map(Number);
		return `Target by ${new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
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

<PageHeader title="Goals" eyebrow="SAVINGS PROGRESS">
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

<div class="p-4 md:p-8">
	{#if goals.value.length === 0}
		<div
			class="rounded-xl p-10 text-center"
			style="border: 1px dashed var(--bs-border-2); background: var(--bs-surface);"
		>
			<div
				class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
				style="background: var(--bs-brand-tint); color: var(--bs-brand);"
			>
				<Icon name="finance-ecommerce/piggy-bank" size={28} />
			</div>
			<h2 class="text-lg font-semibold" style="color: var(--bs-text);">Set your first goal</h2>
			<p class="mt-1 text-sm" style="color: var(--bs-text-2);">
				Emergency Fund · Down Payment · Vacation · Anything you're saving toward.
			</p>
			<div class="mt-4">
				<button
					type="button"
					onclick={openCreate}
					class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
					style="background: var(--bs-text); color: var(--bs-bg);"
				>
					<Icon name="general/plus" size={14} />
					New goal
				</button>
			</div>
		</div>
	{:else}
		<!--
			Goal grid per design — 4-col on wide screens with a dashed "+ New goal"
			tile at the end so the call-to-action lives in-grid (matches mockup).
		-->
		<ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			{#each goals.value as g (g.id)}
				{@const current = currents.get(g.id!) ?? 0}
				{@const p = goalProgress(g, current)}
				{@const pct = Math.min(100, Math.max(0, p.percent))}
				<li>
					<button
						type="button"
						onclick={() => openEdit(g)}
						class="w-full text-left rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-shadow hover:shadow-md"
						title={g.notes || `${g.name} — click to edit`}
					>
						<div class="flex items-start gap-3">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
								style="background: color-mix(in oklch, {g.color} 14%, var(--bs-surface)); color: {g.color}; border: 0.5px solid color-mix(in oklch, {g.color} 28%, transparent);"
							>
								<Icon name={g.icon} size={18} />
							</div>
							<div class="min-w-0 flex-1">
								<div
									class="truncate text-sm font-medium"
									style="color: var(--bs-text); font-size: 13.5px;"
								>
									{g.name}
								</div>
								<div class="truncate text-xs" style="color: var(--bs-text-3); font-size: 11.5px;">
									{formatTargetDate(g.deadline)}
								</div>
							</div>
							<span
								class="bs-mono"
								style="font-size: 12px; color: var(--bs-text-2); white-space: nowrap;"
							>
								{Math.round(p.percent)}%
							</span>
						</div>

						<div class="mt-3 flex items-baseline gap-1.5">
							<span class="bs-kpi" style="font-size: 24px;">{money(current)}</span>
							<span class="bs-mono" style="font-size: 12px; color: var(--bs-text-3);">
								/ {money(g.targetAmount)}
							</span>
						</div>

						<div
							class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
							style="background: color-mix(in oklch, var(--bs-text-3) 18%, transparent);"
						>
							<div
								class="h-full transition-all"
								style="width: {pct}%; background: {p.complete ? 'var(--bs-pos)' : 'var(--bs-brand)'};"
							></div>
						</div>

						<div class="mt-3 flex items-center justify-between">
							<span class="bs-mono" style="font-size: 11.5px; color: var(--bs-text-3);">
								{p.complete ? 'Reached' : `${money(p.remaining)} to go`}
							</span>
							<span
								class="inline-flex items-center gap-1 rounded-full"
								style="padding: 4px 9px; font-size: 11px; font-weight: 500; border: 0.5px solid var(--bs-border); background: var(--bs-surface); color: var(--bs-text-2);"
							>
								<Icon name="general/plus" size={11} />
								Contribute
							</span>
						</div>
					</button>
				</li>
			{/each}
			<!-- Dashed "+ New goal" placeholder -->
			<li>
				<button
					type="button"
					onclick={openCreate}
					class="w-full flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl transition-colors"
					style="border: 1px dashed var(--bs-border-2); background: transparent; color: var(--bs-text-2);"
				>
					<div
						class="mb-2 flex h-9 w-9 items-center justify-center rounded-lg"
						style="background: var(--bs-surface-2); color: var(--bs-text-2); border: 0.5px solid var(--bs-border);"
					>
						<Icon name="general/plus" size={18} />
					</div>
					<div class="text-sm font-medium" style="color: var(--bs-text);">New goal</div>
					<div class="mt-0.5 text-xs" style="color: var(--bs-text-3);">Save for what matters</div>
				</button>
			</li>
		</ul>
	{/if}
</div>

<GoalFormModal open={showModal} editing={editing} onclose={() => (showModal = false)} />
