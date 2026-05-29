<script lang="ts">
	/*
	 * Progress ring that draws in on mount. Matches design's <Ring> from
	 * proto/charts.jsx — stroke-dashoffset animation around an SVG circle.
	 */
	import { onMount } from 'svelte';

	interface Props {
		value: number;
		max: number;
		size?: number;
		sw?: number;
		color?: string;
		track?: string;
		delay?: number;
		children?: import('svelte').Snippet;
	}

	let {
		value,
		max,
		size = 56,
		sw = 6,
		color = 'var(--bs-brand-3)',
		track = 'color-mix(in oklch, var(--bs-text-3) 18%, transparent)',
		delay = 200,
		children
	}: Props = $props();

	let shown = $state(false);
	onMount(() => {
		const id = setTimeout(() => (shown = true), delay + 20);
		return () => clearTimeout(id);
	});

	const r = $derived((size - sw) / 2);
	const circ = $derived(2 * Math.PI * r);
	const pct = $derived(Math.min(1, max > 0 ? value / max : 0));
	const offset = $derived(shown ? circ * (1 - pct) : circ);
</script>

<div style="position: relative; width: {size}px; height: {size}px;">
	<svg width={size} height={size} style="transform: rotate(-90deg);">
		<circle cx={size / 2} cy={size / 2} {r} fill="none" stroke={track} stroke-width={sw} />
		<circle
			cx={size / 2}
			cy={size / 2}
			{r}
			fill="none"
			stroke={color}
			stroke-width={sw}
			stroke-linecap="round"
			stroke-dasharray={circ}
			stroke-dashoffset={offset}
			style="transition: stroke-dashoffset 1000ms cubic-bezier(.3,.8,.3,1);"
		/>
	</svg>
	{#if children}
		<div
			style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
		>
			{@render children()}
		</div>
	{/if}
</div>
