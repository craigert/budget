<script lang="ts">
	import { db } from '$lib/db';
	import type { Business } from '$lib/db/types';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import IconPicker from './IconPicker.svelte';

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
	$effect(() => {
		if (open) {
			if (editing) {
				form = { name: editing.name, icon: editing.icon, color: editing.color };
			} else {
				form = { name: '', icon: 'education/briefcase-01', color: '#0f766e' };
			}
		}
	});

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
