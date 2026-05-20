<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Budget, Category } from '$lib/db/types';
	import { spendingByCategory } from '$lib/db/queries';
	import { money, thisMonth, addMonths, monthLabel } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let month = $state(thisMonth());

	const categories = live<Category[]>(
		() => db.categories.where('archived').equals(0).toArray(),
		[]
	);
	const budgets = live<Budget[]>(
		() => db.budgets.where('month').equals(month).toArray(),
		[]
	);
	const spending = live<{ categoryId: number | null; total: number }[]>(
		() => spendingByCategory(month),
		[]
	);

	const expense = $derived(categories.value.filter((c) => c.kind === 'expense'));
	const budgetMap = $derived(new Map(budgets.value.map((b) => [b.categoryId, b])));
	const spendMap = $derived(new Map(spending.value.map((s) => [s.categoryId, s.total])));

	async function setAmount(categoryId: number, amount: number) {
		const cleaned = Math.max(0, Number(amount) || 0);
		const existing = budgetMap.get(categoryId);
		if (existing?.id) {
			if (cleaned === 0) {
				await db.budgets.delete(existing.id);
			} else {
				await db.budgets.update(existing.id, { amount: cleaned });
			}
		} else if (cleaned > 0) {
			await db.budgets.add({ categoryId, month, amount: cleaned });
		}
	}

	async function copyPrevious() {
		const prev = addMonths(month, -1);
		const prevBudgets = await db.budgets.where('month').equals(prev).toArray();
		if (!prevBudgets.length) {
			alert('No budgets in the previous month to copy.');
			return;
		}
		await db.transaction('rw', db.budgets, async () => {
			for (const b of prevBudgets) {
				const existing = await db.budgets
					.where(['categoryId', 'month'])
					.equals([b.categoryId, month])
					.first();
				if (existing?.id) {
					await db.budgets.update(existing.id, { amount: b.amount });
				} else {
					await db.budgets.add({ categoryId: b.categoryId, month, amount: b.amount });
				}
			}
		});
	}

	const totalBudgeted = $derived(budgets.value.reduce((s, b) => s + b.amount, 0));
	const totalSpent = $derived(
		expense.reduce((s, c) => s + (spendMap.get(c.id!) ?? 0), 0)
	);
</script>

<PageHeader title="Budgets" subtitle={monthLabel(month)}>
	{#snippet actions()}
		<Button variant="onbrand" size="sm" onclick={() => (month = addMonths(month, -1))}>←</Button>
		<Button variant="onbrand" size="sm" onclick={() => (month = thisMonth())}>Today</Button>
		<Button variant="onbrand" size="sm" onclick={() => (month = addMonths(month, 1))}>→</Button>
		<Button variant="onbrand" size="sm" onclick={copyPrevious}>Copy last month</Button>
	{/snippet}
</PageHeader>

<div class="space-y-4 p-4 md:p-8">
	<div class="grid gap-3 sm:grid-cols-3">
		<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
			<div class="text-xs uppercase tracking-wide text-slate-500">Budgeted</div>
			<div class="mt-1 text-2xl font-semibold tabular-nums">{money(totalBudgeted)}</div>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
			<div class="text-xs uppercase tracking-wide text-slate-500">Spent</div>
			<div class="mt-1 text-2xl font-semibold tabular-nums">{money(totalSpent)}</div>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
			<div class="text-xs uppercase tracking-wide text-slate-500">Remaining</div>
			<div class="mt-1 text-2xl font-semibold tabular-nums {totalBudgeted - totalSpent < 0 ? 'text-red-600' : ''}">
				{money(totalBudgeted - totalSpent)}
			</div>
		</div>
	</div>

	{#if expense.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
			Add some expense categories first.
		</div>
	{:else}
		<ul class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
			{#each expense as c (c.id)}
				{@const budgeted = budgetMap.get(c.id!)?.amount ?? 0}
				{@const spent = spendMap.get(c.id!) ?? 0}
				{@const remaining = budgeted - spent}
				{@const pct = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0}
				{@const over = budgeted > 0 && spent > budgeted}
				<li class="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
					<div class="flex items-center gap-3">
						<div class="flex h-9 w-9 items-center justify-center rounded-full" style="background:{c.color}22;color:{c.color}">
							<Icon name={c.icon} size={20} />
						</div>
						<div class="flex-1 truncate font-medium">{c.name}</div>
						<input
							type="number"
							step="0.01"
							min="0"
							class="w-28 text-right tabular-nums"
							value={budgeted || ''}
							placeholder="0"
							onchange={(e) => setAmount(c.id!, Number((e.currentTarget as HTMLInputElement).value))}
						/>
					</div>
					{#if budgeted > 0}
						<div class="mt-2 flex items-center gap-3 text-xs">
							<div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
								<div
									class="h-full transition-all {over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}"
									style="width:{pct}%"
								></div>
							</div>
							<div class="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
								{money(spent)} <span class="text-slate-400">/</span> {money(budgeted)}
							</div>
							<div class="w-24 shrink-0 text-right tabular-nums {remaining < 0 ? 'text-red-600' : 'text-slate-500'}">
								{money(remaining)}
							</div>
						</div>
					{:else if spent > 0}
						<div class="mt-1 text-xs text-slate-500">
							Spent {money(spent)} · no budget set
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
