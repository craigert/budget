<script lang="ts">
	/*
	 * Net-worth area chart — exact port of proto/charts.jsx NetWorthChart from
	 * the Claude Design Forest reference. Thin 2.4px stroke, brass-to-zero
	 * gradient fill, 2 dotted horizontal gridlines (50% + 100%), month tick
	 * labels at the bottom, and a pulsing ring on the latest data point.
	 *
	 * Animations on mount:
	 *   - line: stroke-dashoffset 1100ms cubic-bezier(.4,0,.2,1)
	 *   - area: opacity 700ms ease 300ms
	 *   - month labels: opacity 500ms ease 600ms
	 *   - endpoint dot: opacity 300ms ease 900ms
	 *   - pulsing ring: r 5→12→5, opacity 0.4→0→0.4, 2.4s loop
	 *
	 * Scrubbing is handled by pointer events on the wrapper; a vertical marker
	 * line + tooltip card slides to the hovered index.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { money0 } from '$lib/utils/format';
	import type { NetWorthPoint } from '$lib/utils/netWorthSeries';

	interface Props {
		points: NetWorthPoint[];
		height?: number;
		color?: string;
		surface?: string;
		onScrub?: (point: NetWorthPoint | null) => void;
	}

	let {
		points,
		height = 220,
		color = 'var(--bs-brand)',
		surface = 'var(--bs-surface)',
		onScrub
	}: Props = $props();

	let wrapEl: HTMLDivElement | undefined = $state();
	let pathEl: SVGPathElement | undefined = $state();
	let W = $state(340);
	let drawn = $state(false);
	let len = $state(0);
	let active = $state<number | null>(null);

	const padT = 14;
	const padB = 22;
	const padX = 4;
	const H = $derived(height);
	const chartH = $derived(H - padT - padB);

	const yRange = $derived.by(() => {
		if (points.length === 0) return { min: 0, max: 1 };
		const vals = points.map((p) => p.value);
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		const range = max - min || 1;
		const yPad = range * 0.18;
		return { min: min - yPad, max: max + yPad };
	});

	function xOf(i: number): number {
		if (points.length <= 1) return padX;
		return padX + (i / (points.length - 1)) * (W - padX * 2);
	}
	function yOf(v: number): number {
		const { min, max } = yRange;
		return padT + chartH - ((v - min) / (max - min)) * chartH;
	}

	const linePath = $derived.by(() => {
		if (points.length === 0) return '';
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(p.value).toFixed(1)}`)
			.join(' ');
	});

	const areaPath = $derived.by(() => {
		if (points.length === 0) return '';
		return `${linePath} L ${xOf(points.length - 1)} ${padT + chartH} L ${xOf(0)} ${padT + chartH} Z`;
	});

	const monthTicks = $derived.by(() => {
		const seen = new Set<string>();
		const all: { i: number; label: string }[] = [];
		points.forEach((p, i) => {
			const ym = p.date.slice(0, 7);
			if (!seen.has(ym)) {
				seen.add(ym);
				const monthIdx = Number(ym.slice(5, 7));
				all.push({
					i,
					label: new Date(Number(ym.slice(0, 4)), monthIdx - 1, 1).toLocaleDateString(undefined, { month: 'short' })
				});
			}
		});
		// On narrow widths, the labels overlap if every month renders. Drop
		// every other label (keeping first + last) when the container can't
		// fit them — heuristic: ~30px minimum per label.
		const minPx = 30;
		const maxLabels = Math.max(2, Math.floor(W / minPx));
		if (all.length <= maxLabels) return all;
		const step = Math.ceil(all.length / maxLabels);
		const kept = all.filter((_, idx) => idx === 0 || idx === all.length - 1 || idx % step === 0);
		// Always include the last one
		if (kept[kept.length - 1].i !== all[all.length - 1].i) kept.push(all[all.length - 1]);
		return kept;
	});

	const lastIdx = $derived(Math.max(0, points.length - 1));
	const curIdx = $derived(active ?? lastIdx);
	const cur = $derived(points[curIdx]);

	const uid = 'nw-' + Math.random().toString(36).slice(2, 7);

	let resizeObs: ResizeObserver | undefined;
	onMount(() => {
		const measure = () => {
			if (wrapEl) W = wrapEl.clientWidth;
		};
		measure();
		resizeObs = new ResizeObserver(measure);
		if (wrapEl) resizeObs.observe(wrapEl);

		// Two requestAnimationFrames so the path is rendered before we measure
		// its length (otherwise getTotalLength returns 0).
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (pathEl) len = pathEl.getTotalLength();
				drawn = true;
			});
		});
	});

	onDestroy(() => {
		resizeObs?.disconnect();
	});

	function handleMove(clientX: number) {
		if (!wrapEl || points.length === 0) return;
		const rect = wrapEl.getBoundingClientRect();
		const rel = clientX - rect.left;
		const idx = Math.round(((rel - padX) / (W - padX * 2)) * (points.length - 1));
		const clamped = Math.max(0, Math.min(points.length - 1, idx));
		active = clamped;
		onScrub?.(points[clamped]);
	}
	function pointerDown(e: PointerEvent) {
		(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
		handleMove(e.clientX);
	}
	function pointerMove(e: PointerEvent) {
		if (e.buttons || e.pressure > 0) handleMove(e.clientX);
	}
	function pointerUp() {
		active = null;
		onScrub?.(null);
	}
</script>

{#if points.length === 0}
	<div
		style="height: {height}px; display: flex; align-items: center; justify-content: center; color: var(--bs-text-3); font-size: 13px;"
	>
		Not enough data to chart yet.
	</div>
{:else}
	<div
		bind:this={wrapEl}
		style="width: 100%; position: relative; touch-action: pan-y; user-select: none;"
		onpointerdown={pointerDown}
		onpointermove={pointerMove}
		onpointerup={pointerUp}
		onpointerleave={pointerUp}
		role="presentation"
	>
		<svg width={W} height={H} viewBox="0 0 {W} {H}" style="display: block; overflow: visible;">
			<defs>
				<linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={color} stop-opacity="0.22" />
					<stop offset="100%" stop-color={color} stop-opacity="0" />
				</linearGradient>
			</defs>

			<!-- gridlines at 50% and 100% of chart height, dashed -->
			{#each [0.5, 1] as t (t)}
				<line
					x1={padX}
					x2={W - padX}
					y1={padT + chartH * t}
					y2={padT + chartH * t}
					stroke="var(--bs-border)"
					stroke-width="1"
					stroke-dasharray="1,5"
				/>
			{/each}

			<!-- area fill -->
			<path
				d={areaPath}
				fill="url(#{uid})"
				style="opacity: {drawn ? 1 : 0}; transition: opacity 700ms ease 300ms;"
			/>

			<!-- line draws in via stroke-dashoffset -->
			<path
				bind:this={pathEl}
				d={linePath}
				fill="none"
				stroke={color}
				stroke-width="2.4"
				stroke-linejoin="round"
				stroke-linecap="round"
				stroke-dasharray={len}
				stroke-dashoffset={drawn ? 0 : len}
				style="transition: stroke-dashoffset 1100ms cubic-bezier(.4,0,.2,1);"
			/>

			<!-- month labels at bottom -->
			{#each monthTicks as t (t.i)}
				<text
					x={xOf(t.i)}
					y={H - 5}
					font-size="10.5"
					text-anchor={t.i === 0 ? 'start' : 'middle'}
					fill="var(--bs-text-3)"
					font-family="var(--bs-font-sans)"
					style="opacity: {drawn ? 1 : 0}; transition: opacity 500ms ease 600ms;"
				>{t.label}</text>
			{/each}

			<!-- scrub marker -->
			{#if active != null}
				<line
					x1={xOf(curIdx)}
					x2={xOf(curIdx)}
					y1={padT - 6}
					y2={padT + chartH}
					stroke={color}
					stroke-width="1"
					stroke-opacity="0.5"
				/>
			{/if}

			<!-- endpoint / active dot -->
			{#if cur}
				<circle
					cx={xOf(curIdx)}
					cy={yOf(cur.value)}
					r={active != null ? 6 : 5}
					fill={color}
					stroke={surface}
					stroke-width="2.5"
					style="opacity: {drawn ? 1 : 0}; transition: opacity 300ms ease 900ms;"
				/>
			{/if}

			<!-- pulsing ring on the latest point, only when idle -->
			{#if active == null && cur}
				<circle
					cx={xOf(lastIdx)}
					cy={yOf(points[lastIdx].value)}
					r="5"
					fill="none"
					stroke={color}
					stroke-width="1.5"
					opacity="0.4"
				>
					<animate attributeName="r" values="5;12;5" dur="2.4s" repeatCount="indefinite" />
					<animate attributeName="opacity" values="0.4;0;0.4" dur="2.4s" repeatCount="indefinite" />
				</circle>
			{/if}
		</svg>

		<!-- scrub tooltip -->
		{#if active != null && cur}
			<div
				style="position: absolute; top: -2px; left: {Math.max(6, Math.min(W - 96, xOf(curIdx) - 48))}px; background: var(--bs-panel, #1A2118); color: var(--bs-panel-tx, #E8E0CC); border-radius: 9px; padding: 5px 9px; pointer-events: none; min-width: 84px; text-align: center; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);"
			>
				<div style="font-size: 9.5px; color: var(--bs-panel-tx-2, rgba(232,224,204,0.66));">
					{new Date(cur.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
				</div>
				<div
					style="font-family: var(--bs-font-serif); font-style: italic; font-size: 15px; font-variant-numeric: tabular-nums;"
				>{money0(cur.value)}</div>
			</div>
		{/if}
	</div>
{/if}
