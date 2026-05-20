<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import { accountBalances } from '$lib/db/queries';
	import { ACCOUNT_TYPES, type Account, type AccountType } from '$lib/db/types';
	import { money } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';

	const accounts = live<Account[]>(
		() => db.accounts.orderBy('createdAt').toArray(),
		[]
	);
	const balances = live<Map<number, number>>(() => accountBalances(), new Map());

	let showModal = $state(false);
	let editing = $state<Account | null>(null);
	let form = $state({
		name: '',
		type: 'checking' as AccountType,
		openingBalance: 0,
		currency: 'USD'
	});

	function openCreate() {
		editing = null;
		form = { name: '', type: 'checking', openingBalance: 0, currency: 'USD' };
		showModal = true;
	}

	function openEdit(a: Account) {
		editing = a;
		form = {
			name: a.name,
			type: a.type,
			openingBalance: a.openingBalance,
			currency: a.currency
		};
		showModal = true;
	}

	async function save(e: Event) {
		e.preventDefault();
		if (!form.name.trim()) return;
		const payload = {
			name: form.name.trim(),
			type: form.type,
			openingBalance: Number(form.openingBalance) || 0,
			currency: form.currency || 'USD'
		};
		if (editing?.id) {
			await db.accounts.update(editing.id, payload);
		} else {
			await db.accounts.add({
				...payload,
				archived: 0,
				createdAt: Date.now()
			} as Account);
		}
		showModal = false;
	}

	async function archiveAccount(a: Account) {
		if (!a.id) return;
		if (!confirm(`Archive "${a.name}"? Its transactions will remain.`)) return;
		await db.accounts.update(a.id, { archived: 1 });
	}

	async function unarchive(a: Account) {
		if (!a.id) return;
		await db.accounts.update(a.id, { archived: 0 });
	}

	const visible = $derived(accounts.value.filter((a) => a.archived === 0));
	const archived = $derived(accounts.value.filter((a) => a.archived === 1));
	const typeLabel = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;
</script>

<PageHeader title="Accounts" subtitle="Your balances are calculated from transactions.">
	{#snippet actions()}
		<Button variant="onbrand" onclick={openCreate}>+ Account</Button>
	{/snippet}
</PageHeader>

<div class="p-4 md:p-8">
	{#if visible.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
			No accounts yet. Add one to start tracking.
		</div>
	{:else}
		<ul class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
			{#each visible as a (a.id)}
				<li class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div class="flex items-start justify-between">
						<div>
							<div class="text-sm text-slate-500">{typeLabel(a.type)}</div>
							<div class="text-lg font-semibold">{a.name}</div>
						</div>
						<div class="flex gap-1">
							<button
								class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
								onclick={() => openEdit(a)}
								aria-label="Edit"
							>
								✎
							</button>
							<button
								class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
								onclick={() => archiveAccount(a)}
								aria-label="Archive"
							>
								🗄
							</button>
						</div>
					</div>
					<div class="mt-3 text-2xl font-semibold tabular-nums {((balances.value.get(a.id!) ?? 0) < 0 ? 'text-red-600' : '')}">
						{money(balances.value.get(a.id!) ?? a.openingBalance)}
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	{#if archived.length}
		<details class="mt-8">
			<summary class="cursor-pointer text-sm text-slate-500">Archived ({archived.length})</summary>
			<ul class="mt-3 space-y-2">
				{#each archived as a (a.id)}
					<li class="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
						<div>
							<span class="font-medium">{a.name}</span>
							<span class="ml-2 text-slate-500">{typeLabel(a.type)}</span>
						</div>
						<Button size="sm" variant="secondary" onclick={() => unarchive(a)}>Restore</Button>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<Modal open={showModal} title={editing ? 'Edit account' : 'New account'} onclose={() => (showModal = false)}>
	<form id="account-form" onsubmit={save} class="space-y-4">
		<div>
			<label for="name" class="mb-1 block text-sm font-medium">Name</label>
			<input id="name" type="text" bind:value={form.name} class="w-full" required autofocus />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="type" class="mb-1 block text-sm font-medium">Type</label>
				<select id="type" bind:value={form.type} class="w-full">
					{#each ACCOUNT_TYPES as t (t.value)}
						<option value={t.value}>{t.label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="opening" class="mb-1 block text-sm font-medium">Opening balance</label>
				<input id="opening" type="number" step="0.01" bind:value={form.openingBalance} class="w-full" />
			</div>
		</div>
	</form>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showModal = false)}>Cancel</Button>
		<Button type="submit" onclick={save}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Modal>
