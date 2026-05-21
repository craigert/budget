<script lang="ts">
	import { onMount } from 'svelte';
	import { money } from '$lib/utils/format';
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
				const delay = acc * SWEEP_SEC;
				const duration = Math.max(0.12, frac * SWEEP_SEC);
				acc += frac;
				return { ...s, dasharray, dashoffset, pct: frac * 100, delay, duration };
			});
	});

	let mounted = $state(false);
	onMount(() => {
		const id = setTimeout(() => {
			mounted = true;
		}, 50);
		return () => clearTimeout(id);
	});

	// Hover state — index of the segment currently under the cursor
	let hoverIdx = $state<number | null>(null);
	const hoveredSeg = $derived(hoverIdx != null ? segments[hoverIdx] ?? null : null);

	// Truncate long category names so they fit inside the donut
	function shortLabel(s: string): string {
		return s.length > 18 ? `${s.slice(0, 17)}…` : s;
	}
</script>

<div class="@container flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
	<svg
		viewBox="0 0 {size} {size}"
		class="block aspect-square w-full max-w-[16rem] shrink-0 -rotate-90 sm:w-[45%] sm:max-w-[18rem]"
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
				stroke-width={hoverIdx === i ? stroke + 8 : stroke}
				stroke-dasharray={mounted ? seg.dasharray : `0 ${c}`}
				stroke-dashoffset={seg.dashoffset}
				stroke-linecap="butt"
				class="cursor-pointer"
				style="transition: stroke-dasharray {seg.duration}s linear {seg.delay}s, stroke-width 0.18s ease-out, opacity 0.18s ease-out; opacity:{hoverIdx == null || hoverIdx === i ? 1 : 0.45};"
				onpointerenter={() => (hoverIdx = i)}
				onpointerleave={() => {
					if (hoverIdx === i) hoverIdx = null;
				}}
			></circle>
		{/each}

		<!-- Center labels (counter-rotated so they read upright) -->
		<g transform="rotate(90 {size / 2} {size / 2})">
			{#if hoveredSeg}
				<!-- Hovered: show that segment's label + dollar value -->
				<text
					x={size / 2}
					y={size / 2 - 14}
					text-anchor="middle"
					dominant-baseline="middle"
					class="fill-slate-500 dark:fill-slate-400"
					font-size="11"
					font-weight="600"
				>
					{shortLabel(hoveredSeg.label)}
				</text>
				<text
					x={size / 2}
					y={size / 2 + 10}
					text-anchor="middle"
					dominant-baseline="middle"
					font-size="22"
					font-weight="700"
					style="fill:{hoveredSeg.color};"
				>
					{money(hoveredSeg.value)}
				</text>
				<text
					x={size / 2}
					y={size / 2 + 30}
					text-anchor="middle"
					dominant-baseline="middle"
					class="fill-slate-400"
					font-size="10"
					font-weight="500"
				>
					{hoveredSeg.pct.toFixed(1)}%
				</text>
			{:else}
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
			{/if}
		</g>
	</svg>

	<ul class="w-full min-w-0 flex-1 space-y-1.5 self-stretch text-sm sm:py-2">
		{#if segments.length === 0}
			<li class="text-slate-500">No data yet.</li>
		{/if}
		{#each segments as seg, i (seg.label)}
			<li
				class="flex cursor-pointer items-center gap-2 rounded px-1 -mx-1 transition-colors {hoverIdx === i
					? 'bg-slate-100 dark:bg-slate-800'
					: ''}"
				style="opacity:{mounted ? (hoverIdx == null || hoverIdx === i ? 1 : 0.55) : 0}; transform: translateX({mounted ? '0' : '-4px'}); transition: opacity 0.2s ease-out, transform 0.4s ease-out {seg.delay + 0.1}s;"
				onpointerenter={() => (hoverIdx = i)}
				onpointerleave={() => {
					if (hoverIdx === i) hoverIdx = null;
				}}
			>
				<span class="h-2.5 w-2.5 shrink-0 rounded-sm" style="background:{seg.color}"></span>
				{#if seg.icon}
					<span style="color:{seg.color}"><Icon name={seg.icon} size={14} /></span>
				{/if}
				<span class="flex-1 truncate">{seg.label}</span>
				<span class="shrink-0 text-xs font-medium tabular-nums text-slate-500">
					{hoverIdx === i ? money(seg.value) : `${seg.pct.toFixed(0)}%`}
				</span>
			</li>
		{/each}
	</ul>
</div>
