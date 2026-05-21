<script lang="ts">
	import { theme } from '$lib/theme.svelte';
	import Icon from './Icon.svelte';
	import SearchOverlay from './SearchOverlay.svelte';

	interface Props {
		title: string;
		eyebrow?: string;
		subtitle?: string;
		subtitleContent?: import('svelte').Snippet;
		actions?: import('svelte').Snippet;
	}
	let { title, eyebrow, subtitle, subtitleContent, actions }: Props = $props();

	let showSearch = $state(false);

	function toggle() {
		theme.set(theme.resolved === 'dark' ? 'light' : 'dark');
	}

	function onkeydown(e: KeyboardEvent) {
		// Ctrl/Cmd+K opens search
		const meta = e.ctrlKey || e.metaKey;
		if (meta && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			showSearch = true;
		}
	}
</script>

<svelte:window onkeydown={onkeydown} />

<!--
	PageHeader, per the Claude Design hand-off.
	Switched from a green hero bar to a clean, breathable cream header:
	muted-uppercase eyebrow on top, large bold title below, action pills
	on the right (search / dark-mode / page-provided actions). Sits on
	--bs-bg so the header blends into the page body — no abrupt color
	transition between header and content.
-->
<header
	class="flex flex-wrap items-end justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-5 md:px-8 md:pt-7 md:pb-6"
>
	<div class="min-w-0">
		{#if eyebrow}
			<div
				class="mb-1 text-[11px] font-medium uppercase tracking-[0.12em]"
				style="color: var(--bs-text-3);"
			>
				{eyebrow}
			</div>
		{/if}
		<h1
			class="text-2xl font-semibold tracking-tight md:text-3xl"
			style="font-family: var(--bs-font-display); color: var(--bs-text); letter-spacing: -0.02em;"
		>
			{title}
		</h1>
		{#if subtitleContent}
			{@render subtitleContent()}
		{:else if subtitle}
			<p class="mt-1 text-sm" style="color: var(--bs-text-2);">{subtitle}</p>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-2">
		{#if actions}
			{@render actions()}
		{/if}
		<button
			type="button"
			onclick={() => (showSearch = true)}
			aria-label="Search (Ctrl+K)"
			title="Search transactions"
			class="bs-icon-btn"
		>
			<Icon name="general/search-md" size={16} />
		</button>
		<button
			type="button"
			onclick={toggle}
			aria-label="Toggle dark mode"
			title="Toggle dark mode"
			class="bs-icon-btn"
		>
			{#if theme.resolved === 'dark'}
				<Icon name="weather/sun" size={16} />
			{:else}
				<Icon name="weather/moon" size={16} />
			{/if}
		</button>
	</div>
</header>

<SearchOverlay open={showSearch} onclose={() => (showSearch = false)} />

<style>
	/* Small circular pill button used for icon actions in the header.
	   Pulls from --bs-* so it adapts to light/dark + future palette swaps. */
	:global(.bs-icon-btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 999px;
		background: var(--bs-surface);
		color: var(--bs-text-2);
		border: 0.5px solid var(--bs-border);
		box-shadow: var(--bs-shadow);
		transition: background-color 0.15s ease, color 0.15s ease, transform 0.05s ease;
	}
	:global(.bs-icon-btn:hover) {
		background: var(--bs-surface-2);
		color: var(--bs-text);
	}
	:global(.bs-icon-btn:active) {
		transform: scale(0.96);
	}
</style>
