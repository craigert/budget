<script lang="ts">
	import { theme } from '$lib/theme.svelte';
	import Icon from './Icon.svelte';
	import SearchOverlay from './SearchOverlay.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		subtitleContent?: import('svelte').Snippet;
		actions?: import('svelte').Snippet;
	}
	let { title, subtitle, subtitleContent, actions }: Props = $props();

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

<header class="bg-brand-500 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 text-white shadow-sm md:px-8 md:pt-5 md:pb-5">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
			{#if subtitleContent}
				{@render subtitleContent()}
			{:else if subtitle}
				<p class="mt-0.5 text-sm text-white/85">{subtitle}</p>
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
				class="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
			>
				<Icon name="general/search-md" size={18} />
			</button>
			<button
				type="button"
				onclick={toggle}
				aria-label="Toggle dark mode"
				title="Toggle dark mode"
				class="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
			>
				{#if theme.resolved === 'dark'}
					<Icon name="weather/sun" size={18} />
				{:else}
					<Icon name="weather/moon" size={18} />
				{/if}
			</button>
		</div>
	</div>
</header>

<SearchOverlay open={showSearch} onclose={() => (showSearch = false)} />
