<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Category, CategoryKind } from '$lib/db/types';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';

	const categories = live<Category[]>(
		() => db.categories.orderBy('sortOrder').toArray(),
		[]
	);

	const ICONS = ['🛒','🍽️','🏠','💡','📶','🚗','⛽','🔁','🎬','🛍️','🩺','✈️','🛡️','💳','📦','💼','🏦','↩️','💰','🎓','🐶','💪','🎁','📚','☕','🍺','🍔','🍎','💼','📱','🧾','🧹','✂️','🧺','🪪','📊','🎯'];
	const COLORS = ['#16a34a','#f97316','#0ea5e9','#eab308','#06b6d4','#a855f7','#ef4444','#ec4899','#8b5cf6','#f43f5e','#10b981','#3b82f6','#64748b','#737373','#94a3b8','#22c55e','#14b8a6','#84cc16','#a3e635'];

	let showModal = $state(false);
	let editing = $state<Category | null>(null);
	let form = $state({
		name: '',
		kind: 'expense' as CategoryKind,
		icon: '📦',
		color: '#64748b'
	});

	function openCreate(kind: CategoryKind) {
		editing = null;
		form = { name: '', kind, icon: kind === 'expense' ? '📦' : '💰', color: '#64748b' };
		showModal = true;
	}
	function openEdit(c: Category) {
		editing = c;
		form = { name: c.name, kind: c.kind, icon: c.icon, color: c.color };
		showModal = true;
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
		if (editing?.id) {
			await db.categories.update(editing.id, payload);
		} else {
			const maxSort = await db.categories
				.where('kind')
				.equals(form.kind)
				.toArray()
				.then((cs) => cs.reduce((m, c) => Math.max(m, c.sortOrder), 0));
			await db.categories.add({
				...payload,
				archived: 0,
				sortOrder: maxSort + 10
			} as Category);
		}
		showModal = false;
	}

	async function archive(c: Category) {
		if (!c.id) return;
		const count = await db.transactions.where('categoryId').equals(c.id).count();
		const msg = count
			? `Archive "${c.name}"? ${count} transaction(s) will be marked Uncategorized.`
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

	const expense = $derived(categories.value.filter((c) => c.archived === 0 && c.kind === 'expense'));
	const income = $derived(categories.value.filter((c) => c.archived === 0 && c.kind === 'income'));
	const archived = $derived(categories.value.filter((c) => c.archived === 1));
</script>

<PageHeader title="Categories" subtitle="Group your spending and income." />

<div class="space-y-8 p-4 md:p-8">
	<section>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Expense</h2>
			<Button size="sm" onclick={() => openCreate('expense')}>+ Add</Button>
		</div>
		<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each expense as c (c.id)}
				<li class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
					<div class="flex h-9 w-9 items-center justify-center rounded-full" style="background:{c.color}22;color:{c.color}">
						<span>{c.icon}</span>
					</div>
					<span class="flex-1 truncate font-medium">{c.name}</span>
					<button class="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => openEdit(c)} aria-label="Edit">✎</button>
					<button class="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => archive(c)} aria-label="Archive">🗄</button>
				</li>
			{/each}
		</ul>
	</section>

	<section>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Income</h2>
			<Button size="sm" onclick={() => openCreate('income')}>+ Add</Button>
		</div>
		<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each income as c (c.id)}
				<li class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
					<div class="flex h-9 w-9 items-center justify-center rounded-full" style="background:{c.color}22;color:{c.color}">
						<span>{c.icon}</span>
					</div>
					<span class="flex-1 truncate font-medium">{c.name}</span>
					<button class="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => openEdit(c)} aria-label="Edit">✎</button>
					<button class="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => archive(c)} aria-label="Archive">🗄</button>
				</li>
			{/each}
		</ul>
	</section>

	{#if archived.length}
		<details>
			<summary class="cursor-pointer text-sm text-slate-500">Archived ({archived.length})</summary>
			<ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each archived as c (c.id)}
					<li class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
						<span class="flex-1 truncate text-slate-500">{c.icon} {c.name}</span>
						<Button size="sm" variant="secondary" onclick={() => unarchive(c)}>Restore</Button>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<Modal open={showModal} title={editing ? 'Edit category' : 'New category'} onclose={() => (showModal = false)}>
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
			<div class="mb-1 block text-sm font-medium">Icon</div>
			<div class="flex flex-wrap gap-1">
				{#each ICONS as i (i)}
					<button
						type="button"
						class="h-8 w-8 rounded text-base {form.icon === i ? 'ring-2 ring-brand-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}"
						onclick={() => (form.icon = i)}
						aria-label={i}
					>
						{i}
					</button>
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
		<Button variant="secondary" onclick={() => (showModal = false)}>Cancel</Button>
		<Button type="submit" onclick={save}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Modal>
