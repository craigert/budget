<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import { accountBalances } from '$lib/db/queries';
	import { ACCOUNT_TYPES, type Account, type AccountType, type Business } from '$lib/db/types';
	import { money } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { clearOnFocus } from '$lib/actions/clearOnFocus';
	import { base } from '$app/paths';

	const accounts = live<Account[]>(() => db.accounts.orderBy('createdAt').toArray(), []);
	const balances = live<Map<number, number>>(() => accountBalances(), new Map());
	const businesses = live<Business[]>(
		() => db.businesses.where('archived').equals(0).sortBy('sortOrder'),
		[]
	);

	let showModal = $state(false);
	let editing = $state<Account | null>(null);
	let form = $state({
		name: '',
		type: 'checking' as AccountType,
		openingBalance: 0,
		currency: 'USD',
		businessId: null as number | null
	});

	function openCreate() {
		editing = null;
		form = { name: '', type: 'checking', openingBalance: 0, currency: 'USD', businessId: null };
		showModal = true;
	}

	function openEdit(a: Account) {
		editing = a;
		form = {
			name: a.name,
			type: a.type,
			openingBalance: a.openingBalance,
			currency: a.currency,
			businessId: a.businessId ?? null
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
			currency: form.currency || 'USD',
			businessId: form.businessId ?? null
		};
		if (editing?.id) {
			await db.accounts.update(editing.id, payload);
		} else {
			await db.accounts.add({ ...payload, archived: 0, createdAt: Date.now() } as Account);
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
	const businessName = (id: number | null | undefined) =>
		id != null ? (businesses.value.find((b) => b.id === id)?.name ?? null) : null;

	function balanceOf(a: Account): number {
		return balances.value.get(a.id!) ?? a.openingBalance;
	}

	type Section = { key: string; label: string; types: AccountType[]; mode: 'asset' | 'liability' };
	const SECTIONS: Section[] = [
		{ key: 'cash', label: 'Cash', types: ['checking', 'savings', 'cash'], mode: 'asset' },
		{ key: 'investments', label: 'Investments', types: ['investment'], mode: 'asset' },
		{ key: 'credit', label: 'Credit cards', types: ['credit'], mode: 'liability' },
		{ key: 'loans', label: 'Loans', types: ['loan'], mode: 'liability' },
		{ key: 'other', label: 'Other', types: ['other'], mode: 'asset' }
	];

	const sections = $derived(
		SECTIONS.map((s) => ({ ...s, accounts: visible.filter((a) => s.types.includes(a.type)) }))
			.filter((s) => s.accounts.length > 0)
	);

	const assets = $derived(
		visible.filter((a) => !['credit', 'loan'].includes(a.type)).reduce((s, a) => s + balanceOf(a), 0)
	);
	const liabilities = $derived(
		visible.filter((a) => ['credit', 'loan'].includes(a.type)).reduce((s, a) => s + Math.abs(balanceOf(a)), 0)
	);
	const netWorth = $derived(assets - liabilities);

	function sectionTotal(s: { accounts: Account[]; mode: 'asset' | 'liability' }): number {
		const sum = s.accounts.reduce((acc, a) => acc + balanceOf(a), 0);
		return s.mode === 'liability' ? -Math.abs(sum) : sum;
	}
</script>

<PageHeader title="Accounts" eyebrow="NET WORTH VIEW">
	{#snippet actions()}
		<a
			href="{base}/transactions"
			class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
			style="background: var(--bs-text); color: var(--bs-bg);"
		>
			<Icon name="general/plus" size={14} />
			Add transaction
		</a>
	{/snippet}
</PageHeader>

<div class="space-y-6 p-4 md:p-8">
	{#if visible.length === 0}
		<div class="rounded-xl p-10 text-center" style="border: 1px dashed var(--bs-border-2); background: var(--bs-surface);">
			<p style="color: var(--bs-text-2);">No accounts yet. Add one to start tracking.</p>
			<div class="mt-4">
				<Button onclick={openCreate}>+ Add account</Button>
			</div>
		</div>
	{:else}
		<!-- KPI row: Assets / Liabilities / Net worth -->
		<div class="grid gap-4 sm:grid-cols-3">
			<div class="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
				<div class="mb-3.5 flex items-center justify-between">
					<span class="section-label">Assets</span>
					<span class="h-2 w-2 rounded-full" style="background: var(--bs-pos); opacity: 0.7;"></span>
				</div>
				<div class="bs-kpi">{money(assets)}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
				<div class="mb-3.5 flex items-center justify-between">
					<span class="section-label">Liabilities</span>
					<span class="h-2 w-2 rounded-full" style="background: var(--bs-neg); opacity: 0.7;"></span>
				</div>
				<div class="bs-kpi">{money(liabilities)}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
				<div class="mb-3.5 flex items-center justify-between">
					<span class="section-label">Net worth</span>
				</div>
				<div class="bs-kpi" style="color: {netWorth < 0 ? 'var(--bs-neg)' : 'var(--bs-text)'};">
					{money(netWorth)}
				</div>
			</div>
		</div>

		<!-- Account sections -->
		{#each sections as s (s.key)}
			{@const total = sectionTotal(s)}
			<section class="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" style="padding: 0;">
				<div class="flex items-baseline justify-between" style="padding: 16px var(--bs-pad-card);">
					<h2 class="text-base font-semibold" style="color: var(--bs-text);">{s.label}</h2>
					<span class="bs-mono" style="font-size: 13.5px; font-weight: 500; color: {total < 0 ? 'var(--bs-neg)' : 'var(--bs-text)'};">
						{money(total)}
					</span>
				</div>
				<ul style="border-top: 0.5px solid var(--bs-border);">
					{#each s.accounts as a (a.id)}
						{@const bal = balanceOf(a)}
						{@const displayBal = s.mode === 'liability' ? -Math.abs(bal) : bal}
						{@const biz = businessName(a.businessId)}
						<li class="group flex items-center gap-3" style="padding: 14px var(--bs-pad-card); border-bottom: 0.5px solid var(--bs-border);">
							<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style="background: var(--bs-surface-2); color: var(--bs-text-2); border: 0.5px solid var(--bs-border);">
								<Icon name="finance-ecommerce/wallet" size={16} />
							</div>
							<div class="min-w-0 flex-1">
								<div class="truncate text-sm font-medium" style="color: var(--bs-text); font-size: 13.5px;">{a.name}</div>
								<div class="flex items-center gap-1.5 truncate text-xs" style="color: var(--bs-text-3); font-size: 11.5px;">
									<span>{typeLabel(a.type)}</span>
									{#if biz}
										<span class="rounded-full px-1.5 py-px text-[10px] font-medium" style="background: color-mix(in oklch, var(--bs-brand) 12%, transparent); color: var(--bs-brand);">{biz}</span>
									{/if}
								</div>
							</div>
							<div class="bs-mono shrink-0 text-right" style="font-size: 13.5px; font-weight: 500; color: {displayBal < 0 ? 'var(--bs-neg)' : 'var(--bs-text)'};">
								{money(displayBal)}
							</div>
							<div class="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
								<button class="rounded-md p-1.5" style="color: var(--bs-text-3);" onclick={() => openEdit(a)} aria-label="Edit">
									<Icon name="general/edit-01" size={14} />
								</button>
								<button class="rounded-md p-1.5" style="color: var(--bs-text-3);" onclick={() => archiveAccount(a)} aria-label="Archive">
									<Icon name="general/archive" size={14} />
								</button>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/each}

		<!-- Connect another account -->
		<section class="flex flex-col items-center rounded-xl text-center" style="border: 1px dashed var(--bs-border-2); background: transparent; padding: 32px;">
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg" style="background: var(--bs-surface-2); color: var(--bs-text-2); border: 0.5px solid var(--bs-border);">
				<Icon name="general/link-01" size={18} />
			</div>
			<div class="text-sm font-medium" style="color: var(--bs-text);">Connect another account</div>
			<div class="mt-1 text-xs" style="color: var(--bs-text-3);">Add manually — bank linking is coming soon.</div>
			<button
				type="button"
				onclick={openCreate}
				class="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
				style="background: var(--bs-text); color: var(--bs-bg);"
			>
				<Icon name="general/plus" size={14} />
				Add account
			</button>
		</section>
	{/if}

	{#if archived.length}
		<details class="mt-2">
			<summary class="cursor-pointer text-sm" style="color: var(--bs-text-3);">Archived ({archived.length})</summary>
			<ul class="mt-3 space-y-2">
				{#each archived as a (a.id)}
					<li class="flex items-center justify-between rounded-md bg-white px-4 py-2 text-sm dark:bg-slate-900" style="border: 0.5px solid var(--bs-border);">
						<div>
							<span class="font-medium" style="color: var(--bs-text-2);">{a.name}</span>
							<span class="ml-2" style="color: var(--bs-text-3);">{typeLabel(a.type)}</span>
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
		{#if businesses.value.length > 0}
			<div>
				<label for="ownership" class="mb-1 block text-sm font-medium">Ownership</label>
				<select id="ownership" class="w-full" value={form.businessId ?? ''} onchange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value; form.businessId = v === '' ? null : Number(v); }}>
					<option value="">Personal</option>
					{#each businesses.value as b (b.id)}
						<option value={b.id}>{b.name}</option>
					{/each}
				</select>
			</div>
		{/if}
	</form>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showModal = false)}>Cancel</Button>
		<Button type="submit" onclick={save}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Modal>
