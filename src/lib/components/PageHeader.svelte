<script lang="ts">
	interface Props {
		title: string;
		subtitle?: string;
		actions?: import('svelte').Snippet;
	}
	let { title, subtitle, actions }: Props = $props();
</script>

<header class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 md:px-8 dark:border-slate-800 dark:bg-slate-900">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
		{#if subtitle}
			<p class="mt-0.5 text-sm text-slate-500">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">
			{@render actions()}
		</div>
	{/if}
</header>
