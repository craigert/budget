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

	// Total sweep time for the entire ring's circumferential draw
	const SWEEP_SEC = 1.2;

	const segments = $derived.by(() => {
		if (!sum) return [];
		let acc = 0;
		return slices
			.filter((s) => s.value > 0)
			.map((s) => {
				const frac = s.value / sum;
				const dasharray = `${frac * c} ${c}`;
				const dashoffset = -acc * c;
				// Each segment starts when its arc begins and runs proportional to its size
				// — so the ring fills clockwise, segment by segment.
				const delay = acc * SWEEP_SEC;
				const duration = Math.max(0.12, frac * SWEEP_SEC);
				acc += frac;
				return { ...s, dasharray, dashoffset, pct: frac * 100, delay, duration };
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

<div class="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
	<svg
		viewBox="0 0 {size} {size}"
		class="block aspect-square shrink-0 -rotate-90"
		style="width: clamp(14rem, 28vw, 22rem);"
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

		<!-- Animated segments: each fills its own arc in turn, clockwise -->
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
				style="transition: stroke-dasharray {seg.duration}s linear {seg.delay}s;"
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

	<ul class="flex-1 space-y-1.5 self-stretch text-sm sm:py-2">
		{#if segments.length === 0}
			<li class="text-slate-500">No data yet.</li>
		{/if}
		{#each segments as seg, i (seg.label)}
			<li
				class="flex items-center gap-2"
				style="opacity:{mounted ? 1 : 0}; transform: translateX({mounted ? '0' : '-4px'}); transition: opacity 0.4s ease-out {seg.delay + 0.1}s, transform 0.4s ease-out {seg.delay + 0.1}s;"
			>
				<span class="h-2.5 w-2.5 shrink-0 rounded-sm" style="background:{seg.color}"></span>
				{#if seg.icon}
					<span style="color:{seg.color}"><Icon name={seg.icon} size={14} /></span>
				{/if}
				<span class="flex-1 truncate">{seg.label}</span>
				<span class="shrink-0 text-xs font-medium tabular-nums text-slate-500">{seg.pct.toFixed(0)}%</span>
			</li>
		{/each}
	</ul>
</div>
