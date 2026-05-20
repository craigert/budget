<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Account, Category, NestEgg, NestEggTrackingMode } from '$lib/db/types';
	import { ICON_GROUPS } from '$lib/icons';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open: boolean;
		editing: NestEgg | null;
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
		trackingMode: 'account' as NestEggTrackingMode,
		accountId: null as number | null,
		categoryId: null as number | null,
		baselineAmount: 0,
		notes: ''
	});
	let iconQuery = $state('');

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
					accountId: editing.accountIds[0] ?? null,
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
					accountId: accounts.value[0]?.id ?? null,
					categoryId: null,
					baselineAmount: 0,
					notes: ''
				};
			}
			iconQuery = '';
		}
	});

	const filteredGroups = $derived.by(() => {
		const q = iconQuery.trim().toLowerCase();
		if (!q) return ICON_GROUPS;
		return ICON_GROUPS.map((g) => ({
			label: g.label,
			icons: g.icons.filter((p) => p.toLowerCase().includes(q))
		})).filter((g) => g.icons.length > 0);
	});

	function iconLabel(p: string) {
		const name = p.split('/').pop() ?? p;
		return name.replace(/-\d+$/, '').replace(/-/g, ' ');
	}

	async function save(e: Event) {
		e.preventDefault();
		if (!form.name.trim() || !(form.targetAmount > 0)) return;
		const payload: Omit<NestEgg, 'id' | 'createdAt' | 'sortOrder' | 'archived'> = {
			name: form.name.trim(),
			icon: form.icon,
			color: form.color,
			targetAmount: Number(form.targetAmount) || 0,
			deadline: form.deadline || null,
			startDate: form.startDate,
			trackingMode: form.trackingMode,
			accountIds: form.trackingMode === 'account' && form.accountId != null ? [form.accountId] : [],
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
				.then((arr) => arr.reduce((m, e) => Math.max(m, e.sortOrder), 0));
			id = (await db.nestEggs.add({
				...payload,
				archived: 0,
				sortOrder: maxSort + 10,
				createdAt: Date.now()
			} as NestEgg)) as number;
		}
		onsaved?.(id);
		onclose();
	}

	async function deleteEgg() {
		if (!editing?.id) return;
		if (!confirm(`Delete "${editing.name}"?`)) return;
		await db.nestEggs.delete(editing.id);
		onclose();
	}
</script>

<Modal {open} title={editing ? 'Edit nest egg' : 'New nest egg'} {onclose}>
	<form onsubmit={save} class="space-y-4">
		<div>
			<label for="ne-name" class="mb-1 block text-sm font-medium">Name</label>
			<input id="ne-name" type="text" bind:value={form.name} class="w-full" required autofocus placeholder="e.g. Emergency Fund" />
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="ne-target" class="mb-1 block text-sm font-medium">Target amount</label>
				<input id="ne-target" type="number" step="100" min="0" bind:value={form.targetAmount} class="w-full" required />
			</div>
			<div>
				<label for="ne-deadline" class="mb-1 block text-sm font-medium">Deadline (optional)</label>
				<input id="ne-deadline" type="date" bind:value={form.deadline} class="w-full" />
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
					Account balance
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
				<label for="ne-account" class="mb-1 block text-sm font-medium">Linked account</label>
				<select id="ne-account" bind:value={form.accountId} class="w-full" required>
					<option value={null} disabled>— pick an account —</option>
					{#each accounts.value as a (a.id)}
						<option value={a.id}>{a.name}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-slate-500">
					Progress = current balance of this account minus the baseline below.
				</p>
			</div>
		{:else}
			<div>
				<label for="ne-cat" class="mb-1 block text-sm font-medium">Contribution category</label>
				<select id="ne-cat" bind:value={form.categoryId} class="w-full" required>
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
				<label for="ne-start" class="mb-1 block text-sm font-medium">Start date</label>
				<input id="ne-start" type="date" bind:value={form.startDate} class="w-full" />
			</div>
			<div>
				<label for="ne-baseline" class="mb-1 block text-sm font-medium">Baseline (offset)</label>
				<input id="ne-baseline" type="number" step="0.01" bind:value={form.baselineAmount} class="w-full" />
				<p class="mt-0.5 text-[10px] text-slate-500">Subtracted from progress so a savings account that already has money doesn't show as 100% complete.</p>
			</div>
		</div>

		<div>
			<div class="mb-1 flex items-baseline justify-between">
				<span class="block text-sm font-medium">Icon</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-full" style="background:{form.color}22;color:{form.color}">
					<Icon name={form.icon} size={22} />
				</div>
			</div>
			<input type="search" bind:value={iconQuery} placeholder="Search icons…" class="mb-2 w-full" />
			<div class="max-h-48 space-y-2 overflow-y-auto pr-1">
				{#each filteredGroups as g (g.label)}
					<div>
						<div class="section-label mb-1">{g.label}</div>
						<div class="grid grid-cols-8 gap-1 sm:grid-cols-10">
							{#each g.icons as p (p)}
								<button
									type="button"
									title={iconLabel(p)}
									class="flex h-8 w-8 items-center justify-center rounded transition-colors {form.icon === p
										? 'bg-brand-500 text-white'
										: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
									onclick={() => (form.icon = p)}
									aria-label={iconLabel(p)}
								>
									<Icon name={p} size={18} />
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
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
			<label for="ne-notes" class="mb-1 block text-sm font-medium">Notes</label>
			<textarea id="ne-notes" bind:value={form.notes} rows="2" class="w-full"></textarea>
		</div>
	</form>
	{#snippet footer()}
		{#if editing}
			<button class="text-sm text-red-600 hover:underline" onclick={deleteEgg}>Delete</button>
		{/if}
		<div class="ml-auto flex gap-2">
			<Button variant="secondary" onclick={onclose}>Cancel</Button>
			<Button type="submit" onclick={save}>{editing ? 'Save' : 'Create'}</Button>
		</div>
	{/snippet}
</Modal>
