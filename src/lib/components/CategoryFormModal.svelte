<script lang="ts">
	import { db } from '$lib/db';
	import type { Category, CategoryKind } from '$lib/db/types';
	import { ICON_GROUPS } from '$lib/icons';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open: boolean;
		editing: Category | null;
		defaultKind?: CategoryKind;
		onclose: () => void;
		onsaved?: (id: number) => void;
	}

	let { open, editing, defaultKind = 'expense', onclose, onsaved }: Props = $props();

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
	let iconQuery = $state('');

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

	function iconLabel(path: string) {
		const name = path.split('/').pop() ?? path;
		return name.replace(/-\d+$/, '').replace(/-/g, ' ');
	}

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
			await db.categories.update(editing.id, payload);
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
				sortOrder: maxSort + 10
			} as Category)) as number;
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
			<input
				type="search"
				bind:value={iconQuery}
				placeholder="Search icons…"
				class="mb-3 w-full"
			/>
			<div class="max-h-72 space-y-3 overflow-y-auto pr-1">
				{#each filteredGroups as g (g.label)}
					<div>
						<div class="section-label mb-1.5">{g.label}</div>
						<div class="grid grid-cols-8 gap-1 sm:grid-cols-10">
							{#each g.icons as p (p)}
								<button
									type="button"
									title={iconLabel(p)}
									class="flex h-9 w-9 items-center justify-center rounded transition-colors {form.icon === p
										? 'bg-brand-500 text-white'
										: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
									onclick={() => (form.icon = p)}
									aria-label={iconLabel(p)}
								>
									<Icon name={p} size={20} />
								</button>
							{/each}
						</div>
					</div>
				{/each}
				{#if filteredGroups.length === 0}
					<p class="py-4 text-center text-sm text-slate-500">No icons match "{iconQuery}".</p>
				{/if}
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
	</form>
	{#snippet footer()}
		<Button variant="secondary" onclick={onclose}>Cancel</Button>
		<Button type="submit" onclick={save}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Modal>
