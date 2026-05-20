<script lang="ts">
	interface Props {
		title: string;
		subtitle?: string;
		actions?: import('svelte').Snippet;
	}
	let { title, subtitle, actions }: Props = $props();
</script>

<header class="bg-brand-500 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 text-white shadow-sm md:px-8 md:pt-5 md:pb-5">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
			{#if subtitle}
				<p class="mt-0.5 text-sm text-white/85">{subtitle}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex flex-wrap items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
</header>
