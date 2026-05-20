<script lang="ts">
	import { db } from '$lib/db';
	import type { Business } from '$lib/db/types';
	import { ICON_GROUPS } from '$lib/icons';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open: boolean;
		editing: Business | null;
		onclose: () => void;
		onsaved?: (id: number) => void;
	}

	let { open, editing, onclose, onsaved }: Props = $props();

	const COLORS = [
		'#0f766e', '#16a34a', '#0ea5e9', '#a855f7', '#ec4899', '#f97316',
		'#eab308', '#10b981', '#3b82f6', '#64748b', '#737373', '#14b8a6'
	];

	let form = $state({
		name: '',
		icon: 'education/briefcase-01',
		color: '#0f766e'
	});
	let iconQuery = $state('');

	$effect(() => {
		if (open) {
			if (editing) {
				form = { name: editing.name, icon: editing.icon, color: editing.color };
			} else {
				form = { name: '', icon: 'education/briefcase-01', color: '#0f766e' };
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
		const payload = { name: form.name.trim(), icon: form.icon, color: form.color };
		let id: number;
		if (editing?.id) {
			await db.businesses.update(editing.id, payload);
			id = editing.id;
		} else {
			const maxSort = await db.businesses
				.toArray()
				.then((bs) => bs.reduce((m, b) => Math.max(m, b.sortOrder), 0));
			id = (await db.businesses.add({
				...payload,
				archived: 0,
				sortOrder: maxSort + 10,
				createdAt: Date.now()
			} as Business)) as number;
		}
		onsaved?.(id);
		onclose();
	}
</script>

<Modal {open} title={editing ? 'Edit business' : 'New business'} {onclose}>
	<form onsubmit={save} class="space-y-4">
		<div>
			<label for="biz-name" class="mb-1 block text-sm font-medium">Name</label>
			<input id="biz-name" type="text" bind:value={form.name} class="w-full" required autofocus placeholder="e.g. Acme LLC" />
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
			<div class="max-h-60 space-y-3 overflow-y-auto pr-1">
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
