<script lang="ts">
	/*
	 * PageHeader for the legacy pages (Settings, Accounts, Taxes, Goals,
	 * Business). Renders just the eyebrow + title + page-specific actions —
	 * TopNav already provides the brand wordmark, search, and dark-mode
	 * toggle globally, so we don't duplicate them here.
	 */
	interface Props {
		title: string;
		eyebrow?: string;
		subtitle?: string;
		subtitleContent?: import('svelte').Snippet;
		actions?: import('svelte').Snippet;
	}
	let { title, eyebrow, subtitle, subtitleContent, actions }: Props = $props();
</script>

<header class="px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-5 md:px-8 md:pt-2 md:pb-6">
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

		{#if actions}
			<div class="hidden shrink-0 md:flex md:flex-wrap md:items-center md:gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>

	<!-- Mobile-only: page-specific actions row, sitting below the title. -->
	{#if actions}
		<div class="mt-3 flex flex-wrap items-center gap-2 md:hidden">
			{@render actions()}
		</div>
	{/if}
</header>
