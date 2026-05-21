<script lang="ts">
	import { db } from '$lib/db';
	import type { Category, CategoryKind } from '$lib/db/types';
	import { monthLabel } from '$lib/utils/format';
	import { clearOnFocus } from '$lib/actions/clearOnFocus';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import IconPicker from './IconPicker.svelte';

	interface Props {
		open: boolean;
		editing: Category | null;
		defaultKind?: CategoryKind;
		/** Pass the currently viewed month (YYYY-MM) to enable the one-time toggle */
		forMonth?: string;
		onclose: () => void;
		onsaved?: (id: number) => void;
	}

	let { open, editing, defaultKind = 'expense', forMonth, onclose, onsaved }: Props = $props();

	const COLORS = [
		'#16a34a', '#f97316', '#0ea5e9', '#eab308', '#06b6d4', '#a855f7',
		'#ef4444', '#ec4899', '#8b5cf6', '#f43f5e', '#10b981', '#3b82f6',
		'#64748b', '#737373', '#94a3b8', '#22c55e', '#14b8a6', '#84cc16', '#a3e635'
	];

	const DEFAULT_EXPENSE_ICON = 'finance-ecommerce/coins-01';
	const DEFAULT_INCOME_ICON = 'finance-ecommerce/coins-stacked-01';

	let form = $state({
		name: '',
		kind: defaultKind,
		icon: defaultKind === 'expense' ? DEFAULT_EXPENSE_ICON : DEFAULT_INCOME_ICON,
		color: '#64748b'
	});
	let isOneTime = $state(false);
	let budgetAmount = $state(0);

	// Reset form whenever the modal opens
	$effect(() => {
		if (open) {
			if (editing) {
				form = {
					name: editing.name,
					kind: editing.kind,
					icon: editing.icon,
					color: editing.color
				};
			} else {
				form = {
					name: '',
					kind: defaultKind,
					icon: defaultKind === 'expense' ? DEFAULT_EXPENSE_ICON : DEFAULT_INCOME_ICON,
					color: '#64748b'
				};
			}
			isOneTime = editing ? editing.tempMonth != null : false;
			budgetAmount = 0;
		}
	});

	async function save(e: Event) {
		e.preventDefault();
		if (!form.name.trim()) return;
		const payload = {
			name: form.name.trim(),
			kind: form.kind,
			icon: form.icon,
			color: form.color
		};
		let id: number;
		if (editing?.id) {
			const tempMonth = isOneTime
				? (editing.tempMonth ?? forMonth ?? null)
				: null;
			await db.categories.update(editing.id, { ...payload, tempMonth });
			id = editing.id;
		} else {
			const maxSort = await db.categories
				.where('kind')
				.equals(form.kind)
				.toArray()
				.then((cs) => cs.reduce((m, c) => Math.max(m, c.sortOrder), 0));
			id = (await db.categories.add({
				...payload,
				archived: 0,
				sortOrder: maxSort + 10,
				tempMonth: isOneTime && forMonth ? forMonth : null
			} as Category)) as number;

			// Create the budget entry for this month if an amount was provided
			if (forMonth && budgetAmount > 0) {
				await db.budgets.add({ categoryId: id, month: forMonth, amount: budgetAmount });
			}
		}
		onsaved?.(id);
		onclose();
	}
</script>

<Modal {open} title={editing ? 'Edit category' : 'New category'} {onclose}>
	<form onsubmit={save} class="space-y-4">
		<div>
			<label for="cat-name" class="mb-1 block text-sm font-medium">Name</label>
			<input id="cat-name" type="text" bind:value={form.name} class="w-full" required autofocus />
		</div>

		{#if !editing && forMonth}
			<div>
				<label for="cat-budget" class="mb-1 block text-sm font-medium">
					Budget for {monthLabel(forMonth)}
				</label>
				<div class="relative">
					<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">$</span>
					<input
						id="cat-budget"
						type="number"
						inputmode="decimal"
						step="0.01"
						min="0"
						bind:value={budgetAmount}
						use:clearOnFocus
						class="w-full pl-6"
						placeholder="0"
					/>
				</div>
			</div>
		{/if}

		{#if forMonth}
			<label class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors {isOneTime ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}">
				<input type="checkbox" bind:checked={isOneTime} class="shrink-0 rounded" />
				<div>
					<div class="text-sm font-medium">One-time category</div>
					<div class="text-xs text-slate-500">Only appears in the budget view for {editing?.tempMonth ?? forMonth} — won't show in other months</div>
				</div>
				{#if isOneTime}
					<span class="ml-auto shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">1×</span>
				{/if}
			</label>
		{/if}

		<div>
			<div class="mb-1 block text-sm font-medium">Type</div>
			<div class="flex rounded-md border border-slate-300 dark:border-slate-700">
				<button
					type="button"
					class="flex-1 rounded-l-md py-2 text-sm font-medium {form.kind === 'expense'
						? 'bg-red-500 text-white'
						: 'bg-transparent text-slate-700 dark:text-slate-300'}"
					onclick={() => (form.kind = 'expense')}
				>
					Expense
				</button>
				<button
					type="button"
					class="flex-1 rounded-r-md py-2 text-sm font-medium {form.kind === 'income'
						? 'bg-emerald-500 text-white'
						: 'bg-transparent text-slate-700 dark:text-slate-300'}"
					onclick={() => (form.kind = 'income')}
				>
					Income
				</button>
			</div>
		</div>

		<div>
			<div class="mb-1 flex items-baseline justify-between">
				<span class="block text-sm font-medium">Icon</span>
				<div class="flex h-12 w-12 items-center justify-center rounded-full" style="background:{form.color}22;color:{form.color}">
					<Icon name={form.icon} size={26} />
				</div>
			</div>
			<IconPicker bind:value={form.icon} resetKey={open} />
		</div>

		<div>
			<div class="mb-1 block text-sm font-medium">Color</div>
			<div class="flex flex-wrap gap-2">
				{#each COLORS as c (c)}
					<button
						type="button"
						class="h-7 w-7 rounded-full border-2 {form.color === c ? 'border-slate-900 dark:border-white' : 'border-transparent'}"
						style="background:{c}"
						onclick={() => (form.color = c)}
						aria-label={c}
					></button>
				{/each}
			</div>
		</div>
	</form>
	{#snippet footer()}
		<Button variant="secondary" onclick={onclose}>Cancel</Button>
		<Button type="submit" onclick={save}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Modal>
