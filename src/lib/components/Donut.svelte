<script lang="ts">
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

	const size = 220;
	const r = 90;
	const stroke = 28;
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
</script>

<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
	<svg
		viewBox="0 0 {size} {size}"
		class="block h-44 w-44 shrink-0 -rotate-90"
		role="img"
		aria-label="Donut chart"
	>
		<circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" class="text-slate-200 dark:text-slate-800" stroke-width={stroke} />
		{#each segments as seg, i (i)}
			<circle
				cx={size / 2}
				cy={size / 2}
				r={r}
				fill="none"
				stroke={seg.color}
				stroke-width={stroke}
				stroke-dasharray={seg.dasharray}
				stroke-dashoffset={seg.dashoffset}
				stroke-linecap="butt"
			/>
		{/each}
		<g transform="rotate(90 {size / 2} {size / 2})">
			{#if centerValue}
				<text x={size / 2} y={size / 2 - 2} text-anchor="middle" dominant-baseline="middle" class="fill-slate-900 dark:fill-slate-100" font-size="20" font-weight="600">
					{centerValue}
				</text>
			{/if}
			{#if centerLabel}
				<text x={size / 2} y={size / 2 + 20} text-anchor="middle" dominant-baseline="middle" class="fill-slate-500" font-size="11">
					{centerLabel}
				</text>
			{/if}
		</g>
	</svg>

	<ul class="flex-1 space-y-1.5 text-sm">
		{#if segments.length === 0}
			<li class="text-slate-500">No data yet.</li>
		{/if}
		{#each segments as seg, i (i)}
			<li class="flex items-center gap-2">
				<span class="h-2.5 w-2.5 shrink-0 rounded-sm" style="background:{seg.color}"></span>
				<span class="flex-1 truncate">{seg.icon ?? ''} {seg.label}</span>
				<span class="text-xs tabular-nums text-slate-500">{seg.pct.toFixed(0)}%</span>
			</li>
		{/each}
	</ul>
</div>
