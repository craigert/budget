<script lang="ts">
	/*
	 * Progress bar that fills in on mount. Matches the design's <Bar> from
	 * proto/charts.jsx. Pass `over` to color the fill negative; otherwise
	 * `color` is used.
	 */
	import { onMount } from 'svelte';

	interface Props {
		value: number;
		max: number;
		color?: string;
		track?: string;
		height?: number;
		delay?: number;
		over?: boolean;
		duration?: number;
	}

	let {
		value,
		max,
		color = 'var(--bs-brand-3)',
		track = 'color-mix(in oklch, var(--bs-text-3) 18%, transparent)',
		height = 6,
		delay = 150,
		over = false,
		duration = 900
	}: Props = $props();

	let shown = $state(false);
	onMount(() => {
		const id = setTimeout(() => (shown = true), delay + 20);
		return () => clearTimeout(id);
	});

	const pct = $derived(Math.min(100, max > 0 ? (value / max) * 100 : 0));
</script>

<div
	style="width: 100%; height: {height}px; border-radius: 999px; background: {track}; overflow: hidden;"
>
	<div
		style="width: {shown ? pct : 0}%; height: 100%; border-radius: 999px; background: {over ? 'var(--bs-neg)' : color}; transition: width {duration}ms cubic-bezier(.3,.8,.3,1);"
	></div>
</div>
