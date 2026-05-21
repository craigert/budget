<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import { accountBalances } from '$lib/db/queries';
	import { ACCOUNT_TYPES, type Account, type AccountType } from '$lib/db/types';
	import { money } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { clearOnFocus } from '$lib/actions/clearOnFocus';

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

	// Group accounts by purpose for the dashboard layout
	type Group = { key: string; label: string; types: AccountType[] };
	const GROUPS: Group[] = [
		{ key: 'banking', label: 'Banking', types: ['checking', 'savings', 'cash'] },
		{ key: 'credit', label: 'Credit & Loans', types: ['credit', 'loan'] },
		{ key: 'investments', label: 'Investments', types: ['investment'] },
		{ key: 'other', label: 'Other', types: ['other'] }
	];

	function balanceOf(a: Account): number {
		return balances.value.get(a.id!) ?? a.openingBalance;
	}

	const groupedAccounts = $derived(
		GROUPS.map((g) => ({
			...g,
			accounts: visible.filter((a) => g.types.includes(a.type))
		})).filter((g) => g.accounts.length > 0)
	);

	const groupSubtotals = $derived(
		new Map(groupedAccounts.map((g) => [g.key, g.accounts.reduce((s, a) => s + balanceOf(a), 0)]))
	);
	const netWorth = $derived(visible.reduce((s, a) => s + balanceOf(a), 0));
</script>

<PageHeader title="Accounts" subtitle="Your balances are calculated from transactions.">
	{#snippet actions()}
		<Button variant="onbrand" onclick={openCreate}>+ Account</Button>
	{/snippet}
</PageHeader>

<div class="space-y-6 p-4 md:p-8">
	{#if visible.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
			No accounts yet. Add one to start tracking.
		</div>
	{:else}
		<!-- Net worth summary -->
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
			<div class="section-label">Net worth</div>
			<div class="mt-1 text-3xl font-bold tabular-nums {netWorth < 0 ? 'text-red-600' : ''}">{money(netWorth)}</div>
			<div class="mt-1 text-xs text-slate-500">{visible.length} active account{visible.length === 1 ? '' : 's'}</div>
		</div>

		{#each groupedAccounts as g (g.key)}
			<section>
				<div class="mb-3 flex items-baseline justify-between">
					<h2 class="text-lg font-semibold">{g.label}</h2>
					<div class="text-sm text-slate-500">
						{g.accounts.length} account{g.accounts.length === 1 ? '' : 's'} ·
						<span class="font-medium tabular-nums {(groupSubtotals.get(g.key) ?? 0) < 0 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}">{money(groupSubtotals.get(g.key) ?? 0)}</span>
					</div>
				</div>
				<ul class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
					{#each g.accounts as a (a.id)}
						<li class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
							<div class="flex items-start justify-between">
								<div>
									<div class="text-sm text-slate-500">{typeLabel(a.type)}</div>
									<div class="text-lg font-semibold">{a.name}</div>
								</div>
								<div class="flex gap-1">
									<button
										class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
										onclick={() => openEdit(a)}
										aria-label="Edit"
									>
										<Icon name="general/edit-01" size={16} />
									</button>
									<button
										class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
										onclick={() => archiveAccount(a)}
										aria-label="Archive"
									>
										<Icon name="general/archive" size={16} />
									</button>
								</div>
							</div>
							<div class="mt-3 text-2xl font-semibold tabular-nums {balanceOf(a) < 0 ? 'text-red-600' : ''}">
								{money(balanceOf(a))}
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
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
				<div class="relative">
					<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">$</span>
					<input id="opening" type="number" inputmode="decimal" step="0.01" bind:value={form.openingBalance} use:clearOnFocus class="w-full pl-6" />
				</div>
			</div>
		</div>
	</form>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showModal = false)}>Cancel</Button>
		<Button type="submit" onclick={save}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Modal>
