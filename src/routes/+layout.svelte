<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { bootstrap } from '$lib/db/bootstrap';
	import { theme } from '$lib/theme.svelte';
	import TopNav from '$lib/components/TopNav.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import TweaksPanel from '$lib/components/TweaksPanel.svelte';
	import PwaUpdateToast from '$lib/components/PwaUpdateToast.svelte';
	import IosInstallHint from '$lib/components/IosInstallHint.svelte';
	import { tweaks } from '$lib/uiState.svelte';

	let { children } = $props();
	let ready = $state(false);

	onMount(async () => {
		await bootstrap();
		await theme.init();
		ready = true;
	});

	// Safety net: close the Tweaks drawer whenever the route changes so it
	// can never appear "auto-opened" on a page the user just navigated to.
	$effect(() => {
		// track pathname so the effect re-runs on every navigation
		page.url.pathname;
		tweaks.hide();
	});
</script>

<svelte:head>
	<title>BudgetSparrow</title>
</svelte:head>

<TopNav />

<main class="bs-main">
	{#if ready}
		{#key page.url.pathname}
			<div class="bs-tab-content">
				{@render children()}
			</div>
		{/key}
	{:else}
		<div class="bs-loading">Loading…</div>
	{/if}
</main>

<!-- Mobile bottom bar (Nav's sidebar mode is suppressed via CSS in layout.css). -->
<div class="bs-mobile-nav-only">
	<Nav />
</div>

<!-- TweaksPanel lives at the layout root, above .bs-tab-content's animation
     transform so its position:fixed actually resolves to the viewport. -->
<TweaksPanel open={tweaks.open} onclose={() => tweaks.hide()} />

<PwaUpdateToast />
<IosInstallHint />

<style>
	.bs-main {
		max-width: 1240px;
		margin: 0 auto;
		padding: 28px 40px 56px;
		min-height: calc(100vh - 64px);
	}
	@media (max-width: 920px) {
		.bs-main {
			padding: 16px 16px 96px;
		}
	}

	/* Each tab navigation replays both animations: parent slides up (.bs-d-in)
	   and every direct child cascades in via the per-nth-child stagger defined
	   in layout.css (.bs-tab-content > *). */
	.bs-tab-content {
		display: flex;
		flex-direction: column;
		gap: 16px;
		animation: bs-d-in 380ms cubic-bezier(0.3, 0.8, 0.3, 1);
	}
	@keyframes bs-d-in {
		from {
			transform: translateY(10px);
		}
		to {
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bs-tab-content {
			animation: none;
		}
	}

	.bs-loading {
		display: flex;
		min-height: 60vh;
		align-items: center;
		justify-content: center;
		padding: 48px;
		font-size: 14px;
		color: var(--bs-text-2);
	}

	:global(.bs-mobile-nav-only aside) {
		display: none !important;
	}
</style>
