<script lang="ts">
	import { theme } from '$lib/theme.svelte';
	import { downloadBackup, importJSON, wipeAll, type BackupFile } from '$lib/db/backup';
	import { importCSV, readSpreadsheetAsCSV, type CsvImportResult } from '$lib/db/csv';
	import { base } from '$app/paths';
	import { db } from '$lib/db';
	import { live } from '$lib/db/live.svelte';
	import { seedIfEmpty } from '$lib/db/seed';
	import {
		AZURE_DEFAULTS,
		clearAzureConfig,
		getAzureConfig,
		saveAzureConfig,
		testAzureConfig,
		type AzureDocIntelConfig
	} from '$lib/db/azure';
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

	// === Azure Document Intelligence (receipt OCR) ===
	let azureForm = $state<AzureDocIntelConfig>({
		endpoint: '',
		key: '',
		model: AZURE_DEFAULTS.model,
		apiVersion: AZURE_DEFAULTS.apiVersion
	});
	let azureShowKey = $state(false);
	let azureBusy = $state(false);
	let azureStatus = $state<{ ok: boolean; message: string } | null>(null);
	let azureConfigured = $state(false);

	$effect(() => {
		(async () => {
			const cfg = await getAzureConfig();
			if (cfg) {
				azureForm = cfg;
				azureConfigured = true;
			}
		})();
	});

	async function saveAzure() {
		azureStatus = null;
		if (!azureForm.endpoint.trim() || !azureForm.key.trim()) {
			azureStatus = { ok: false, message: 'Endpoint and key are both required.' };
			return;
		}
		azureBusy = true;
		try {
			await saveAzureConfig(azureForm);
			azureConfigured = true;
			azureStatus = { ok: true, message: 'Saved. Receipts will now be sent to Azure for OCR.' };
		} catch (err) {
			azureStatus = { ok: false, message: `Save failed: ${(err as Error).message}` };
		} finally {
			azureBusy = false;
		}
	}

	async function testAzure() {
		azureStatus = null;
		if (!azureForm.endpoint.trim() || !azureForm.key.trim()) {
			azureStatus = { ok: false, message: 'Endpoint and key are both required.' };
			return;
		}
		azureBusy = true;
		try {
			azureStatus = await testAzureConfig(azureForm);
		} finally {
			azureBusy = false;
		}
	}

	async function clearAzure() {
		if (!confirm('Remove the saved Azure configuration?')) return;
		await clearAzureConfig();
		azureForm = { endpoint: '', key: '', model: AZURE_DEFAULTS.model, apiVersion: AZURE_DEFAULTS.apiVersion };
		azureConfigured = false;
		azureStatus = { ok: true, message: 'Cleared. Receipts will no longer be sent to Azure.' };
	}

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

	<!-- Azure Document Intelligence (receipt OCR) -->
	<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
		<div class="mb-4 flex items-start justify-between gap-3">
			<div>
				<h2 class="text-lg font-semibold">Receipt OCR · Azure Document Intelligence</h2>
				<p class="mt-1 text-sm text-slate-500">
					When configured, captured receipts are sent to Azure's prebuilt-receipt model and the merchant / total / date are auto-filled.
				</p>
			</div>
			{#if azureConfigured}
				<span class="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/20 dark:text-brand-100">Active</span>
			{/if}
		</div>

		<!-- Dev / demo warning -->
		<div class="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-700/50 dark:bg-amber-900/20">
			<div class="mb-1 font-semibold text-amber-800 dark:text-amber-200">⚠ Dev / demo configuration — not production-safe</div>
			<ul class="list-inside list-disc space-y-0.5 text-amber-800/90 dark:text-amber-200/85">
				<li>The key is stored in this browser's IndexedDB and is visible to anyone with DevTools access.</li>
				<li>Every receipt scan sends the key from the browser to Azure — visible in the Network tab.</li>
				<li>Azure CORS must allow this app's origin, or the request will fail. Typically requires a proxy (Cloudflare Worker, Azure Function, APIM).</li>
				<li>For multi-user / production, move this to a server-side proxy that holds the key as a secret.</li>
			</ul>
		</div>

		<div class="space-y-3">
			<div>
				<label for="az-endpoint" class="mb-1 block text-sm font-medium">Endpoint</label>
				<input
					id="az-endpoint"
					type="url"
					bind:value={azureForm.endpoint}
					placeholder="https://YOUR-RESOURCE.cognitiveservices.azure.com"
					class="w-full font-mono text-xs"
					autocomplete="off"
					spellcheck="false"
				/>
				<p class="mt-1 text-[11px] text-slate-500">Base URL of your Document Intelligence resource (no trailing path).</p>
			</div>

			<div>
				<label for="az-key" class="mb-1 block text-sm font-medium">Subscription key</label>
				<div class="flex gap-2">
					<input
						id="az-key"
						type={azureShowKey ? 'text' : 'password'}
						bind:value={azureForm.key}
						placeholder="32-character key from Azure Keys & Endpoint"
						class="w-full font-mono text-xs"
						autocomplete="off"
						spellcheck="false"
					/>
					<Button size="sm" variant="secondary" onclick={() => (azureShowKey = !azureShowKey)}>
						{azureShowKey ? 'Hide' : 'Show'}
					</Button>
				</div>
			</div>

			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<label for="az-model" class="mb-1 block text-sm font-medium">Model</label>
					<input
						id="az-model"
						type="text"
						bind:value={azureForm.model}
						placeholder={AZURE_DEFAULTS.model}
						class="w-full font-mono text-xs"
					/>
				</div>
				<div>
					<label for="az-api" class="mb-1 block text-sm font-medium">API version</label>
					<input
						id="az-api"
						type="text"
						bind:value={azureForm.apiVersion}
						placeholder={AZURE_DEFAULTS.apiVersion}
						class="w-full font-mono text-xs"
					/>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				<Button onclick={saveAzure} disabled={azureBusy}>{azureBusy ? 'Working…' : 'Save'}</Button>
				<Button variant="secondary" onclick={testAzure} disabled={azureBusy}>Test connection</Button>
				{#if azureConfigured}
					<Button variant="ghost" onclick={clearAzure} disabled={azureBusy}>Remove configuration</Button>
				{/if}
			</div>

			{#if azureStatus}
				<p
					class="rounded-md border px-3 py-2 text-sm {azureStatus.ok
						? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200'
						: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'}"
				>
					{azureStatus.message}
				</p>
			{/if}
		</div>
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
