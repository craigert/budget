<script lang="ts">
	import { theme } from '$lib/theme.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		actions?: import('svelte').Snippet;
	}
	let { title, subtitle, actions }: Props = $props();

	function toggle() {
		theme.set(theme.resolved === 'dark' ? 'light' : 'dark');
	}
</script>

<header class="bg-brand-500 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 text-white shadow-sm md:px-8 md:pt-5 md:pb-5">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
			{#if subtitle}
				<p class="mt-0.5 text-sm text-white/85">{subtitle}</p>
			{/if}
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if actions}
				{@render actions()}
			{/if}
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
