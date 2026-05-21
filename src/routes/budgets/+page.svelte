<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Budget, Category, CategoryKind } from '$lib/db/types';
	import { spendingByCategory } from '$lib/db/queries';
	import { money, thisMonth, addMonths, monthLabel } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import CategoryFormModal from '$lib/components/CategoryFormModal.svelte';
	import { clearOnFocus } from '$lib/actions/clearOnFocus';

	let month = $state(thisMonth());

	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const budgets = live<Budget[]>(() => db.budgets.where('month').equals(month).toArray(), []);
	const spending = live<{ categoryId: number | null; total: number }[]>(
		() => spendingByCategory(month),
		[]
	);

	const expense = $derived(
		categories.value
			.filter((c) => c.archived === 0 && c.kind === 'expense' && (c.tempMonth == null || c.tempMonth === month))
			.sort((a, b) => a.sortOrder - b.sortOrder)
	);
	const income = $derived(
		categories.value
			.filter((c) => c.archived === 0 && c.kind === 'income')
			.sort((a, b) => a.sortOrder - b.sortOrder)
	);
	const archived = $derived(categories.value.filter((c) => c.archived === 1));

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

	// Pending budget change — holds a proposed edit while the scope dialog is open.
	let pendingChange = $state<{ categoryId: number; categoryName: string; amount: number } | null>(null);

	function stageBudgetChange(categoryId: number, categoryName: string, rawValue: number) {
		pendingChange = { categoryId, categoryName, amount: Math.max(0, Number(rawValue) || 0) };
	}

	type BudgetScope = 'month' | 'forward' | 'all';

	async function applyBudgetChange(scope: BudgetScope) {
		if (!pendingChange) return;
		const { categoryId, amount } = pendingChange;
		const cleaned = amount; // already clamped in stageBudgetChange

		if (scope === 'month') {
			await setAmount(categoryId, cleaned);
		} else {
			let entries = await db.budgets.where('categoryId').equals(categoryId).toArray();
			if (scope === 'forward') {
				entries = entries.filter((b) => b.month >= month);
			}
			await db.transaction('rw', db.budgets, async () => {
				if (cleaned === 0) {
					for (const b of entries) {
						if (b.id) await db.budgets.delete(b.id);
					}
				} else {
					for (const b of entries) {
						if (b.id) await db.budgets.update(b.id, { amount: cleaned });
					}
					// Ensure current month exists if it wasn't already in the set
					const hasCurrentMonth = entries.some((b) => b.month === month);
					if (!hasCurrentMonth) {
						await db.budgets.add({ categoryId, month, amount: cleaned });
					}
				}
			});
		}

		pendingChange = null;
	}

	function cancelBudgetChange() {
		pendingChange = null;
	}

	async function copyPrevious() {
		const prev = addMonths(month, -1);
		const prevBudgets = await db.budgets.where('month').equals(prev).toArray();
		if (!prevBudgets.length) {
			alert('No budgets in the previous month to copy.');
			return;
		}
		// Build a set of one-time category IDs so we can skip them
		const allCats = await db.categories.toArray();
		const oneTimeCatIds = new Set(allCats.filter((c) => c.tempMonth != null).map((c) => c.id!));

		await db.transaction('rw', db.budgets, async () => {
			for (const b of prevBudgets) {
				// Never carry one-time categories into another month
				if (oneTimeCatIds.has(b.categoryId)) continue;
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

	async function archiveCategory(c: Category) {
		if (!c.id) return;
		const count = await db.transactions.where('categoryId').equals(c.id).count();
		const msg = count
			? `Archive "${c.name}"? ${count} transaction(s) will become Uncategorized.`
			: `Archive "${c.name}"?`;
		if (!confirm(msg)) return;
		await db.transaction('rw', db.categories, db.transactions, async () => {
			if (count) {
				await db.transactions.where('categoryId').equals(c.id!).modify({ categoryId: null });
			}
			await db.categories.update(c.id!, { archived: 1 });
		});
	}

	async function unarchive(c: Category) {
		if (!c.id) return;
		await db.categories.update(c.id, { archived: 0 });
	}

	const totalBudgeted = $derived(budgets.value.reduce((s, b) => s + b.amount, 0));
	const totalSpent = $derived(expense.reduce((s, c) => s + (spendMap.get(c.id!) ?? 0), 0));

	// modal state
	let showModal = $state(false);
	let editing = $state<Category | null>(null);
	let defaultKind = $state<CategoryKind>('expense');

	function openAdd(kind: CategoryKind) {
		editing = null;
		defaultKind = kind;
		showModal = true;
	}
	function openEdit(c: Category) {
		editing = c;
		defaultKind = c.kind;
		showModal = true;
	}
</script>

<PageHeader title="Budgets" subtitle={monthLabel(month)}>
	{#snippet actions()}
		<Button variant="onbrand" size="sm" onclick={() => (month = addMonths(month, -1))}>←</Button>
		<Button variant="onbrand" size="sm" onclick={() => (month = thisMonth())}>Today</Button>
		<Button variant="onbrand" size="sm" onclick={() => (month = addMonths(month, 1))}>→</Button>
		<Button variant="onbrand" size="sm" onclick={copyPrevious}>Copy last month</Button>
	{/snippet}
</PageHeader>

<div class="space-y-6 p-4 md:p-8">
	<!-- KPI tiles -->
	<div class="grid gap-3 sm:grid-cols-3">
		<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
			<div class="section-label">Budgeted</div>
			<div class="mt-1 text-2xl font-semibold tabular-nums">{money(totalBudgeted)}</div>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
			<div class="section-label">Spent</div>
			<div class="mt-1 text-2xl font-semibold tabular-nums">{money(totalSpent)}</div>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
			<div class="section-label">Remaining</div>
			<div class="mt-1 text-2xl font-semibold tabular-nums {totalBudgeted - totalSpent < 0 ? 'text-red-600' : ''}">
				{money(totalBudgeted - totalSpent)}
			</div>
		</div>
	</div>

	<!-- Expense categories with budgets inline -->
	<section>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Expense categories</h2>
			<Button size="sm" onclick={() => openAdd('expense')}>+ Add category</Button>
		</div>

		{#if expense.length === 0}
			<div class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
				No expense categories yet. Add one to get started.
			</div>
		{:else}
			<ul class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
				{#each expense as c (c.id)}
					{@const budgetEntry = budgetMap.get(c.id!)}
					{@const budgeted = budgetEntry?.amount ?? 0}
					{@const isTemp = c.tempMonth != null}
					{@const spent = spendMap.get(c.id!) ?? 0}
					{@const remaining = budgeted - spent}
					{@const pct = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0}
					{@const over = budgeted > 0 && spent > budgeted}
					<li class="group border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
						<div class="flex items-center gap-3">
							<div class="flex h-9 w-9 items-center justify-center rounded-full" style="background:{c.color}22;color:{c.color}">
								<Icon name={c.icon} size={20} />
							</div>
							<div class="flex-1 truncate font-medium">{c.name}</div>
							{#if isTemp}
								<span class="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title="Temporary — won't copy to other months">1×</span>
							{/if}
							<div class="relative w-28 shrink-0">
								<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">$</span>
								<input
									type="number"
									step="0.01"
									min="0"
									class="w-full pl-6 text-right tabular-nums"
									value={pendingChange?.categoryId === c.id! ? pendingChange.amount : budgeted}
									use:clearOnFocus
									onchange={(e) => stageBudgetChange(c.id!, c.name, Number((e.currentTarget as HTMLInputElement).value))}
									aria-label="Monthly budget for {c.name}"
								/>
							</div>
							<div class="flex shrink-0 gap-1 opacity-60 transition-opacity group-hover:opacity-100">
								<button
									class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
									onclick={() => openEdit(c)}
									aria-label="Edit"
								>
									<Icon name="general/edit-01" size={16} />
								</button>
								<button
									class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
									onclick={() => archiveCategory(c)}
									aria-label="Archive"
								>
									<Icon name="general/archive" size={16} />
								</button>
							</div>
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
	</section>

	<!-- Income categories (no budget — just management) -->
	<section>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Income categories</h2>
			<Button size="sm" onclick={() => openAdd('income')}>+ Add category</Button>
		</div>

		{#if income.length === 0}
			<div class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
				No income categories yet.
			</div>
		{:else}
			<ul class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
				{#each income as c (c.id)}
					<li class="group flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
						<div class="flex h-9 w-9 items-center justify-center rounded-full" style="background:{c.color}22;color:{c.color}">
							<Icon name={c.icon} size={20} />
						</div>
						<div class="flex-1 truncate font-medium">{c.name}</div>
						<div class="flex shrink-0 gap-1 opacity-60 transition-opacity group-hover:opacity-100">
							<button
								class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
								onclick={() => openEdit(c)}
								aria-label="Edit"
							>
								<Icon name="general/edit-01" size={16} />
							</button>
							<button
								class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
								onclick={() => archiveCategory(c)}
								aria-label="Archive"
							>
								<Icon name="general/archive" size={16} />
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if archived.length}
		<details>
			<summary class="cursor-pointer text-sm text-slate-500">Archived ({archived.length})</summary>
			<ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each archived as c (c.id)}
					<li class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
						<span class="text-slate-400"><Icon name={c.icon} size={18} /></span>
						<span class="flex-1 truncate text-slate-500">{c.name}</span>
						<Button size="sm" variant="secondary" onclick={() => unarchive(c)}>Restore</Button>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<CategoryFormModal
	open={showModal}
	editing={editing}
	defaultKind={defaultKind}
	forMonth={month}
	onclose={() => (showModal = false)}
/>

<!-- Budget scope picker -->
{#if pendingChange}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-4"
		role="dialog"
		aria-modal="true"
		onclick={cancelBudgetChange}
		onkeydown={(e) => e.key === 'Escape' && cancelBudgetChange()}
		tabindex="-1"
	>
		<div
			class="w-full max-w-sm overflow-hidden rounded-t-2xl bg-white shadow-xl md:rounded-2xl dark:bg-slate-900"
			onclick={(e) => e.stopPropagation()}
			role="document"
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="px-5 pt-5 pb-4">
				<h3 class="font-semibold">Update "{pendingChange.categoryName}" budget</h3>
				<p class="mt-1 text-sm text-slate-500">
					{pendingChange.amount > 0 ? `Set to ${money(pendingChange.amount)}.` : 'Remove budget.'} Which months should this apply to?
				</p>
			</div>
			<div class="divide-y divide-slate-100 dark:divide-slate-800">
				<button
					class="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
					onclick={() => applyBudgetChange('month')}
				>
					<span class="font-medium">Just {monthLabel(month)}</span>
					<span class="text-xs text-slate-400">This month only</span>
				</button>
				<button
					class="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
					onclick={() => applyBudgetChange('forward')}
				>
					<span class="font-medium">{monthLabel(month)} and following</span>
					<span class="text-xs text-slate-400">Updates all future months too</span>
				</button>
				<button
					class="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
					onclick={() => applyBudgetChange('all')}
				>
					<span class="font-medium">All months</span>
					<span class="text-xs text-slate-400">Entire history &amp; future</span>
				</button>
			</div>
			<div class="border-t border-slate-200 px-5 py-3 dark:border-slate-800">
				<Button variant="secondary" onclick={cancelBudgetChange} class="w-full">Cancel</Button>
			</div>
		</div>
	</div>
{/if}
