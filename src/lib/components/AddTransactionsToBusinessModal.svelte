<script lang="ts">
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import type { Account, Business, Category, Transaction } from '$lib/db/types';
	import { money, formatDate } from '$lib/utils/format';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open: boolean;
		businesses: Business[];
		defaultBusinessId?: number | null;
		onclose: () => void;
		ontagged?: (count: number, businessId: number) => void;
	}

	let { open, businesses, defaultBusinessId = null, onclose, ontagged }: Props = $props();

	const accounts = live<Account[]>(() => db.accounts.toArray(), []);
	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const untagged = live<Transaction[]>(
		() =>
			db.transactions
				.toArray()
				.then((arr) =>
					arr
						.filter((t) => t.businessId == null)
						.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
				),
		[]
	);

	const accountMap = $derived(new Map(accounts.value.map((a) => [a.id!, a])));
	const categoryMap = $derived(new Map(categories.value.map((c) => [c.id!, c])));

	let targetBusinessId = $state<number | null>(null);
	let q = $state('');
	let fromDate = $state('');
	let toDate = $state('');
	let selected = $state<Set<number>>(new Set());
	let busy = $state(false);

	// Re-init state every time the modal opens
	$effect(() => {
		if (open) {
			targetBusinessId =
				defaultBusinessId ?? (businesses.length > 0 ? businesses[0].id! : null);
			q = '';
			fromDate = '';
			toDate = '';
			selected = new Set();
			busy = false;
		}
	});

	const filtered = $derived.by(() => {
		const qq = q.trim().toLowerCase();
		return untagged.value.filter((t) => {
			if (fromDate && t.date < fromDate) return false;
			if (toDate && t.date > toDate) return false;
			if (qq) {
				const acct = accountMap.get(t.accountId)?.name ?? '';
				const cat = t.categoryId != null ? categoryMap.get(t.categoryId)?.name ?? '' : '';
				const hay = `${t.payee} ${t.notes} ${acct} ${cat}`.toLowerCase();
				if (!hay.includes(qq)) return false;
			}
			return true;
		});
	});

	function toggle(id: number) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function selectAllFiltered() {
		const next = new Set(selected);
		for (const t of filtered) if (t.id != null) next.add(t.id);
		selected = next;
	}
	function clearSelection() {
		selected = new Set();
	}

	const allFilteredSelected = $derived(
		filtered.length > 0 && filtered.every((t) => t.id != null && selected.has(t.id))
	);

	async function apply() {
		if (!targetBusinessId || selected.size === 0) return;
		busy = true;
		try {
			const ids = [...selected];
			await db.transactions.bulkUpdate(
				ids.map((id) => ({ key: id, changes: { businessId: targetBusinessId } }))
			);
			ontagged?.(ids.length, targetBusinessId);
			onclose();
		} finally {
			busy = false;
		}
	}

	const targetBiz = $derived(
		targetBusinessId != null ? businesses.find((b) => b.id === targetBusinessId) ?? null : null
	);
</script>

<Modal {open} title="Add transactions to a business" {onclose}>
	<div class="space-y-4">
		<!-- Target business + selection summary -->
		<div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
			<div>
				<label for="target-biz" class="mb-1 block text-sm font-medium">Tag selected as</label>
				<select id="target-biz" bind:value={targetBusinessId} class="w-full">
					<option value={null} disabled>— pick a business —</option>
					{#each businesses as b (b.id)}
						<option value={b.id}>{b.name}</option>
					{/each}
				</select>
			</div>
			<div class="text-sm text-slate-500">
				{selected.size} selected
			</div>
		</div>

		<!-- Filters -->
		<div class="grid gap-2 sm:grid-cols-3">
			<input type="search" bind:value={q} placeholder="Search payee, account, category" />
			<input type="date" bind:value={fromDate} aria-label="From date" />
			<input type="date" bind:value={toDate} aria-label="To date" />
		</div>

		<div class="flex items-center justify-between text-xs text-slate-500">
			<span>{filtered.length} of {untagged.value.length} untagged</span>
			<div class="flex gap-3">
				<button class="hover:underline" onclick={selectAllFiltered} disabled={filtered.length === 0}>
					Select {allFilteredSelected ? '' : 'all '}filtered
				</button>
				<button class="hover:underline" onclick={clearSelection} disabled={selected.size === 0}>
					Clear
				</button>
			</div>
		</div>

		<!-- Scrollable transaction list -->
		<div class="max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
			{#if untagged.value.length === 0}
				<p class="p-6 text-center text-sm text-slate-500">
					Every transaction is already tagged to a business.
				</p>
			{:else if filtered.length === 0}
				<p class="p-6 text-center text-sm text-slate-500">No transactions match.</p>
			{:else}
				<ul class="divide-y divide-slate-100 dark:divide-slate-800">
					{#each filtered.slice(0, 200) as t (t.id)}
						{@const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : null}
						{@const acct = accountMap.get(t.accountId)}
						{@const isSel = t.id != null && selected.has(t.id)}
						<li>
							<label
								class="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors {isSel
									? 'bg-brand-50 dark:bg-brand-500/10'
									: 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}"
							>
								<input
									type="checkbox"
									class="shrink-0 rounded"
									checked={isSel}
									onchange={() => t.id != null && toggle(t.id)}
								/>
								<div
									class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
									style="background:{cat?.color ?? '#94a3b8'}22;color:{cat?.color ?? '#475569'}"
								>
									{#if cat?.icon}<Icon name={cat.icon} size={18} />{:else}<span>·</span>{/if}
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-baseline justify-between gap-2">
										<div class="truncate text-sm font-medium">{t.payee || '(no payee)'}</div>
										<div class="shrink-0 text-sm font-semibold tabular-nums {t.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}">
											{money(t.amount)}
										</div>
									</div>
									<div class="text-xs text-slate-500">
										{formatDate(t.date)} · {cat?.name ?? 'Uncategorized'} · {acct?.name ?? '?'}
									</div>
								</div>
							</label>
						</li>
					{/each}
					{#if filtered.length > 200}
						<li class="px-3 py-2 text-center text-xs text-slate-500">
							Showing first 200 of {filtered.length}. Narrow the filters to see more.
						</li>
					{/if}
				</ul>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose}>Cancel</Button>
		<Button
			disabled={!targetBusinessId || selected.size === 0 || busy}
			onclick={apply}
		>
			Add {selected.size} to {targetBiz?.name ?? 'business'}
		</Button>
	{/snippet}
</Modal>
