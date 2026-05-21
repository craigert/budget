<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Account, Category, Goal, GoalTrackingMode } from '$lib/db/types';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import IconPicker from './IconPicker.svelte';
	import { clearOnFocus } from '$lib/actions/clearOnFocus';

	interface Props {
		open: boolean;
		editing: Goal | null;
		onclose: () => void;
		onsaved?: (id: number) => void;
	}

	let { open, editing, onclose, onsaved }: Props = $props();

	const accounts = live<Account[]>(
		() => db.accounts.where('archived').equals(0).toArray(),
		[]
	);
	const categories = live<Category[]>(
		() => db.categories.where('archived').equals(0).toArray(),
		[]
	);

	const COLORS = [
		'#0d9488', '#16a34a', '#0ea5e9', '#a855f7', '#ec4899', '#f97316',
		'#eab308', '#10b981', '#3b82f6', '#64748b', '#0f766e', '#7c3aed'
	];

	let form = $state({
		name: '',
		icon: 'finance-ecommerce/piggy-bank',
		color: '#0d9488',
		targetAmount: 0,
		deadline: '',
		startDate: new Date().toISOString().slice(0, 10),
		trackingMode: 'account' as GoalTrackingMode,
		accountIds: new Set<number>(),
		categoryId: null as number | null,
		baselineAmount: 0,
		notes: ''
	});
	$effect(() => {
		if (open) {
			if (editing) {
				form = {
					name: editing.name,
					icon: editing.icon,
					color: editing.color,
					targetAmount: editing.targetAmount,
					deadline: editing.deadline ?? '',
					startDate: editing.startDate,
					trackingMode: editing.trackingMode,
					accountIds: new Set(editing.accountIds),
					categoryId: editing.categoryId,
					baselineAmount: editing.baselineAmount,
					notes: editing.notes
				};
			} else {
				form = {
					name: '',
					icon: 'finance-ecommerce/piggy-bank',
					color: '#0d9488',
					targetAmount: 0,
					deadline: '',
					startDate: new Date().toISOString().slice(0, 10),
					trackingMode: 'account',
					accountIds: new Set<number>(),
					categoryId: null,
					baselineAmount: 0,
					notes: ''
				};
			}
		}
	});

	function toggleAccount(id: number) {
		const next = new Set(form.accountIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		form.accountIds = next;
	}

	async function save(e: Event) {
		e.preventDefault();
		if (!form.name.trim() || !(form.targetAmount > 0)) return;
		const payload: Omit<Goal, 'id' | 'createdAt' | 'sortOrder' | 'archived'> = {
			name: form.name.trim(),
			icon: form.icon,
			color: form.color,
			targetAmount: Number(form.targetAmount) || 0,
			deadline: form.deadline || null,
			startDate: form.startDate,
			trackingMode: form.trackingMode,
			accountIds: form.trackingMode === 'account' ? [...form.accountIds] : [],
			categoryId: form.trackingMode === 'category' ? form.categoryId : null,
			baselineAmount: Number(form.baselineAmount) || 0,
			notes: form.notes.trim()
		};
		let id: number;
		if (editing?.id) {
			await db.nestEggs.update(editing.id, payload);
			id = editing.id;
		} else {
			const maxSort = await db.nestEggs
				.toArray()
				.then((arr) => arr.reduce((m, g) => Math.max(m, g.sortOrder), 0));
			id = (await db.nestEggs.add({
				...payload,
				archived: 0,
				sortOrder: maxSort + 10,
				createdAt: Date.now()
			} as Goal)) as number;
		}
		onsaved?.(id);
		onclose();
	}

	async function deleteGoal() {
		if (!editing?.id) return;
		if (!confirm(`Delete "${editing.name}"?`)) return;
		await db.nestEggs.delete(editing.id);
		onclose();
	}
</script>

<Modal {open} title={editing ? 'Edit goal' : 'New goal'} {onclose}>
	<form onsubmit={save} class="space-y-4">
		<div>
			<label for="g-name" class="mb-1 block text-sm font-medium">Name</label>
			<input id="g-name" type="text" bind:value={form.name} class="w-full" required autofocus placeholder="e.g. Emergency Fund, Down Payment, Boat" />
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="g-target" class="mb-1 block text-sm font-medium">Target amount</label>
				<div class="relative">
					<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">$</span>
					<input id="g-target" type="number" inputmode="decimal" step="100" min="0" bind:value={form.targetAmount} use:clearOnFocus class="w-full pl-6" required />
				</div>
			</div>
			<div>
				<label for="g-deadline" class="mb-1 block text-sm font-medium">Deadline (optional)</label>
				<input id="g-deadline" type="date" bind:value={form.deadline} class="w-full" />
			</div>
		</div>

		<div>
			<div class="mb-1 block text-sm font-medium">Track via</div>
			<div class="flex rounded-md border border-slate-300 dark:border-slate-700">
				<button
					type="button"
					class="flex-1 rounded-l-md py-2 text-sm font-medium {form.trackingMode === 'account'
						? 'bg-brand-500 text-white'
						: 'bg-transparent text-slate-700 dark:text-slate-300'}"
					onclick={() => (form.trackingMode = 'account')}
				>
					Account balance(s)
				</button>
				<button
					type="button"
					class="flex-1 rounded-r-md py-2 text-sm font-medium {form.trackingMode === 'category'
						? 'bg-brand-500 text-white'
						: 'bg-transparent text-slate-700 dark:text-slate-300'}"
					onclick={() => (form.trackingMode = 'category')}
				>
					Category contributions
				</button>
			</div>
		</div>

		{#if form.trackingMode === 'account'}
			<div>
				<div class="mb-1 flex items-baseline justify-between">
					<span class="block text-sm font-medium">Linked accounts</span>
					<span class="text-xs text-slate-500">{form.accountIds.size} selected</span>
				</div>
				{#if accounts.value.length === 0}
					<p class="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700">
						No accounts yet. Add one on the Accounts page first.
					</p>
				{:else}
					<div class="space-y-1 rounded-md border border-slate-200 p-1 dark:border-slate-700">
						{#each accounts.value as a (a.id)}
							<label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
								<input
									type="checkbox"
									class="shrink-0 rounded"
									checked={form.accountIds.has(a.id!)}
									onchange={() => toggleAccount(a.id!)}
								/>
								<span class="flex-1 truncate">{a.name}</span>
								<span class="shrink-0 text-xs text-slate-500 capitalize">{a.type}</span>
							</label>
						{/each}
					</div>
					<p class="mt-1 text-xs text-slate-500">
						Progress = combined balance of the checked accounts (minus the baseline below).
					</p>
				{/if}
			</div>
		{:else}
			<div>
				<label for="g-cat" class="mb-1 block text-sm font-medium">Contribution category</label>
				<select id="g-cat" bind:value={form.categoryId} class="w-full" required>
					<option value={null} disabled>— pick a category —</option>
					{#each categories.value as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-slate-500">
					Progress = sum of transactions in this category on or after the start date.
				</p>
			</div>
		{/if}

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="g-start" class="mb-1 block text-sm font-medium">Start date</label>
				<input id="g-start" type="date" bind:value={form.startDate} class="w-full" />
			</div>
			<div>
				<label for="g-baseline" class="mb-1 block text-sm font-medium">Baseline (offset)</label>
				<div class="relative">
					<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">$</span>
					<input id="g-baseline" type="number" inputmode="decimal" step="0.01" bind:value={form.baselineAmount} use:clearOnFocus class="w-full pl-6" />
				</div>
				<p class="mt-0.5 text-[10px] text-slate-500">Subtracted from progress so an account that already has money doesn't show as 100% complete.</p>
			</div>
		</div>

		<div>
			<div class="mb-1 flex items-baseline justify-between">
				<span class="block text-sm font-medium">Icon</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-full" style="background:{form.color}22;color:{form.color}">
					<Icon name={form.icon} size={22} />
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

		<div>
			<label for="g-notes" class="mb-1 block text-sm font-medium">Notes</label>
			<textarea id="g-notes" bind:value={form.notes} rows="2" class="w-full"></textarea>
		</div>
	</form>
	{#snippet footer()}
		{#if editing}
			<button class="text-sm text-red-600 hover:underline" onclick={deleteGoal}>Delete</button>
		{/if}
		<div class="ml-auto flex gap-2">
			<Button variant="secondary" onclick={onclose}>Cancel</Button>
			<Button type="submit" onclick={save}>{editing ? 'Save' : 'Create'}</Button>
		</div>
	{/snippet}
</Modal>
