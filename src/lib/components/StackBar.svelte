<script lang="ts">
	/*
	 * Horizontal stacked bar that animates each segment in with a slight
	 * stagger. Matches design's <StackBar> in proto/charts.jsx. Each slice
	 * has a value (any positive number — proportional) and a color.
	 */
	import { onMount } from 'svelte';

	export interface StackSlice {
		value: number;
		color: string;
		label?: string;
	}

	interface Props {
		slices: StackSlice[];
		height?: number;
		delay?: number;
	}

	let { slices, height = 13, delay = 200 }: Props = $props();

	let shown = $state(false);
	onMount(() => {
		const id = setTimeout(() => (shown = true), delay + 20);
		return () => clearTimeout(id);
	});
</script>

<div
	style="display: flex; width: 100%; height: {height}px; border-radius: 999px; overflow: hidden; gap: 2px;"
>
	{#each slices as s, i (i)}
		<div
			title={s.label ?? ''}
			style="flex-grow: {shown ? s.value : 0}; flex-basis: 0; min-width: {shown ? 4 : 0}px; background: {s.color}; border-radius: 4px; transition: flex-grow 800ms cubic-bezier(.3,.8,.3,1) {i * 45}ms, min-width 800ms {i * 45}ms;"
		></div>
	{/each}
</div>
