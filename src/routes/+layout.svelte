<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { bootstrap } from '$lib/db/bootstrap';
	import { theme } from '$lib/theme.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import PwaUpdateToast from '$lib/components/PwaUpdateToast.svelte';
	import IosInstallHint from '$lib/components/IosInstallHint.svelte';

	let { children } = $props();
	let ready = $state(false);

	onMount(async () => {
		await bootstrap();
		await theme.init();
		ready = true;
	});
</script>

<svelte:head>
	<title>Budget</title>
	<meta name="theme-color" content="#0f172a" />
</svelte:head>

<div class="flex min-h-screen flex-col md:flex-row">
	<Nav />
	<main class="flex-1 pb-20 md:pb-0">
		{#if ready}
			{@render children()}
		{:else}
			<div class="flex h-full items-center justify-center p-12 text-sm text-slate-500">
				Loading…
			</div>
		{/if}
	</main>
</div>

<PwaUpdateToast />
<IosInstallHint />
