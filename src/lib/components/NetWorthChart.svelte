<script lang="ts">
	import { onMount } from 'svelte';
	import { money } from '$lib/utils/format';
	import type { NetWorthPoint } from '$lib/utils/netWorthSeries';

	function compactMoney(v: number): string {
		const abs = Math.abs(v);
		const sign = v < 0 ? '-' : '';
		if (abs >= 1_000_000) {
			const m = v / 1_000_000;
			return `${sign.replace('-', '-')}$${Math.abs(m).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
		}
		if (abs >= 1_000) {
			const k = v / 1_000;
			return `${sign.replace('-', '-')}$${Math.abs(k).toFixed(abs >= 10_000 ? 0 : 1)}K`;
		}
		return `${sign}$${Math.round(abs)}`;
	}

	interface Props {
		points: NetWorthPoint[];
		anchorAtZero?: boolean;
		defaultRange?: Range;
	}

	type Range = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'All';
	const RANGES: Range[] = ['1M', '3M', '6M', 'YTD', '1Y', 'All'];

	let { points: rawPoints, anchorAtZero = false, defaultRange = 'All' }: Props = $props();

	let range = $state<Range>(defaultRange);

	// Clamp the input series to the selected window. With the current
	// year-bounded data source 1Y/All collapse to YTD, but the filter is
	// future-proofed for when we extend the series beyond a calendar year.
	const points = $derived.by<NetWorthPoint[]>(() => {
		if (range === 'All' || rawPoints.length === 0) return rawPoints;
		const lastIso = rawPoints[rawPoints.length - 1].date;
		const [ly, lm, ld] = lastIso.split('-').map(Number);
		const last = new Date(Date.UTC(ly, lm - 1, ld));
		const cutoff = new Date(last);
		switch (range) {
			case '1M':
				cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
				break;
			case '3M':
				cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
				break;
			case '6M':
				cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
				break;
			case 'YTD':
				cutoff.setUTCMonth(0, 1);
				break;
			case '1Y':
				cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
				break;
		}
		const cutISO = cutoff.toISOString().slice(0, 10);
		const filtered = rawPoints.filter((p) => p.date >= cutISO);
		// Keep at least 2 points so we always have a line to draw.
		return filtered.length >= 2 ? filtered : rawPoints.slice(-2);
	});

	// Viewport (rendered via viewBox so it scales to the container).
	// On desktop the chart is a shallow trend strip; on mobile we double the
	// viewBox height so the chart isn't scrunched into ~50px of vertical room.
	const W = 1600;
	const padL = 96;
	const padR = 40;
	const padT = 22;
	const padB = 40;
	const innerW = W - padL - padR;

	// Track the actual rendered chart-card width via ResizeObserver, so the
	// chart picks its aspect from CONTAINER width (not viewport). The chart
	// card on a tablet or in a 2-col grid is much narrower than the viewport,
	// so a viewport-based breakpoint was leaving it squished.
	let containerEl: HTMLDivElement | undefined = $state();
	let containerW = $state(0);
	$effect(() => {
		if (!containerEl) return;
		// Seed with the synchronous measurement so we don't render one frame
		// at the 'wide' fallback tier.
		const rect = containerEl.getBoundingClientRect();
		if (rect.width) containerW = rect.width;
		const ro = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width;
			if (w) containerW = w;
		});
		ro.observe(containerEl);
		return () => ro.disconnect();
	});

	// Three-tier aspect — each tier kept tall enough to read clearly:
	//   narrow  (< 500px)   → 16:9     (phone, ~190px at 343 wide)
	//   medium  (500-1100)  → ~2.7:1   (tablet / narrow desktop, ~350px at 935 wide)
	//   wide    (≥ 1100)    → ~4:1     (wide desktop, ~325px at 1300 wide)
	const tier = $derived.by<'narrow' | 'medium' | 'wide'>(() => {
		if (containerW === 0) return 'medium'; // safe default before measurement
		if (containerW < 500) return 'narrow';
		if (containerW < 1100) return 'medium';
		return 'wide';
	});
	const H = $derived(tier === 'narrow' ? 900 : tier === 'medium' ? 600 : 400);
	const innerH = $derived(H - padT - padB);
	const dotRadius = $derived(tier === 'narrow' ? 24 : tier === 'medium' ? 14 : 7);
	const dotRadiusLatest = $derived(tier === 'narrow' ? 30 : tier === 'medium' ? 18 : 10);
	const dotStrokeWidth = $derived(tier === 'narrow' ? 10 : tier === 'medium' ? 6 : 4);
	const isMobile = $derived(tier === 'narrow'); // reused by hover-ring sizing

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

	// X ticks: month starts, label every month. Key is the unique YYYY-MM so
	// a rolling 13-month window (May 2025 → May 2026) doesn't collide on the
	// duplicate "May" label.
	const monthTicks = $derived.by(() => {
		if (points.length === 0) return [];
		const seen = new Set<string>();
		const ticks: { key: string; x: number; label: string }[] = [];
		points.forEach((p, i) => {
			const ym = p.date.slice(0, 7);
			if (!seen.has(ym)) {
				seen.add(ym);
				const monthIdx = Number(ym.slice(5, 7));
				ticks.push({
					key: ym,
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
	const sinceLabel = $derived.by(() => {
		if (points.length === 0) return '';
		const [y, m, d] = points[0].date.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		});
	});

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
		<!-- Summary header — design/screen-home.jsx exact spec -->
		<div class="mb-3.5 flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="section-label" style="letter-spacing: 0.06em;">
					Net worth · {new Date().getFullYear()}
				</div>
				<div
					class="bs-display mt-1.5"
					style="color: {latest < 0 ? 'var(--bs-neg)' : 'var(--bs-text)'};"
				>
					{money(latest)}
				</div>
				<div class="mt-2.5 flex flex-wrap items-center gap-2.5" style="font-size: 12.5px;">
					<span
						class="bs-tag bs-mono"
						style="background: color-mix(in oklch, {change >= 0 ? 'var(--bs-pos)' : 'var(--bs-neg)'} 12%, transparent); color: {change >= 0 ? 'var(--bs-pos)' : 'var(--bs-neg)'};"
					>
						{change >= 0 ? '↑' : '↓'} {money(Math.abs(change))} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
					</span>
					<span style="color: var(--bs-text-2);">since {sinceLabel}</span>
				</div>
			</div>
			<div class="flex flex-col items-end gap-1.5">
				<!-- Range filter — inset toggle: surface-2 bg, active state lifts to
				     surface with a faint inner shadow. Mono numerals throughout. -->
				<div
					role="tablist"
					aria-label="Time range"
					class="inline-flex gap-0.5 bs-mono"
					style="padding: 2px; border: 0.5px solid var(--bs-border); border-radius: var(--bs-radius-sm); background: var(--bs-surface-2);"
				>
					{#each RANGES as r (r)}
						<button
							type="button"
							role="tab"
							aria-selected={range === r}
							onclick={() => (range = r)}
							style="padding: 4px 8px; font-size: 11.5px; font-weight: 500; border: 0; border-radius: calc(var(--bs-radius-sm) - 2px); cursor: pointer; transition: background-color 0.12s ease, color 0.12s ease; background: {range === r ? 'var(--bs-surface)' : 'transparent'}; color: {range === r ? 'var(--bs-text)' : 'var(--bs-text-3)'}; box-shadow: {range === r ? '0 1px 1px rgba(15,23,42,.05)' : 'none'};"
						>
							{r}
						</button>
					{/each}
				</div>
				{#if extremes}
					<div class="hidden sm:block bs-mono" style="font-size: 11px; color: var(--bs-text-3);">
						High <span style="color: var(--bs-text-2);">{money(extremes.high.point.value)}</span>
						·
						Low <span style="color: var(--bs-text-2);">{money(extremes.low.point.value)}</span>
					</div>
				{/if}
			</div>
		</div>

		<div class="relative" bind:this={containerEl}>
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
				<!-- Area gradient — reads stroke from --bs-brand so it flips with the theme.
				     Light = deep navy fading; dark = pale lavender fading. -->
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="var(--bs-brand)" stop-opacity="0.28" />
					<stop offset="60%" stop-color="var(--bs-brand)" stop-opacity="0.06" />
					<stop offset="100%" stop-color="var(--bs-brand)" stop-opacity="0" />
				</linearGradient>
			</defs>

			<!-- Y grid lines — hairline border tone, theme-aware -->
			{#each yTicks as t (t.value)}
				<line
					x1={padL}
					y1={t.y}
					x2={W - padR}
					y2={t.y}
					stroke="var(--bs-border)"
					stroke-width="1.5"
				/>
			{/each}

			<!-- Area fill -->
			<path
				d={areaPath}
				fill="url(#{gradientId})"
				style="opacity:{mounted ? 1 : 0}; transition: opacity 0.7s ease-out 0.5s;"
			/>

			<!-- Line — reads --bs-brand. Dark navy in light mode, pale lavender in dark. -->
			<path
				bind:this={pathEl}
				d={linePath}
				fill="none"
				stroke="var(--bs-brand)"
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
					r={isLatest ? dotRadiusLatest : dotRadius}
					fill="var(--bs-surface)"
					stroke="var(--bs-brand)"
					stroke-width={dotStrokeWidth}
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
					stroke="var(--bs-border-2)"
					stroke-width="2"
					stroke-dasharray="6 6"
				/>
				<circle
					cx={x(hoverIdx)}
					cy={y(hoverPoint.value)}
					r={isMobile ? 20 : 11}
					fill="var(--bs-surface)"
					stroke="var(--bs-brand)"
					stroke-width={dotStrokeWidth}
				/>
			{/if}
		</svg>

			<!-- HTML axis labels — kept in CSS pixels so they stay readable on mobile.
			     Y values are abbreviated ($26K) so they fit any screen. -->
			{#each yTicks as t (t.value)}
				{@const pctY = (t.y / H) * 100}
				<span
					class="pointer-events-none absolute -translate-y-1/2 whitespace-nowrap pr-1 text-right text-[10px] font-medium text-slate-400 sm:text-xs dark:text-slate-500"
					style="left:0; top:{pctY}%; width:{(padL / W) * 100}%;"
				>
					{compactMoney(t.value)}
				</span>
			{/each}
			{#each monthTicks as tk (tk.key)}
				{@const pctX = (tk.x / W) * 100}
				<span
					class="pointer-events-none absolute -translate-x-1/2 text-[10px] font-medium text-slate-400 sm:text-xs dark:text-slate-500"
					style="left:{pctX}%; bottom:0;"
				>
					{tk.label}
				</span>
			{/each}

			<!-- Floating tooltip anchored to the hovered data point -->
			{#if hoverPoint && hoverIdx !== null}
				{@const pctX = (x(hoverIdx) / W) * 100}
				{@const pctY = (y(hoverPoint.value) / H) * 100}
				{@const flipBelow = pctY < 35}
				<div
					class="pointer-events-none absolute z-10 whitespace-nowrap"
					style="left:{pctX}%; top:{pctY}%; transform: translate(-50%, {flipBelow ? 'calc(0% + 14px)' : 'calc(-100% - 14px)'});"
				>
					<div class="relative rounded-md bg-slate-900 px-3 py-1.5 text-xs shadow-lg ring-1 ring-black/5 dark:bg-slate-100">
						<div class="text-slate-300 dark:text-slate-600">{fmtDate(hoverPoint.date)}</div>
						<div class="text-sm font-semibold tabular-nums text-white dark:text-slate-900">
							{money(hoverPoint.value)}
						</div>
						<!-- Pointer arrow -->
						<div
							class="absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900 dark:bg-slate-100"
							style="{flipBelow ? 'top: -3px;' : 'bottom: -3px;'}"
						></div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
