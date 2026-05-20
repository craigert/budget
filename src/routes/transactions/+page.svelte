<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Account, Category, Transaction } from '$lib/db/types';
	import { money, formatDate, todayISO } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const accounts = live<Account[]>(() => db.accounts.toArray(), []);
	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const txs = live<Transaction[]>(
		() => db.transactions.orderBy('date').reverse().toArray(),
		[]
	);

	const accountMap = $derived(new Map(accounts.value.map((a) => [a.id!, a])));
	const categoryMap = $derived(new Map(categories.value.map((c) => [c.id!, c])));

	// filters
	let q = $state('');
	let accountFilter = $state<number | ''>('');
	let categoryFilter = $state<number | ''>('');
	let fromDate = $state('');
	let toDate = $state('');
	let pageSize = $state(50);
	let visibleCount = $state(50);

	const filtered = $derived.by(() => {
		const qq = q.trim().toLowerCase();
		return txs.value.filter((t) => {
			if (accountFilter !== '' && t.accountId !== accountFilter) return false;
			if (categoryFilter !== '' && t.categoryId !== categoryFilter) return false;
			if (fromDate && t.date < fromDate) return false;
			if (toDate && t.date > toDate) return false;
			if (qq) {
				const hay = `${t.payee} ${t.notes}`.toLowerCase();
				if (!hay.includes(qq)) return false;
			}
			return true;
		});
	});

	const shown = $derived(filtered.slice(0, visibleCount));
	const totalShown = $derived(filtered.reduce((sum, t) => sum + t.amount, 0));

	function resetFilters() {
		q = '';
		accountFilter = '';
		categoryFilter = '';
		fromDate = '';
		toDate = '';
		visibleCount = pageSize;
	}

	// edit form
	let showModal = $state(false);
	let editing = $state<Transaction | null>(null);
	let form = $state({
		date: todayISO(),
		accountId: 0,
		categoryId: null as number | null,
		amount: 0,
		isExpense: true,
		payee: '',
		notes: '',
		cleared: true,
		isBusiness: false
	});

	function openCreate() {
		editing = null;
		form = {
			date: todayISO(),
			accountId: accounts.value[0]?.id ?? 0,
			categoryId: null,
			amount: 0,
			isExpense: true,
			payee: '',
			notes: '',
			cleared: true,
			isBusiness: false
		};
		showModal = true;
	}

	function openEdit(t: Transaction) {
		editing = t;
		form = {
			date: t.date,
			accountId: t.accountId,
			categoryId: t.categoryId,
			amount: Math.abs(t.amount),
			isExpense: t.amount < 0,
			payee: t.payee,
			notes: t.notes,
			cleared: t.cleared === 1,
			isBusiness: t.isBusiness === 1
		};
		showModal = true;
	}

	async function save(e: Event) {
		e.preventDefault();
		if (!form.accountId) return;
		const signed = form.isExpense ? -Math.abs(form.amount) : Math.abs(form.amount);
		const payload = {
			date: form.date,
			accountId: form.accountId,
			categoryId: form.categoryId,
			amount: Number(signed) || 0,
			payee: form.payee.trim(),
			notes: form.notes.trim(),
			cleared: form.cleared ? 1 : 0,
			isBusiness: form.isBusiness ? 1 : 0
		};
		if (editing?.id) {
			await db.transactions.update(editing.id, payload);
		} else {
			await db.transactions.add({ ...payload, createdAt: Date.now() } as Transaction);
		}
		showModal = false;
	}

	async function remove(t: Transaction) {
		if (!t.id) return;
		if (!confirm(`Delete "${t.payee || 'transaction'}"?`)) return;
		await db.transactions.delete(t.id);
	}

	function loadMore() {
		visibleCount += pageSize;
	}

	// auto-switch isExpense based on category kind
	$effect(() => {
		if (form.categoryId == null) return;
		const cat = categoryMap.get(form.categoryId);
		if (cat) form.isExpense = cat.kind === 'expense';
	});
</script>

