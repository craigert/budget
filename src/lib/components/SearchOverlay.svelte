<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { db } from '$lib/db';
	import type { Account, Category, Transaction } from '$lib/db/types';
	import { money, formatDate } from '$lib/utils/format';
	import Icon from './Icon.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}
	let { open, onclose }: Props = $props();

	let query = $state('');
	let busy = $state(false);
	let results = $state<{ transactions: Transaction[]; accountMap: Map<number, Account>; categoryMap: Map<number, Category> }>({
		transactions: [],
		accountMap: new Map(),
		categoryMap: new Map()
	});

	let inputEl: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (open) {
			query = '';
			results = { transactions: [], accountMap: new Map(), categoryMap: new Map() };
			// Focus input on next tick
			requestAnimationFrame(() => inputEl?.focus());
		}
	});

	let searchSeq = 0;
	$effect(() => {
		const q = query.trim().toLowerCase();
		if (!open || !q) {
			results = { transactions: [], accountMap: new Map(), categoryMap: new Map() };
			return;
		}
		const mySeq = ++searchSeq;
		busy = true;
		(async () => {
			// Run all lookups in parallel
			const [accounts, categories, allTxs] = await Promise.all([
				db.accounts.toArray(),
				db.categories.toArray(),
				db.transactions.toArray()
			]);
			if (mySeq !== searchSeq) return;
			const accountMap = new Map(accounts.map((a) => [a.id!, a]));
			const categoryMap = new Map(categories.map((c) => [c.id!, c]));
			const numericQuery = Number(q.replace(/[^0-9.\-]/g, ''));
			const hasNumeric = !Number.isNaN(numericQuery) && q.match(/[0-9]/);

			const filtered = allTxs.filter((t) => {
				if (t.payee?.toLowerCase().includes(q)) return true;
				if (t.notes?.toLowerCase().includes(q)) return true;
				if (t.categoryId != null) {
					const cat = categoryMap.get(t.categoryId);
					if (cat?.name.toLowerCase().includes(q)) return true;
				}
				const acct = accountMap.get(t.accountId);
				if (acct?.name.toLowerCase().includes(q)) return true;
				if (hasNumeric && Math.abs(t.amount) === Math.abs(numericQuery)) return true;
				return false;
			});

			// Newest first, cap to 40
			filtered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
			if (mySeq !== searchSeq) return;
			results = { transactions: filtered.slice(0, 40), accountMap, categoryMap };
			busy = false;
		})();
	});

	function selectResult(t: Transaction) {
		const q = encodeURIComponent(t.payee || '');
		const url = `${base}/transactions${q ? `?q=${q}` : ''}`;
		goto(url);
		onclose();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={open ? onkeydown : null} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 backdrop-blur-sm sm:pt-[10vh]"
		role="dialog"
		aria-modal="true"
		onclick={onclose}
		onkeydown={(e) => e.key === 'Enter' && onclose()}
		tabindex="-1"
	>
		<div
			class="flex max-h-[80dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
			onclick={(e) => e.stopPropagation()}
			role="document"
			onkeydown={(e) => e.stopPropagation()}
		>
			<!-- Search input -->
			<div class="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
				<Icon name="general/search-md" size={20} />
				<input
					bind:this={inputEl}
					bind:value={query}
					type="search"
					placeholder="Search transactions by payee, category, account, notes, or amount…"
					class="!border-0 !bg-transparent !ring-0 flex-1 text-base !shadow-none focus:!ring-0"
					autocomplete="off"
				/>
				<button
					type="button"
					onclick={onclose}
					class="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
					aria-label="Close"
				>
					✕
				</button>
			</div>

			<!-- Results -->
			<div class="flex-1 overflow-y-auto">
				{#if !query.trim()}
					<div class="p-8 text-center text-sm text-slate-500">
						Start typing to search every transaction.
					</div>
				{:else if busy}
					<div class="p-8 text-center text-sm text-slate-500">Searching…</div>
				{:else if results.transactions.length === 0}
					<div class="p-8 text-center text-sm text-slate-500">
						No matches for "<span class="font-medium text-slate-700 dark:text-slate-300">{query}</span>".
					</div>
				{:else}
					<ul class="divide-y divide-slate-100 dark:divide-slate-800">
						{#each results.transactions as t (t.id)}
							{@const cat = t.categoryId != null ? results.categoryMap.get(t.categoryId) : null}
							{@const acct = results.accountMap.get(t.accountId)}
							<li>
								<button
									type="button"
									onclick={() => selectResult(t)}
									class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
								>
									<div
										class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
										style="background:{cat?.color ?? '#94a3b8'}22;color:{cat?.color ?? '#475569'}"
									>
										{#if cat?.icon}<Icon name={cat.icon} size={18} />{:else}<span>·</span>{/if}
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-baseline justify-between gap-2">
											<div class="truncate text-sm font-medium">{t.payee || '(no payee)'}</div>
											<div
												class="shrink-0 text-sm font-semibold tabular-nums {t.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}"
											>
												{money(t.amount)}
											</div>
										</div>
										<div class="text-xs text-slate-500">
											{formatDate(t.date)} · {cat?.name ?? 'Uncategorized'} · {acct?.name ?? '?'}
										</div>
									</div>
								</button>
							</li>
						{/each}
					</ul>
					{#if results.transactions.length === 40}
						<div class="px-4 py-2 text-center text-xs text-slate-500">
							Showing first 40 matches. Narrow your search to see more.
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
