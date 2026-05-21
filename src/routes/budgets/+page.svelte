<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Budget, Category, CategoryKind, Goal, GoalContribution, Transaction } from '$lib/db/types';
	import { spendingByCategory, incomingByCategory } from '$lib/db/queries';
	import { goalCurrent, goalProgress } from '$lib/db/goals';
	import { money, thisMonth, addMonths, monthLabel } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import CategoryFormModal from '$lib/components/CategoryFormModal.svelte';
	import GoalFormModal from '$lib/components/GoalFormModal.svelte';
	import { clearOnFocus } from '$lib/actions/clearOnFocus';

	// ── Budget ────────────────────────────────────────────────────────────────

	let month = $state(thisMonth());

	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const budgets = live<Budget[]>(() => db.budgets.where('month').equals(month).toArray(), []);
	const spending = live<{ categoryId: number | null; total: number }[]>(
		() => spendingByCategory(month),
		[]
	);
	const incomeReceived = live<{ categoryId: number | null; total: number }[]>(
		() => incomingByCategory(month),
		[]
	);

	const expense = $derived(
		categories.value
			.filter((c) => c.archived === 0 && c.kind === 'expense' && (c.tempMonth == null || c.tempMonth === month))
			.sort((a, b) => a.sortOrder - b.sortOrder)
	);
	const income = $derived(
		categories.value
			.filter((c) => c.archived === 0 && c.kind === 'income' && (c.tempMonth == null || c.tempMonth === month))
			.sort((a, b) => a.sortOrder - b.sortOrder)
	);
	const archived = $derived(categories.value.filter((c) => c.archived === 1));

	const budgetMap = $derived(new Map(budgets.value.map((b) => [b.categoryId, b])));
	const spendMap = $derived(new Map(spending.value.map((s) => [s.categoryId, s.total])));
	const incomeMap = $derived(new Map(incomeReceived.value.map((i) => [i.categoryId, i.total])));

	let pendingChange = $state<{ categoryId: number; categoryName: string; amount: number } | null>(null);

	function openEdit(c: Category) {
		const current = budgetMap.get(c.id!)?.amount ?? 0;
		pendingChange = { categoryId: c.id!, categoryName: c.name, amount: current };
	}

	type BudgetScope = 'month' | 'forward' | 'all';
	async function applyBudgetChange(scope: BudgetScope) {
		if (!pendingChange) return;
		const { categoryId, amount } = pendingChange;
		const cleaned = Math.max(0, Number(amount) || 0);

		async function setAmount(catId: number, amt: number) {
			const existing = budgetMap.get(catId);
			if (existing?.id) {
				if (amt === 0) await db.budgets.delete(existing.id);
				else await db.budgets.update(existing.id, { amount: amt });
			} else if (amt > 0) {
				await db.budgets.add({ categoryId: catId, month, amount: amt });
			}
		}

		if (scope === 'month') {
			await setAmount(categoryId, cleaned);
		} else {
			let entries = await db.budgets.where('categoryId').equals(categoryId).toArray();
			if (scope === 'forward') entries = entries.filter((b) => b.month >= month);
			await db.transaction('rw', db.budgets, async () => {
				if (cleaned === 0) {
					for (const b of entries) if (b.id) await db.budgets.delete(b.id);
				} else {
					for (const b of entries) if (b.id) await db.budgets.update(b.id, { amount: cleaned });
					const hasCurrent = entries.some((b) => b.month === month);
					if (!hasCurrent) await db.budgets.add({ categoryId, month, amount: cleaned });
				}
			});
		}
		pendingChange = null;
	}
	function cancelEdit() {
		pendingChange = null;
	}

	// Auto-carry budgets from previous month
	$effect(() => {
		const m = month;
		(async () => {
			const existing = await db.budgets.where('month').equals(m).count();
			if (existing > 0) return;
			const prev = addMonths(m, -1);
			const prevBudgets = await db.budgets.where('month').equals(prev).toArray();
			if (!prevBudgets.length) return;
			const allCats = await db.categories.toArray();
			const oneTimeIds = new Set(allCats.filter((c) => c.tempMonth != null).map((c) => c.id!));
			await db.transaction('rw', db.budgets, async () => {
				for (const b of prevBudgets) {
					if (oneTimeIds.has(b.categoryId)) continue;
					await db.budgets.add({ categoryId: b.categoryId, month: m, amount: b.amount });
				}
			});
		})();
	});

	async function archiveCategory(c: Category) {
		if (!c.id) return;
		const count = await db.transactions.where('categoryId').equals(c.id).count();
		const msg = count
			? `Archive "${c.name}"? ${count} transaction(s) will become Uncategorized.`
			: `Archive "${c.name}"?`;
		if (!confirm(msg)) return;
		await db.transaction('rw', db.categories, db.transactions, async () => {
			if (count) await db.transactions.where('categoryId').equals(c.id!).modify({ categoryId: null });
			await db.categories.update(c.id!, { archived: 1 });
		});
	}
	async function unarchive(c: Category) {
		if (!c.id) return;
		await db.categories.update(c.id, { archived: 0 });
	}

	const totalBudgeted = $derived(budgets.value.reduce((s, b) => s + b.amount, 0));
	const totalSpent = $derived(expense.reduce((s, c) => s + (spendMap.get(c.id!) ?? 0), 0));
	const usedPct = $derived(totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0);

	const daysLeftInMonth = $derived.by(() => {
		const [y, m] = month.split('-').map(Number);
		const last = new Date(y, m, 0).getDate();
		const today = new Date();
		const isCurrent = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` === month;
		return isCurrent ? last - today.getDate() : last;
	});

	let showCategoryModal = $state(false);
	let editingCategory = $state<Category | null>(null);
	let defaultKind = $state<CategoryKind>('expense');
	function openAddCategory(kind: CategoryKind) {
		editingCategory = null;
		defaultKind = kind;
		showCategoryModal = true;
	}

	function statusFor(budgeted: number, spent: number) {
		if (budgeted === 0) return { label: '', tone: 'idle' as const };
		if (spent > budgeted) return { label: 'Over budget', tone: 'neg' as const };
		const pct = (spent / budgeted) * 100;
		if (pct >= 100) return { label: 'Reached', tone: 'warn' as const };
		if (pct >= 80) return { label: 'Close to limit', tone: 'warn' as const };
		return { label: `${daysLeftInMonth} days left`, tone: 'idle' as const };
	}

	// ── Goals ─────────────────────────────────────────────────────────────────

	const goals = live<Goal[]>(
		() =>
			db.nestEggs
				.where('archived')
				.equals(0)
				.toArray()
				.then((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder)),
		[]
	);
	const txs = live<Transaction[]>(() => db.transactions.toArray(), []);
	const contributions = live<GoalContribution[]>(
		() => db.goalContributions.orderBy('date').reverse().toArray(),
		[]
	);

	let currents = $state<Map<number, number>>(new Map());
	$effect(() => {
		const list = goals.value;
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

	let showGoalModal = $state(false);
	let editingGoal = $state<Goal | null>(null);
	function openCreateGoal() { editingGoal = null; showGoalModal = true; }
	function openEditGoal(g: Goal) { editingGoal = g; showGoalModal = true; }

	function formatTargetDate(iso: string | null): string {
		if (!iso) return 'No target';
		const [y, m, d] = iso.split('-').map(Number);
		return `Target by ${new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
	}
</script>

<PageHeader title="Budgets" eyebrow="{monthLabel(month).toUpperCase()} · {Math.round(usedPct)}% USED">
	{#snippet actions()}
		<div
			class="inline-flex items-center"
			style="border: 0.5px solid var(--bs-border); border-radius: var(--bs-radius-sm); background: var(--bs-surface);"
		>
			<button
				type="button"
				onclick={() => (month = addMonths(month, -1))}
				class="px-2.5 py-1.5 text-sm transition-opacity hover:opacity-70"
				style="color: var(--bs-text-2);"
				aria-label="Previous month"
			>‹</button>
			<button
				type="button"
				onclick={() => (month = thisMonth())}
				class="px-2 py-1.5 text-sm font-medium transition-opacity hover:opacity-80"
				style="color: var(--bs-text);"
				title={month === thisMonth() ? '' : 'Jump to today'}
			>{monthLabel(month).split(' ')[0]}</button>
			<button
				type="button"
				onclick={() => (month = addMonths(month, 1))}
				class="px-2.5 py-1.5 text-sm transition-opacity hover:opacity-70"
				style="color: var(--bs-text-2);"
				aria-label="Next month"
			>›</button>
		</div>
		<button
			type="button"
			onclick={() => openAddCategory('expense')}
			class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
			style="background: var(--bs-text); color: var(--bs-bg);"
		>
			<Icon name="general/plus" size={14} />
			Add budget
		</button>
	{/snippet}
</PageHeader>

<div class="space-y-6 p-4 md:p-8">
	<!-- Headline overview -->
	<section class="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
		<div class="section-label">{monthLabel(month).toUpperCase()} · {Math.round(usedPct)}% USED</div>
		<div class="mt-2 flex flex-wrap items-baseline gap-2">
			<span class="bs-display" style="font-size: 36px;">{money(totalSpent)}</span>
			<span class="bs-mono" style="font-size: 14px; color: var(--bs-text-3);">
				of <span style="color: var(--bs-text-2);">{money(totalBudgeted)}</span>
			</span>
		</div>
		<div class="mt-4 h-2 w-full overflow-hidden rounded-full" style="background: color-mix(in oklch, var(--bs-text-3) 18%, transparent);">
			<div
				class="h-full transition-all"
				style="width: {Math.min(100, usedPct)}%; background: {usedPct > 100 ? 'var(--bs-neg)' : usedPct > 80 ? 'var(--bs-warn)' : 'var(--bs-brand)'};"
			></div>
		</div>
	</section>

	<!-- Expense category grid -->
	{#if expense.length === 0}
		<div class="rounded-xl p-10 text-center" style="border: 1px dashed var(--bs-border-2); background: var(--bs-surface);">
			<p style="color: var(--bs-text-2);">No categories yet. Add one to start budgeting.</p>
			<div class="mt-4">
				<Button onclick={() => openAddCategory('expense')}>+ Add category</Button>
			</div>
		</div>
	{:else}
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each expense as c (c.id)}
				{@const budgeted = budgetMap.get(c.id!)?.amount ?? 0}
				{@const spent = spendMap.get(c.id!) ?? 0}
				{@const remaining = budgeted - spent}
				{@const pct = budgeted > 0 ? (spent / budgeted) * 100 : 0}
				{@const over = budgeted > 0 && spent > budgeted}
				{@const status = statusFor(budgeted, spent)}
				<li>
					<button
						type="button"
						onclick={() => openEdit(c)}
						class="w-full rounded-xl border border-slate-200 bg-white text-left transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
					>
						<div class="flex items-start gap-3">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
								style="background: color-mix(in oklch, {c.color} 14%, var(--bs-surface)); color: {c.color}; border: 0.5px solid color-mix(in oklch, {c.color} 28%, transparent);"
							>
								<Icon name={c.icon} size={18} />
							</div>
							<div class="min-w-0 flex-1">
								<div class="truncate text-sm font-medium" style="color: var(--bs-text); font-size: 13.5px;">{c.name}</div>
								<div class="truncate text-xs" style="font-size: 11.5px; color: {status.tone === 'neg' ? 'var(--bs-neg)' : status.tone === 'warn' ? 'var(--bs-warn)' : 'var(--bs-text-3)'};">
									{status.label}
								</div>
							</div>
							{#if budgeted > 0}
								<span
									class="bs-tag bs-mono"
									style="background: color-mix(in oklch, {status.tone === 'neg' ? 'var(--bs-neg)' : status.tone === 'warn' ? 'var(--bs-warn)' : 'var(--bs-text-3)'} 12%, transparent); color: {status.tone === 'neg' ? 'var(--bs-neg)' : status.tone === 'warn' ? 'var(--bs-warn)' : 'var(--bs-text-2)'};"
								>{over ? 'Over' : `${Math.round(pct)}%`}</span>
							{/if}
						</div>
						<div class="mt-4 flex items-baseline justify-between gap-2">
							<span class="bs-kpi" style="font-size: 26px;">{money(spent)}</span>
							<span class="bs-mono" style="font-size: 12px; color: var(--bs-text-3);">/ {money(budgeted)}</span>
						</div>
						<div class="mt-3 h-1.5 w-full overflow-hidden rounded-full" style="background: color-mix(in oklch, var(--bs-text-3) 18%, transparent);">
							<div class="h-full transition-all" style="width: {Math.min(100, pct)}%; background: {over ? 'var(--bs-neg)' : c.color};"></div>
						</div>
						<div class="mt-3" style="font-size: 12px; color: var(--bs-text-3);">
							{#if budgeted === 0 && spent === 0}
								<span>No budget set · tap to add</span>
							{:else if over}
								<span class="bs-mono" style="color: var(--bs-neg);">{money(-remaining)}</span><span> over</span>
							{:else}
								<span class="bs-mono" style="color: var(--bs-text-2);">{money(remaining)}</span><span> left this month</span>
							{/if}
						</div>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Goals -->
	<section>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-base font-semibold" style="color: var(--bs-text);">Goals</h2>
			<button
				type="button"
				onclick={openCreateGoal}
				class="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80"
				style="background: var(--bs-surface-2); color: var(--bs-text-2); border: 0.5px solid var(--bs-border);"
			>
				<Icon name="general/plus" size={13} />
				New goal
			</button>
		</div>

		{#if goals.value.length === 0}
			<div class="rounded-xl p-8 text-center" style="border: 1px dashed var(--bs-border-2); background: var(--bs-surface);">
				<p class="text-sm" style="color: var(--bs-text-2);">No goals yet. Create one to start tracking savings.</p>
			</div>
		{:else}
			<ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{#each goals.value as g (g.id)}
					{@const current = currents.get(g.id!) ?? 0}
					{@const p = goalProgress(g, current)}
					{@const pct = Math.min(100, Math.max(0, p.percent))}
					<li>
						<button
							type="button"
							onclick={() => openEditGoal(g)}
							class="w-full rounded-xl border border-slate-200 bg-white text-left transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
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
									<div class="truncate text-sm font-medium" style="color: var(--bs-text); font-size: 13.5px;">{g.name}</div>
									<div class="truncate text-xs" style="color: var(--bs-text-3); font-size: 11.5px;">{formatTargetDate(g.deadline)}</div>
								</div>
								<span class="bs-mono" style="font-size: 12px; color: var(--bs-text-2); white-space: nowrap;">{Math.round(p.percent)}%</span>
							</div>
							<div class="mt-3 flex items-baseline gap-1.5">
								<span class="bs-kpi" style="font-size: 24px;">{money(current)}</span>
								<span class="bs-mono" style="font-size: 12px; color: var(--bs-text-3);">/ {money(g.targetAmount)}</span>
							</div>
							<div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full" style="background: color-mix(in oklch, var(--bs-text-3) 18%, transparent);">
								<div class="h-full transition-all" style="width: {pct}%; background: {p.complete ? 'var(--bs-pos)' : 'var(--bs-brand)'};"></div>
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
				<!-- Dashed + New goal tile -->
				<li>
					<button
						type="button"
						onclick={openCreateGoal}
						class="flex h-full min-h-[180px] w-full flex-col items-center justify-center rounded-xl transition-colors"
						style="border: 1px dashed var(--bs-border-2); background: transparent; color: var(--bs-text-2);"
					>
						<div class="mb-2 flex h-9 w-9 items-center justify-center rounded-lg" style="background: var(--bs-surface-2); color: var(--bs-text-2); border: 0.5px solid var(--bs-border);">
							<Icon name="general/plus" size={18} />
						</div>
						<div class="text-sm font-medium" style="color: var(--bs-text);">New goal</div>
						<div class="mt-0.5 text-xs" style="color: var(--bs-text-3);">Save for what matters</div>
					</button>
				</li>
			</ul>
		{/if}
	</section>

	<!-- Income categories -->
	{#if income.length > 0}
		<section class="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" style="padding: 0;">
			<div class="flex items-center justify-between" style="padding: 16px var(--bs-pad-card);">
				<h2 class="text-base font-semibold" style="color: var(--bs-text);">Income</h2>
				<Button size="sm" variant="ghost" onclick={() => openAddCategory('income')}>+ Add</Button>
			</div>
			<ul style="border-top: 0.5px solid var(--bs-border);">
				{#each income as c (c.id)}
					{@const received = incomeMap.get(c.id!) ?? 0}
					<li class="group flex items-center gap-3" style="padding: 12px var(--bs-pad-card); border-bottom: 0.5px solid var(--bs-border);">
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style="background: color-mix(in oklch, {c.color} 14%, var(--bs-surface)); color: {c.color}; border: 0.5px solid color-mix(in oklch, {c.color} 28%, transparent);">
							<Icon name={c.icon} size={16} />
						</div>
						<span class="flex-1 truncate text-sm font-medium" style="color: var(--bs-text);">{c.name}</span>
						<span class="bs-mono shrink-0" style="font-size: 13.5px; font-weight: 500; color: {received > 0 ? 'var(--bs-pos)' : 'var(--bs-text-3)'};">
							{money(received)}
						</span>
						<button
							class="rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
							style="color: var(--bs-text-3);"
							onclick={() => archiveCategory(c)}
							aria-label="Archive"
						>
							<Icon name="general/archive" size={14} />
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if archived.length}
		<details>
			<summary class="cursor-pointer text-sm" style="color: var(--bs-text-3);">Archived ({archived.length})</summary>
			<ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each archived as c (c.id)}
					<li class="flex items-center gap-3 rounded-lg bg-white p-3 dark:bg-slate-900" style="border: 0.5px solid var(--bs-border);">
						<span style="color: var(--bs-text-3);"><Icon name={c.icon} size={18} /></span>
						<span class="flex-1 truncate" style="color: var(--bs-text-2);">{c.name}</span>
						<Button size="sm" variant="secondary" onclick={() => unarchive(c)}>Restore</Button>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<CategoryFormModal
	open={showCategoryModal}
	editing={editingCategory}
	defaultKind={defaultKind}
	forMonth={month}
	onclose={() => (showCategoryModal = false)}
/>

<GoalFormModal open={showGoalModal} editing={editingGoal} onclose={() => (showGoalModal = false)} />

<!-- Budget edit dialog -->
{#if pendingChange}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-4"
		role="dialog"
		aria-modal="true"
		onclick={cancelEdit}
		onkeydown={(e) => e.key === 'Escape' && cancelEdit()}
		tabindex="-1"
	>
		<div
			class="w-full max-w-sm overflow-hidden rounded-t-2xl shadow-xl md:rounded-2xl"
			style="background: var(--bs-surface);"
			onclick={(e) => e.stopPropagation()}
			role="document"
			onkeydown={(e) => e.stopPropagation()}
		>
			<div style="padding: 20px var(--bs-pad-card);">
				<h3 class="text-base font-semibold" style="color: var(--bs-text);">{pendingChange.categoryName} budget</h3>
				<label class="mt-3 mb-1 block" style="font-size: 11px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; color: var(--bs-text-3);">Monthly amount</label>
				<div class="relative">
					<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm" style="color: var(--bs-text-3);">$</span>
					<input type="number" inputmode="decimal" step="0.01" min="0" class="bs-mono w-full pl-6" bind:value={pendingChange.amount} use:clearOnFocus autofocus />
				</div>
				<p class="mt-3 text-xs" style="color: var(--bs-text-2);">Apply to:</p>
			</div>
			<div style="border-top: 0.5px solid var(--bs-border);">
				<button
					class="flex w-full items-center justify-between text-left text-sm transition-colors hover:bg-[var(--bs-surface-2)]"
					style="padding: 14px var(--bs-pad-card); border-bottom: 0.5px solid var(--bs-border);"
					onclick={() => applyBudgetChange('month')}
				>
					<span class="font-medium" style="color: var(--bs-text);">Just {monthLabel(month)}</span>
					<span class="text-xs" style="color: var(--bs-text-3);">This month only</span>
				</button>
				<button
					class="flex w-full items-center justify-between text-left text-sm transition-colors hover:bg-[var(--bs-surface-2)]"
					style="padding: 14px var(--bs-pad-card); border-bottom: 0.5px solid var(--bs-border);"
					onclick={() => applyBudgetChange('forward')}
				>
					<span class="font-medium" style="color: var(--bs-text);">{monthLabel(month)} and following</span>
					<span class="text-xs" style="color: var(--bs-text-3);">Future months too</span>
				</button>
				<button
					class="flex w-full items-center justify-between text-left text-sm transition-colors hover:bg-[var(--bs-surface-2)]"
					style="padding: 14px var(--bs-pad-card);"
					onclick={() => applyBudgetChange('all')}
				>
					<span class="font-medium" style="color: var(--bs-text);">All months</span>
					<span class="text-xs" style="color: var(--bs-text-3);">Entire history &amp; future</span>
				</button>
			</div>
			<div style="border-top: 0.5px solid var(--bs-border); padding: 12px var(--bs-pad-card);">
				<Button variant="secondary" onclick={cancelEdit} class="w-full">Cancel</Button>
			</div>
		</div>
	</div>
{/if}
