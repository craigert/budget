<script lang="ts">
	import { theme } from '$lib/theme.svelte';
	import { downloadBackup, importJSON, wipeAll, type BackupFile } from '$lib/db/backup';
	import { importCSV, type CsvImportResult } from '$lib/db/csv';
	import { base } from '$app/paths';
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import { seedIfEmpty } from '$lib/db/seed';
	import type { Account, Category, Transaction, Budget } from '$lib/db/types';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';

	const accounts = live<Account[]>(() => db.accounts.toArray(), []);
	const categories = live<Category[]>(() => db.categories.toArray(), []);
	const transactions = live<Transaction[]>(() => db.transactions.toArray(), []);
	const budgets = live<Budget[]>(() => db.budgets.toArray(), []);

	let fileInput: HTMLInputElement;
	let csvInput: HTMLInputElement;
	let status = $state('');
	let busy = $state(false);

	async function handleFile(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		status = '';
		try {
			const text = await f.text();
			const parsed = JSON.parse(text) as BackupFile;
			const mode = confirm(
				`Replace all current data with the imported file?\n\nOK = REPLACE everything\nCancel = MERGE (overlay imported records on top)`
			)
				? 'replace'
				: 'merge';
			busy = true;
			await importJSON(parsed, mode);
			status = `Imported ${parsed.transactions?.length ?? 0} transactions.`;
		} catch (err) {
			status = `Import failed: ${(err as Error).message}`;
		} finally {
			busy = false;
			fileInput.value = '';
		}
	}

	async function handleCSV(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		status = '';
		try {
			const text = await f.text();
			const mode = confirm(
				`Replace existing transactions with the CSV's rows?\n\nOK = REPLACE all transactions (accounts, categories, budgets kept)\nCancel = APPEND (add CSV rows on top of existing transactions)`
			)
				? 'replace'
				: 'append';
			busy = true;
			const r: CsvImportResult = await importCSV(text, mode);
			const parts = [`Added ${r.transactionsAdded} transactions.`];
			if (r.accountsCreated) parts.push(`Created ${r.accountsCreated} account(s).`);
			if (r.categoriesCreated) parts.push(`Created ${r.categoriesCreated} categor${r.categoriesCreated === 1 ? 'y' : 'ies'}.`);
			if (r.skipped.length) parts.push(`Skipped ${r.skipped.length} row(s).`);
			status = parts.join(' ');
		} catch (err) {
			status = `Import failed: ${(err as Error).message}`;
		} finally {
			busy = false;
			csvInput.value = '';
		}
	}

	async function loadDemoData() {
		if (!confirm('Load 12 months of demo data? This REPLACES your current data.')) return;
		status = '';
		busy = true;
		try {
			const res = await fetch(`${base}/budget-demo.json`);
			if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
			const data = (await res.json()) as BackupFile;
			await importJSON(data, 'replace');
			status = `Loaded ${data.transactions?.length ?? 0} transactions, ${data.accounts?.length ?? 0} accounts, ${data.budgets?.length ?? 0} budgets.`;
		} catch (err) {
			status = `Load failed: ${(err as Error).message}`;
		} finally {
			busy = false;
		}
	}

	async function reseedDefaults() {
		if (!confirm('Re-add default categories you may have deleted?')) return;
		await db.settings.delete('seeded');
		await seedIfEmpty();
		status = 'Default categories restored.';
	}

	async function wipe() {
		const ok = prompt('Type DELETE to wipe all data. This cannot be undone.');
		if (ok !== 'DELETE') return;
		busy = true;
		await wipeAll();
		await seedIfEmpty();
		busy = false;
		status = 'All data wiped.';
	}
</script>

<PageHeader title="Settings" />

<div class="space-y-8 p-4 md:p-8">
	<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
		<h2 class="mb-4 text-lg font-semibold">Appearance</h2>
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm text-slate-600 dark:text-slate-400">Theme:</span>
			{#each ['light', 'dark', 'system'] as const as t (t)}
				<button
					class="rounded-md border px-3 py-1.5 text-sm capitalize {theme.value === t
						? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
						: 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800'}"
					onclick={() => theme.set(t)}
				>
					{t}
				</button>
			{/each}
		</div>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
		<h2 class="mb-2 text-lg font-semibold">Your data</h2>
		<p class="mb-4 text-sm text-slate-500">
			Everything lives in this browser's IndexedDB. Back it up regularly.
		</p>
		<dl class="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
			<div><dt class="text-slate-500">Accounts</dt><dd class="font-medium">{accounts.value.length}</dd></div>
			<div><dt class="text-slate-500">Categories</dt><dd class="font-medium">{categories.value.length}</dd></div>
			<div><dt class="text-slate-500">Transactions</dt><dd class="font-medium">{transactions.value.length}</dd></div>
			<div><dt class="text-slate-500">Budgets</dt><dd class="font-medium">{budgets.value.length}</dd></div>
		</dl>
		<div class="flex flex-wrap gap-2">
			<Button onclick={downloadBackup} disabled={busy}>Export JSON</Button>
			<Button variant="secondary" onclick={() => fileInput.click()} disabled={busy}>Import JSON…</Button>
			<Button variant="secondary" onclick={() => csvInput.click()} disabled={busy}>Import CSV…</Button>
			<Button variant="secondary" onclick={loadDemoData} disabled={busy}>Load demo data (12 months)</Button>
			<Button variant="ghost" onclick={reseedDefaults} disabled={busy}>Restore default categories</Button>
			<input bind:this={fileInput} type="file" accept="application/json,.json" class="hidden" onchange={handleFile} />
			<input bind:this={csvInput} type="file" accept="text/csv,.csv" class="hidden" onchange={handleCSV} />
		</div>
		<p class="mt-3 text-xs text-slate-500">
			CSV columns expected: <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">Date, Account, Type, Category, Payee, Expense, Income, Notes</code>. Missing accounts and categories are created automatically.
		</p>
		{#if status}
			<p class="mt-3 text-sm text-slate-600 dark:text-slate-400">{status}</p>
		{/if}
	</section>

	<section class="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900/40 dark:bg-red-950/30">
		<h2 class="mb-2 text-lg font-semibold text-red-800 dark:text-red-300">Danger zone</h2>
		<p class="mb-4 text-sm text-red-700 dark:text-red-400">Wipe all accounts, transactions, categories, and budgets.</p>
		<Button variant="danger" onclick={wipe} disabled={busy}>Wipe everything</Button>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
		<h2 class="mb-2 text-lg font-semibold">About</h2>
		<p class="text-sm text-slate-500">
			Budget — local-first PWA. No accounts, no servers, no tracking. Add to your home screen for the best experience.
		</p>
	</section>
</div>
