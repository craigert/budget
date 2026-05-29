<script lang="ts">
	/*
	 * "Sparrow Says" insight banner — exact spec from proto/desktop.jsx (DHome
	 * Sparrow Says block).
	 *
	 *   background:   var(--bs-accent-soft, rgba(176,120,66,0.12))
	 *   borderRadius: 18
	 *   padding:      18px 22px
	 *   gap:          16
	 *   sparrow logo: 42px PNG (assets/sparrow-logo.png)
	 *   eyebrow:      "SPARROW SAYS" 10.5px / 600 / 0.06em / brass
	 *   body:         italic Fraunces 18px / 1.4 line-height / text
	 *   CTA:          dark forest panel pill — 9px 16px, 999 radius, 13px / 500
	 */
	import { base } from '$app/paths';

	interface Props {
		children: import('svelte').Snippet;
		cta?: string;
		onclick?: () => void;
	}

	let { children, cta, onclick }: Props = $props();
</script>

<div class="bs-sparrow-says">
	<img
		src={`${base}/logo.png`}
		alt=""
		width="42"
		height="42"
		class="bs-sparrow-says-logo"
	/>
	<div class="bs-sparrow-says-body">
		<div class="bs-sparrow-says-eyebrow">SPARROW SAYS</div>
		<p class="bs-sparrow-says-text">{@render children()}</p>
	</div>
	{#if cta}
		<button type="button" class="bs-sparrow-says-cta" {onclick}>{cta}</button>
	{/if}
</div>

<style>
	.bs-sparrow-says {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 18px 22px;
		background: var(--bs-accent-soft, rgba(176, 120, 66, 0.12));
		border-radius: 18px;
	}
	.bs-sparrow-says-logo {
		object-fit: contain;
		display: block;
		flex-shrink: 0;
	}
	.bs-sparrow-says-body {
		flex: 1;
		min-width: 0;
	}
	.bs-sparrow-says-eyebrow {
		font-size: 10.5px;
		color: var(--bs-accent);
		font-weight: 600;
		letter-spacing: 0.06em;
		margin-bottom: 3px;
	}
	.bs-sparrow-says-text {
		margin: 0;
		font-family: var(--bs-font-serif);
		font-style: italic;
		font-size: 18px;
		line-height: 1.4;
		color: var(--bs-text);
		font-variant-numeric: tabular-nums;
	}
	.bs-sparrow-says-cta {
		padding: 9px 16px;
		border-radius: 999px;
		background: var(--bs-panel, var(--bs-text));
		color: var(--bs-panel-tx, var(--bs-bg));
		font-size: 13px;
		font-weight: 500;
		border: none;
		flex-shrink: 0;
		transition: transform 140ms cubic-bezier(.3, .7, .4, 1), opacity 0.15s ease;
	}
	.bs-sparrow-says-cta:hover {
		opacity: 0.92;
	}
	.bs-sparrow-says-cta:active {
		transform: scale(0.96);
	}
</style>
