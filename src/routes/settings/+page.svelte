<script lang="ts">
	import { theme } from '$lib/theme.svelte';
	import { downloadBackup, importJSON, wipeAll, type BackupFile } from '$lib/db/backup';
	import { importCSV, readSpreadsheetAsCSV, type CsvImportResult } from '$lib/db/csv';
	import { base } from '$app/paths';
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import { seedIfEmpty } from '$lib/db/seed';
	import type { Account, Category, Transaction, Budget } from '$lib/db/types';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import { tweaks } from '$lib/uiState.svelte';
	import { PALETTES, TYPOGRAPHY } from '$lib/theme.svelte';
	import { installPrompt } from '$lib/installPrompt.svelte';

	let installStatus = $state<string | null>(null);

	async function handleInstall() {
		const result = await installPrompt.show();
		if (result === 'accepted') installStatus = 'Installing…';
		else if (result === 'dismissed') installStatus = 'Maybe next time.';
		else installStatus = null;
	}

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
			const text = await readSpreadsheetAsCSV(f);
			const mode = confirm(
				`Replace existing transactions with the file's rows?\n\nOK = REPLACE all transactions (accounts, categories, budgets kept)\nCancel = APPEND (add rows on top of existing transactions)`
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
		if (!confirm('Reload from default-budget.xlsx? This REPLACES your transactions.')) return;
		status = '';
		busy = true;
		try {
			// Prefer xlsx, fall back to csv
			let csvText: string | null = null;
			const xlsx = await fetch(`${base}/default-budget.xlsx`);
			if (xlsx.ok) {
				const buf = await xlsx.arrayBuffer();
				const XLSX = await import('xlsx');
				const wb = XLSX.read(buf, { type: 'array' });
				const sheet = wb.SheetNames[0];
				if (sheet) csvText = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
			}
			if (!csvText) {
				const csv = await fetch(`${base}/default-budget.csv`);
				if (csv.ok) csvText = await csv.text();
			}
			if (!csvText) throw new Error('default-budget.xlsx / .csv not found in static');
			const r: CsvImportResult = await importCSV(csvText, 'replace');
			status = `Loaded ${r.transactionsAdded} transactions, ${r.accountsCreated} new account(s), ${r.categoriesCreated} new categor${r.categoriesCreated === 1 ? 'y' : 'ies'}.`;
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

	/**
	 * Tears down the service worker + Workbox caches and reloads. Useful when
	 * an old SW is serving stale HTML that's missing newer PWA capabilities
	 * (manifest link, install criteria, etc.) — the user otherwise has to
	 * go into browser site-settings to clear it.
	 *
	 * Leaves IndexedDB / localStorage alone so the user's data survives.
	 */
	async function resetPwaCache() {
		if (!confirm('Unregister the service worker and clear PWA caches, then reload? Your data stays.')) return;
		busy = true;
		status = 'Resetting PWA cache…';
		try {
			if ('serviceWorker' in navigator) {
				const regs = await navigator.serviceWorker.getRegistrations();
				await Promise.all(regs.map((r) => r.unregister()));
			}
			if ('caches' in window) {
				const keys = await caches.keys();
				await Promise.all(keys.map((k) => caches.delete(k)));
			}
			location.reload();
		} catch (err) {
			status = `Reset failed: ${(err as Error).message}`;
			busy = false;
		}
	}
</script>

<PageHeader title="Settings" />

<div class="space-y-8 p-4 md:p-8">
	{#if installPrompt.canInstall}
		<section class="rounded-xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-800 dark:bg-brand-900/20">
			<div class="flex flex-wrap items-center gap-3">
				<div class="flex-1 min-w-0">
					<h2 class="text-lg font-semibold text-brand-800 dark:text-brand-200">Install BudgetSparrow</h2>
					<p class="mt-1 text-sm text-brand-700/80 dark:text-brand-200/80">
						Add it to your home screen for a faster, full-screen experience.
					</p>
					{#if installStatus}
						<p class="mt-2 text-xs text-brand-700 dark:text-brand-300">{installStatus}</p>
					{/if}
				</div>
				<Button onclick={handleInstall}>Install</Button>
			</div>
		</section>
	{/if}

	<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-3 flex flex-wrap items-start justify-between gap-3">
			<div>
				<h2 class="text-lg font-semibold">Appearance</h2>
				<p class="mt-1 text-sm" style="color: var(--bs-text-2);">
					Palette, typography, density, radius — open the Tweaks panel to preview each one live.
				</p>
			</div>
			<Button onclick={() => tweaks.show()}>Open Tweaks</Button>
		</div>
		<dl class="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
			<div>
				<dt style="color: var(--bs-text-3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;">Mode</dt>
				<dd class="mt-0.5 font-medium capitalize">{theme.value}</dd>
			</div>
			<div>
				<dt style="color: var(--bs-text-3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;">Palette</dt>
				<dd class="mt-0.5 font-medium">{PALETTES[theme.palette].label}</dd>
			</div>
			<div>
				<dt style="color: var(--bs-text-3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;">Typography</dt>
				<dd class="mt-0.5 font-medium">{TYPOGRAPHY[theme.typography].label}</dd>
			</div>
			<div>
				<dt style="color: var(--bs-text-3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;">Density</dt>
				<dd class="mt-0.5 font-medium capitalize">{theme.density}</dd>
			</div>
		</dl>
		<div class="mt-4 flex flex-wrap items-center gap-2">
			<span class="text-sm" style="color: var(--bs-text-2);">Quick mode:</span>
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
			<Button variant="secondary" onclick={() => csvInput.click()} disabled={busy}>Import CSV / XLSX…</Button>
			<Button variant="secondary" onclick={loadDemoData} disabled={busy}>Reload default-budget.xlsx</Button>
			<Button variant="ghost" onclick={reseedDefaults} disabled={busy}>Restore default categories</Button>
			<input bind:this={fileInput} type="file" accept="application/json,.json" class="hidden" onchange={handleFile} />
			<input bind:this={csvInput} type="file" accept="text/csv,.csv,.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" class="hidden" onchange={handleCSV} />
		</div>
		<p class="mt-3 text-xs text-slate-500">
			CSV/XLSX columns expected: <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">Date, Account, Type, Category, Payee, Expense, Income, Notes</code>. Missing accounts and categories are created automatically. For XLSX, the first sheet is imported.
		</p>
		{#if status}
			<p class="mt-3 text-sm text-slate-600 dark:text-slate-400">{status}</p>
		{/if}
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
		<h2 class="mb-2 text-lg font-semibold">Troubleshooting</h2>
		<p class="mb-4 text-sm text-slate-500">
			If the app looks out of date, isn't offering to install, or is serving an old version, reset
			the service worker cache. Your transactions, budgets, and settings are kept.
		</p>
		<Button variant="secondary" onclick={resetPwaCache} disabled={busy}>Reset PWA cache &amp; reload</Button>
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