<PageHeader title="Transactions" subtitle={`${filtered.length} shown · net ${money(totalShown)}`}>
	{#snippet actions()}
		<Button variant="onbrand" onclick={openCreate} disabled={accounts.value.length === 0}>+ Transaction</Button>
	{/snippet}
</PageHeader>

<div class="space-y-4 p-4 md:p-8">
	<!-- Filter bar -->
	<div class="grid gap-2 md:grid-cols-6">
		<input type="search" bind:value={q} placeholder="Search payee or notes" class="md:col-span-2" />
		<select bind:value={accountFilter}>
			<option value="">All accounts</option>
			{#each accounts.value.filter((a) => a.archived === 0) as a (a.id)}
				<option value={a.id}>{a.name}</option>
			{/each}
		</select>
		<select bind:value={categoryFilter}>
			<option value="">All categories</option>
			{#each categories.value.filter((c) => c.archived === 0) as c (c.id)}
				<option value={c.id}>{c.name}</option>
			{/each}
		</select>
		<input type="date" bind:value={fromDate} aria-label="From date" />
		<input type="date" bind:value={toDate} aria-label="To date" />
	</div>
	<div class="flex items-center gap-2 text-sm">
		<button class="text-slate-500 hover:underline" onclick={resetFilters}>Clear filters</button>
	</div>

	{#if accounts.value.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
			Create an account first, then log transactions.
		</div>
	{:else if filtered.length === 0}
		<div class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
			No transactions match.
		</div>
	{:else}
		<ul class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
			{#each shown as t (t.id)}
				{@const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : null}
				{@const acct = accountMap.get(t.accountId)}
				<li class="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base"
						style="background:{cat?.color ?? '#94a3b8'}22;color:{cat?.color ?? '#475569'}"
					>
						{#if cat?.icon}<Icon name={cat.icon} size={20} />{:else}<span>·</span>{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<div class="truncate font-medium">{t.payee || '(no payee)'}</div>
							<div
								class="shrink-0 font-semibold tabular-nums {t.amount < 0
									? 'text-slate-900 dark:text-slate-100'
									: 'text-emerald-600 dark:text-emerald-400'}"
							>
								{money(t.amount)}
							</div>
						</div>
						<div class="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
							<span>{formatDate(t.date)}</span>
							<span aria-hidden>·</span>
							<span class="truncate">{cat?.name ?? 'Uncategorized'}</span>
							<span aria-hidden>·</span>
							<span class="truncate">{acct?.name ?? '?'}</span>
							{#if t.cleared === 0}
								<span class="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">pending</span>
							{/if}
						</div>
						{#if t.notes}
							<div class="mt-0.5 truncate text-xs text-slate-500">{t.notes}</div>
						{/if}
					</div>
					<div class="flex shrink-0 gap-1">
						<button
							class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
							onclick={() => openEdit(t)}
							aria-label="Edit"
						>
							<Icon name="general/edit-01" size={16} />
						</button>
						<button
							class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
							onclick={() => remove(t)}
							aria-label="Delete"
						>
							<Icon name="general/trash-01" size={16} />
						</button>
					</div>
				</li>
			{/each}
		</ul>

		{#if filtered.length > visibleCount}
			<div class="flex justify-center">
				<Button variant="secondary" onclick={loadMore}>Load more ({filtered.length - visibleCount} left)</Button>
			</div>
		{/if}
	{/if}
</div>

<Modal
	open={showModal}
	title={editing ? 'Edit transaction' : 'New transaction'}
	onclose={() => (showModal = false)}
>
	<form id="tx-form" onsubmit={save} class="space-y-4">
		<div class="flex rounded-md border border-slate-300 dark:border-slate-700">
			<button
				type="button"
				class="flex-1 rounded-l-md py-2 text-sm font-medium {form.isExpense
					? 'bg-red-500 text-white'
					: 'bg-transparent text-slate-700 dark:text-slate-300'}"
				onclick={() => (form.isExpense = true)}
			>
				Expense
			</button>
			<button
				type="button"
				class="flex-1 rounded-r-md py-2 text-sm font-medium {!form.isExpense
					? 'bg-emerald-500 text-white'
					: 'bg-transparent text-slate-700 dark:text-slate-300'}"
				onclick={() => (form.isExpense = false)}
			>
				Income
			</button>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="tx-date" class="mb-1 block text-sm font-medium">Date</label>
				<input id="tx-date" type="date" bind:value={form.date} class="w-full" required />
			</div>
			<div>
				<label for="tx-amount" class="mb-1 block text-sm font-medium">Amount</label>
				<input
					id="tx-amount"
					type="number"
					step="0.01"
					min="0"
					bind:value={form.amount}
					class="w-full"
					required
				/>
			</div>
		</div>

		<div>
			<label for="tx-account" class="mb-1 block text-sm font-medium">Account</label>
			<select id="tx-account" bind:value={form.accountId} class="w-full" required>
				{#each accounts.value.filter((a) => a.archived === 0) as a (a.id)}
					<option value={a.id}>{a.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="tx-cat" class="mb-1 block text-sm font-medium">Category</label>
			<select id="tx-cat" bind:value={form.categoryId} class="w-full">
				<option value={null}>Uncategorized</option>
				{#each categories.value.filter((c) => c.archived === 0 && c.kind === (form.isExpense ? 'expense' : 'income')) as c (c.id)}
					<option value={c.id}>{c.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="tx-payee" class="mb-1 block text-sm font-medium">Payee</label>
			<input id="tx-payee" type="text" bind:value={form.payee} class="w-full" placeholder="e.g. Trader Joe's" />
		</div>

		<div>
			<label for="tx-notes" class="mb-1 block text-sm font-medium">Notes</label>
			<textarea id="tx-notes" bind:value={form.notes} class="w-full" rows="2"></textarea>
		</div>

		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={form.cleared} class="rounded" />
			Cleared (transaction has posted)
		</label>

		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={form.isBusiness} class="rounded" />
			Business transaction
		</label>
	</form>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showModal = false)}>Cancel</Button>
		<Button type="submit" onclick={save}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Modal>
