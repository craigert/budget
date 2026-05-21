<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	interface Slice {
		label: string;
		value: number;
		color: string;
		icon?: string;
	}
	interface Props {
		slices: Slice[];
		total?: number;
		centerLabel?: string;
		centerValue?: string;
	}
	let { slices, total, centerLabel, centerValue }: Props = $props();

	const size = 240;
	const r = 100;
	const stroke = 32;
	const c = 2 * Math.PI * r;

	const sum = $derived(total ?? slices.reduce((s, x) => s + x.value, 0));

	const segments = $derived.by(() => {
		if (!sum) return [];
		let acc = 0;
		return slices
			.filter((s) => s.value > 0)
			.map((s) => {
				const frac = s.value / sum;
				const dasharray = `${frac * c} ${c}`;
				const dashoffset = -acc * c;
				acc += frac;
				return { ...s, dasharray, dashoffset, pct: frac * 100 };
			});
	});

	// Animation: start from 0 length on mount, expand into final size with a staggered draw.
	let mounted = $state(false);
	onMount(() => {
		// Wait for the initial 0-length paint, then flip so CSS transitions
		// interpolate to the target dasharray. setTimeout is more reliable
		// than nested rAFs across browsers + HMR.
		const id = setTimeout(() => {
			mounted = true;
		}, 50);
		return () => clearTimeout(id);
	});
</script>

<div class="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
	<svg
		viewBox="0 0 {size} {size}"
		class="block h-60 w-60 shrink-0 -rotate-90 sm:h-64 sm:w-64"
		role="img"
		aria-label="Donut chart"
	>
		<!-- Background ring -->
		<circle
			cx={size / 2}
			cy={size / 2}
			r={r}
			fill="none"
			stroke="currentColor"
			class="text-slate-200 dark:text-slate-800"
			stroke-width={stroke}
		/>

		<!-- Animated segments: each grows from 0 stroke-length to its target -->
		{#each segments as seg, i (seg.label)}
			<circle
				cx={size / 2}
				cy={size / 2}
				r={r}
				fill="none"
				stroke={seg.color}
				stroke-width={stroke}
				stroke-dasharray={mounted ? seg.dasharray : `0 ${c}`}
				stroke-dashoffset={seg.dashoffset}
				stroke-linecap="butt"
				style="transition: stroke-dasharray 0.7s cubic-bezier(0.22, 1, 0.36, 1) {i * 0.06}s, stroke-dashoffset 0.5s cubic-bezier(0.22, 1, 0.36, 1);"
			/>
		{/each}

		<!-- Center labels (counter-rotated so they read upright) -->
		<g transform="rotate(90 {size / 2} {size / 2})">
			{#if centerLabel}
				<text
					x={size / 2}
					y={size / 2 - 14}
					text-anchor="middle"
					dominant-baseline="middle"
					class="fill-slate-400"
					font-size="10"
					font-weight="600"
					letter-spacing="1.5"
					style="opacity:{mounted ? 1 : 0}; transition: opacity 0.5s ease-out 0.4s;"
				>
					{centerLabel.toUpperCase()}
				</text>
			{/if}
			{#if centerValue}
				<text
					x={size / 2}
					y={size / 2 + 8}
					text-anchor="middle"
					dominant-baseline="middle"
					class="fill-brand-500"
					font-size="24"
					font-weight="700"
					style="opacity:{mounted ? 1 : 0}; transition: opacity 0.5s ease-out 0.5s;"
				>
					{centerValue}
				</text>
			{/if}
		</g>
	</svg>

	<ul class="grid flex-1 self-stretch gap-x-6 gap-y-1.5 text-sm sm:py-2 {segments.length > 6 ? 'sm:grid-cols-2' : 'grid-cols-1'}">
		{#if segments.length === 0}
			<li class="text-slate-500">No data yet.</li>
		{/if}
		{#each segments as seg, i (seg.label)}
			<li
				class="flex items-center gap-2"
				style="opacity:{mounted ? 1 : 0}; transform: translateX({mounted ? '0' : '-4px'}); transition: opacity 0.4s ease-out {0.3 + i * 0.05}s, transform 0.4s ease-out {0.3 + i * 0.05}s;"
			>
				<span class="h-2.5 w-2.5 shrink-0 rounded-sm" style="background:{seg.color}"></span>
				{#if seg.icon}
					<span style="color:{seg.color}"><Icon name={seg.icon} size={14} /></span>
				{/if}
				<span class="truncate">{seg.label}</span>
				<span class="text-xs font-medium tabular-nums text-slate-500">{seg.pct.toFixed(0)}%</span>
			</li>
		{/each}
	</ul>
</div>
