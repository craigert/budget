<script lang="ts">
	import { base } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';

	function tryAgain() {
		// Force a reload that bypasses the SW navigation handler.
		location.assign(`${base}/`);
	}
</script>

<svelte:head>
	<title>Offline — BudgetSparrow</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-6 text-center">
	<div class="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
		<Icon name="general/cloud-blank" size={28} />
	</div>
	<h1 class="mt-5 text-xl font-semibold text-slate-900 dark:text-slate-100">You're offline</h1>
	<p class="mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-300">
		BudgetSparrow keeps your data on this device, so most things still work without a connection.
		Receipt OCR is the only feature that needs the network.
	</p>
	<button
		type="button"
		onclick={tryAgain}
		class="mt-6 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
	>
		Try again
	</button>
</div>
