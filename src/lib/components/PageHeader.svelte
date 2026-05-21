<script lang="ts">
	import { theme } from '$lib/theme.svelte';
	import Icon from './Icon.svelte';
	import SearchOverlay from './SearchOverlay.svelte';
	import { base } from '$app/paths';

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
		const meta = e.ctrlKey || e.metaKey;
		if (meta && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			showSearch = true;
		}
	}
</script>

<svelte:window onkeydown={onkeydown} />

<!--
	PageHeader, per the Claude Design hand-off, with a mobile-aware layout:

	- Title row: eyebrow + title (+ subtitle) on the left, search/dark-mode
	  pills on the right. Stays single-row at every breakpoint so the icon
	  buttons are reachable from the top-right corner on mobile.
	- Actions row: a snippet from the calling page (e.g. "+ Transaction").
	  On mobile, wraps below the title row. On desktop, hidden in that slot
	  and instead rendered inline next to the icon buttons via the desktop-only
	  cluster — keeping the design's "title left, primary action right" feel
	  on wide screens.
-->
<header class="px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-5 md:px-8 md:pt-7 md:pb-6">
	<!--
		Mobile-only wordmark: the desktop sidebar carries the BudgetSparrow
		identity, but on mobile the sidebar is replaced by the bottom nav and
		the bird + name disappear. Drop a small wordmark above the page title
		so the brand stays anchored at the top of every screen.
	-->
	<a
		href={`${base}/`}
		class="mb-4 inline-flex items-center gap-2 transition-opacity hover:opacity-80 md:hidden"
		aria-label="BudgetSparrow home"
	>
		<img src={`${base}/logo.png`} alt="" class="h-7 w-auto object-contain shrink-0" />
		<span
			class="text-base font-semibold tracking-tight"
			style="font-family: var(--bs-font-display); color: var(--bs-text); letter-spacing: -0.02em;"
		>
			Budget<span style="font-weight: 600; color: var(--bs-accent);">Sparrow</span>
		</span>
	</a>

	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
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

		<div class="flex shrink-0 items-center gap-2">
			<!-- Desktop-only: page-specific actions inline before the icon pills -->
			{#if actions}
				<div class="hidden md:flex md:flex-wrap md:items-center md:gap-2">
					{@render actions()}
				</div>
			{/if}
			<!-- Always-visible search + dark-mode pills, top-right -->
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
	</div>

	<!-- Mobile-only: page-specific actions row, sitting below the title. -->
	{#if actions}
		<div class="mt-3 flex flex-wrap items-center gap-2 md:hidden">
			{@render actions()}
		</div>
	{/if}
</header>

<SearchOverlay open={showSearch} onclose={() => (showSearch = false)} />

<style>
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
