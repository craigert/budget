<script lang="ts">
	import { onMount } from 'svelte';
	import { money } from '$lib/utils/format';
	import type { NetWorthPoint } from '$lib/utils/netWorthSeries';

	interface Props {
		points: NetWorthPoint[];
		/** Y-axis: pull the bottom toward $0 when the series never goes negative. */
		anchorAtZero?: boolean;
	}

	let { points, anchorAtZero = false }: Props = $props();

	// SVG viewport — uses viewBox so it scales to the container.
	const W = 800;
	const H = 240;
	const padL = 56;
	const padR = 16;
	const padT = 16;
	const padB = 28;
	const innerW = W - padL - padR;
	const innerH = H - padT - padB;

	const yDomain = $derived.by(() => {
		if (points.length === 0) return { min: 0, max: 1 };
		const values = points.map((p) => p.value);
		let min = Math.min(...values);
		let max = Math.max(...values);
		if (anchorAtZero && min > 0) min = 0;
		if (min === max) {
			// Avoid divide-by-zero; pad the band
			min = min - 1;
			max = max + 1;
		}
		// Nice padding so the line doesn't kiss the edges
		const pad = (max - min) * 0.08;
		return { min: min - pad, max: max + pad };
	});

	function x(idx: number): number {
		if (points.length <= 1) return padL;
		return padL + (idx / (points.length - 1)) * innerW;
	}
	function y(value: number): number {
		const { min, max } = yDomain;
		return padT + innerH - ((value - min) / (max - min)) * innerH;
	}

	// Smooth path data (linear segments between daily points — already smooth enough at 365pts)
	const linePath = $derived.by(() => {
		if (points.length === 0) return '';
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`)
			.join(' ');
	});

	const areaPath = $derived.by(() => {
		if (points.length === 0) return '';
		const baseY = padT + innerH;
		const start = `M${x(0).toFixed(2)},${baseY.toFixed(2)}`;
		const top = points.map((p, i) => `L${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
		const end = `L${x(points.length - 1).toFixed(2)},${baseY.toFixed(2)} Z`;
		return `${start} ${top} ${end}`;
	});

	// Y-axis tick marks: 4 evenly spaced
	const yTicks = $derived.by(() => {
		const { min, max } = yDomain;
		const count = 4;
		const step = (max - min) / count;
		const out: { value: number; y: number }[] = [];
		for (let i = 0; i <= count; i++) {
			const v = min + step * i;
			out.push({ value: v, y: y(v) });
		}
		return out;
	});

	// X-axis tick marks: one per month
	const monthTicks = $derived.by(() => {
		if (points.length === 0) return [];
		const seenMonths = new Set<string>();
		const ticks: { x: number; label: string }[] = [];
		points.forEach((p, i) => {
			const ym = p.date.slice(0, 7); // YYYY-MM
			if (!seenMonths.has(ym)) {
				seenMonths.add(ym);
				const monthNum = Number(ym.slice(5, 7));
				const label = new Date(Number(ym.slice(0, 4)), monthNum - 1, 1).toLocaleDateString(undefined, {
					month: 'short'
				});
				ticks.push({ x: x(i), label });
			}
		});
		return ticks;
	});

	const latest = $derived(points.length > 0 ? points[points.length - 1].value : 0);
	const start = $derived(points.length > 0 ? points[0].value : 0);
	const change = $derived(latest - start);
	const changePct = $derived(start !== 0 ? (change / Math.abs(start)) * 100 : 0);

	// Animation: draw the line from left to right
	let mounted = $state(false);
	let pathLength = $state(0);
	let pathEl: SVGPathElement | undefined = $state();

	onMount(() => {
		const id = setTimeout(() => {
			if (pathEl) pathLength = pathEl.getTotalLength();
			mounted = true;
		}, 50);
		return () => clearTimeout(id);
	});

	// Re-measure if data changes
	$effect(() => {
		// Track path data to re-measure
		linePath;
		if (mounted && pathEl) {
			queueMicrotask(() => {
				if (pathEl) pathLength = pathEl.getTotalLength();
			});
		}
	});

	const gradientId = `nwgrad-${Math.random().toString(36).slice(2, 8)}`;
</script>

{#if points.length === 0}
	<div class="flex h-60 items-center justify-center text-sm text-slate-500">
		Not enough data to chart this year yet.
	</div>
{:else}
	<div class="space-y-2">
		<!-- Summary row -->
		<div class="flex flex-wrap items-baseline justify-between gap-2">
			<div>
				<div class="text-3xl font-bold tabular-nums {latest < 0 ? 'text-red-600' : ''}">
					{money(latest)}
				</div>
				<div class="text-xs text-slate-500">
					{#if change >= 0}
						<span class="text-brand-600">▲ {money(change)}</span>
					{:else}
						<span class="text-red-600">▼ {money(-change)}</span>
					{/if}
					({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%) since Jan 1
				</div>
			</div>
		</div>

		<svg
			viewBox="0 0 {W} {H}"
			class="block h-60 w-full"
			role="img"
			aria-label="Net worth over the year"
			preserveAspectRatio="none"
		>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="currentColor" stop-opacity="0.22" class="text-brand-500" />
					<stop offset="100%" stop-color="currentColor" stop-opacity="0" class="text-brand-500" />
				</linearGradient>
			</defs>

			<!-- Y grid lines + labels -->
			{#each yTicks as t (t.value)}
				<line
					x1={padL}
					y1={t.y}
					x2={W - padR}
					y2={t.y}
					stroke="currentColor"
					class="text-slate-200 dark:text-slate-800"
					stroke-width="1"
				/>
				<text
					x={padL - 6}
					y={t.y}
					text-anchor="end"
					dominant-baseline="middle"
					class="fill-slate-500"
					font-size="10"
				>
					{money(t.value)}
				</text>
			{/each}

			<!-- X-axis month labels -->
			{#each monthTicks as tk (tk.label)}
				<text
					x={tk.x}
					y={H - 8}
					text-anchor="middle"
					class="fill-slate-500"
					font-size="10"
				>
					{tk.label}
				</text>
			{/each}

			<!-- Area fill -->
			<path
				d={areaPath}
				fill="url(#{gradientId})"
				style="opacity:{mounted ? 1 : 0}; transition: opacity 0.6s ease-out 0.4s;"
			/>

			<!-- Line -->
			<path
				bind:this={pathEl}
				d={linePath}
				fill="none"
				stroke="currentColor"
				class="text-brand-500"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				style="stroke-dasharray: {pathLength || 0}; stroke-dashoffset: {mounted ? 0 : pathLength || 0}; transition: stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1);"
			/>

			<!-- Latest-point dot -->
			{#if points.length > 0}
				<circle
					cx={x(points.length - 1)}
					cy={y(latest)}
					r="4"
					fill="currentColor"
					class="text-brand-500"
					style="opacity:{mounted ? 1 : 0}; transition: opacity 0.4s ease-out 1.0s;"
				/>
				<circle
					cx={x(points.length - 1)}
					cy={y(latest)}
					r="9"
					fill="currentColor"
					class="text-brand-500"
					opacity="0.2"
					style="opacity:{mounted ? 0.2 : 0}; transition: opacity 0.4s ease-out 1.0s;"
				/>
			{/if}
		</svg>
	</div>
{/if}
