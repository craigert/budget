<script lang="ts">
	import { onMount } from 'svelte';
	import { money } from '$lib/utils/format';
	import type { NetWorthPoint } from '$lib/utils/netWorthSeries';

	interface Props {
		points: NetWorthPoint[];
		anchorAtZero?: boolean;
	}

	let { points, anchorAtZero = false }: Props = $props();

	// Viewport (rendered via viewBox so it scales to the container).
	// Half-height aspect — wide and shallow for a trend strip.
	const W = 1600;
	const H = 250;
	const padL = 180; // wide enough for $1,000,000.00 labels
	const padR = 40;
	const padT = 22;
	const padB = 40;
	const innerW = W - padL - padR;
	const innerH = H - padT - padB;

	const yDomain = $derived.by(() => {
		if (points.length === 0) return { min: 0, max: 1 };
		const vals = points.map((p) => p.value);
		let min = Math.min(...vals);
		let max = Math.max(...vals);
		if (anchorAtZero && min > 0) min = 0;
		if (min === max) {
			min -= 1;
			max += 1;
		}
		const pad = (max - min) * 0.1;
		return { min: min - pad, max: max + pad };
	});

	const x = (idx: number) =>
		points.length <= 1 ? padL : padL + (idx / (points.length - 1)) * innerW;
	const y = (v: number) => {
		const { min, max } = yDomain;
		return padT + innerH - ((v - min) / (max - min)) * innerH;
	};

	// Straight-line segments between points — angular look, easy to read at a glance.
	function linearPath(): string {
		if (points.length === 0) return '';
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`)
			.join(' ');
	}

	const linePath = $derived(linearPath());
	const areaPath = $derived.by(() => {
		if (!linePath) return '';
		const baseY = padT + innerH;
		return `${linePath} L${x(points.length - 1).toFixed(2)},${baseY.toFixed(2)} L${x(0).toFixed(2)},${baseY.toFixed(2)} Z`;
	});

	// Y ticks: 4 evenly spaced
	const yTicks = $derived.by(() => {
		const { min, max } = yDomain;
		const count = 4;
		const out: { value: number; y: number }[] = [];
		for (let i = 0; i <= count; i++) {
			const v = min + ((max - min) / count) * i;
			out.push({ value: v, y: y(v) });
		}
		return out;
	});

	// X ticks: month starts, label every month (or every other for narrow screens)
	const monthTicks = $derived.by(() => {
		if (points.length === 0) return [];
		const seen = new Set<string>();
		const ticks: { x: number; label: string }[] = [];
		points.forEach((p, i) => {
			const ym = p.date.slice(0, 7);
			if (!seen.has(ym)) {
				seen.add(ym);
				const monthIdx = Number(ym.slice(5, 7));
				ticks.push({
					x: x(i),
					label: new Date(Number(ym.slice(0, 4)), monthIdx - 1, 1)
						.toLocaleDateString(undefined, { month: 'short' })
				});
			}
		});
		return ticks;
	});

	// High / low markers
	const extremes = $derived.by(() => {
		if (points.length === 0) return null;
		let lo = 0;
		let hi = 0;
		for (let i = 1; i < points.length; i++) {
			if (points[i].value < points[lo].value) lo = i;
			if (points[i].value > points[hi].value) hi = i;
		}
		return {
			high: { idx: hi, point: points[hi] },
			low: { idx: lo, point: points[lo] }
		};
	});

	const latest = $derived(points.length > 0 ? points[points.length - 1].value : 0);
	const start = $derived(points.length > 0 ? points[0].value : 0);
	const change = $derived(latest - start);
	const changePct = $derived(start !== 0 ? (change / Math.abs(start)) * 100 : 0);

	// Animation
	let mounted = $state(false);
	let pathLength = $state(0);
	let pathEl: SVGPathElement | undefined = $state();
	onMount(() => {
		const id = setTimeout(() => {
			if (pathEl) pathLength = pathEl.getTotalLength();
			mounted = true;
		}, 60);
		return () => clearTimeout(id);
	});
	$effect(() => {
		linePath; // track
		if (mounted && pathEl) {
			queueMicrotask(() => {
				if (pathEl) pathLength = pathEl.getTotalLength();
			});
		}
	});

	// Hover state
	let svgEl: SVGSVGElement | undefined = $state();
	let hoverIdx = $state<number | null>(null);
	function onPointerMove(e: PointerEvent) {
		if (!svgEl || points.length === 0) return;
		const rect = svgEl.getBoundingClientRect();
		const ratio = W / rect.width;
		const sx = (e.clientX - rect.left) * ratio;
		if (sx < padL || sx > W - padR) {
			hoverIdx = null;
			return;
		}
		const rel = (sx - padL) / innerW;
		const idx = Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1))));
		hoverIdx = idx;
	}
	function onPointerLeave() {
		hoverIdx = null;
	}

	const hoverPoint = $derived(hoverIdx != null ? points[hoverIdx] : null);
	function fmtDate(iso: string) {
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const gradientId = `nwgrad-${Math.random().toString(36).slice(2, 8)}`;
</script>

{#if points.length === 0}
	<div class="flex h-64 items-center justify-center text-sm text-slate-500">
		Not enough data to chart this year yet.
	</div>
{:else}
	<div class="space-y-3">
		<!-- Summary header -->
		<div class="flex items-end justify-between gap-4">
			<div>
				<div class="text-4xl font-bold tabular-nums tracking-tight {latest < 0 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}">
					{money(latest)}
				</div>
				<div class="mt-1 flex items-center gap-2 text-sm">
					<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {change >= 0 ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'}">
						{change >= 0 ? '↑' : '↓'} {money(Math.abs(change))} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
					</span>
					<span class="text-slate-500">since Jan 1</span>
				</div>
			</div>
			{#if extremes}
				<div class="hidden sm:flex flex-col items-end gap-0.5 text-right text-xs text-slate-500">
					<div>High: <span class="font-medium tabular-nums text-slate-700 dark:text-slate-300">{money(extremes.high.point.value)}</span> · {fmtDate(extremes.high.point.date)}</div>
					<div>Low: <span class="font-medium tabular-nums text-slate-700 dark:text-slate-300">{money(extremes.low.point.value)}</span> · {fmtDate(extremes.low.point.date)}</div>
				</div>
			{/if}
		</div>

		<svg
			bind:this={svgEl}
			viewBox="0 0 {W} {H}"
			class="block w-full select-none touch-none"
			style="aspect-ratio: {W} / {H};"
			role="img"
			aria-label="Net worth over the year"
			preserveAspectRatio="xMidYMid meet"
			onpointermove={onPointerMove}
			onpointerleave={onPointerLeave}
		>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="currentColor" stop-opacity="0.28" class="text-brand-500" />
					<stop offset="60%" stop-color="currentColor" stop-opacity="0.06" class="text-brand-500" />
					<stop offset="100%" stop-color="currentColor" stop-opacity="0" class="text-brand-500" />
				</linearGradient>
			</defs>

			<!-- Y grid + labels -->
			{#each yTicks as t (t.value)}
				<line
					x1={padL}
					y1={t.y}
					x2={W - padR}
					y2={t.y}
					stroke="currentColor"
					class="text-slate-100 dark:text-slate-800/60"
					stroke-width="1.5"
				/>
				<text
					x={padL - 16}
					y={t.y}
					text-anchor="end"
					dominant-baseline="middle"
					class="fill-slate-400 dark:fill-slate-500"
					font-size="20"
					font-weight="500"
				>
					{money(t.value)}
				</text>
			{/each}

			<!-- X-axis month labels -->
			{#each monthTicks as tk (tk.label)}
				<text
					x={tk.x}
					y={H - 16}
					text-anchor="middle"
					class="fill-slate-400 dark:fill-slate-500"
					font-size="20"
					font-weight="500"
				>
					{tk.label}
				</text>
			{/each}

			<!-- Area fill -->
			<path
				d={areaPath}
				fill="url(#{gradientId})"
				style="opacity:{mounted ? 1 : 0}; transition: opacity 0.7s ease-out 0.5s;"
			/>

			<!-- Line -->
			<path
				bind:this={pathEl}
				d={linePath}
				fill="none"
				stroke="currentColor"
				class="text-brand-500"
				stroke-width="4"
				stroke-linecap="round"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
				style="stroke-dasharray: {pathLength || 0}; stroke-dashoffset: {mounted ? 0 : pathLength || 0}; transition: stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1);"
			/>

			<!-- Data-point markers at every snapshot -->
			{#each points as p, i (p.date)}
				{@const isLatest = i === points.length - 1}
				<circle
					cx={x(i)}
					cy={y(p.value)}
					r={isLatest ? 10 : 7}
					fill="white"
					stroke="currentColor"
					class="text-brand-500"
					stroke-width="4"
					style="opacity:{mounted ? 1 : 0}; transition: opacity 0.35s ease-out {0.4 + (i / Math.max(1, points.length)) * 0.7}s;"
				/>
			{/each}

			<!-- Hover crosshair + dot -->
			{#if hoverPoint && hoverIdx !== null}
				<line
					x1={x(hoverIdx)}
					y1={padT}
					x2={x(hoverIdx)}
					y2={padT + innerH}
					stroke="currentColor"
					class="text-slate-300 dark:text-slate-600"
					stroke-width="2"
					stroke-dasharray="6 6"
				/>
				<circle
					cx={x(hoverIdx)}
					cy={y(hoverPoint.value)}
					r="11"
					fill="white"
					stroke="currentColor"
					class="text-brand-500"
					stroke-width="4"
				/>
			{/if}
		</svg>

		<!-- Hover tooltip (positioned in flow, below the chart) -->
		{#if hoverPoint}
			<div class="flex items-center justify-between rounded-md border border-slate-200 bg-white/95 px-3 py-1.5 text-sm shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
				<span class="text-slate-500">{fmtDate(hoverPoint.date)}</span>
				<span class="font-semibold tabular-nums {hoverPoint.value < 0 ? 'text-red-600' : ''}">{money(hoverPoint.value)}</span>
			</div>
		{:else}
			<div class="h-7"></div>
		{/if}
	</div>
{/if}
