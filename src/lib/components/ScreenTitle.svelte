<script lang="ts">
	/*
	 * Page header per the Claude Design Forest reference's TopBar (Desktop):
	 * a small muted eyebrow above a big italic Fraunces title. Actions slot
	 * sits on the right of the title row.
	 *
	 * Top-level chrome (search, dark toggle, +Add, avatar) lives in TopNav,
	 * so this header is just title + eyebrow + page-specific actions.
	 */
	interface Props {
		title: string;
		eyebrow?: string;
		actions?: import('svelte').Snippet;
	}
	let { title, eyebrow, actions }: Props = $props();
</script>

<div class="bs-screen-title">
	<div class="bs-screen-title-text">
		{#if eyebrow}
			<div class="bs-screen-title-eyebrow">{eyebrow}</div>
		{/if}
		<h1 class="bs-screen-title-h1">{title}</h1>
	</div>
	{#if actions}
		<div class="bs-screen-title-actions">
			{@render actions()}
		</div>
	{/if}
</div>

<style>
	.bs-screen-title {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 22px;
		flex-wrap: wrap;
	}
	@media (max-width: 920px) {
		.bs-screen-title {
			margin-bottom: 16px;
		}
	}
	@media (max-width: 600px) {
		.bs-screen-title-h1 {
			font-size: 26px;
		}
		.bs-screen-title-actions {
			width: 100%;
			justify-content: flex-start;
		}
	}
	.bs-screen-title-text {
		min-width: 0;
		flex: 1;
	}
	.bs-screen-title-eyebrow {
		font-size: 12.5px;
		color: var(--bs-text-3);
		margin-bottom: 3px;
	}
	.bs-screen-title-h1 {
		margin: 0;
		font-family: var(--bs-font-serif);
		font-style: italic;
		font-weight: 400;
		font-size: clamp(28px, 4vw, 32px);
		color: var(--bs-text);
		letter-spacing: -0.02em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.bs-screen-title-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		flex-shrink: 0;
	}
</style>
