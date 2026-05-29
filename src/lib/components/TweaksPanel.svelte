<script lang="ts">
	/*
	 * Live theme tweaks drawer — palette, typography, density, radius, shadow.
	 * Every change is applied on documentElement immediately and persisted via
	 * the theme store; the panel itself is purely controls.
	 *
	 * Adapted from tweaks-panel.jsx in the Claude Design hand-off.
	 */
	import { theme, PALETTES, TYPOGRAPHY, type PaletteId, type TypographyId, type DensityId, type ShadowId, type ChartStyle, type ColorMode } from '$lib/theme.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	const paletteIds = Object.keys(PALETTES) as PaletteId[];
	const typographyIds = Object.keys(TYPOGRAPHY) as TypographyId[];
	const densities: DensityId[] = ['compact', 'regular', 'comfy'];
	const shadows: ShadowId[] = ['none', 'subtle', 'lifted'];
	const charts: ChartStyle[] = ['hairline', 'soft', 'bars'];
	const modes: ColorMode[] = ['light', 'dark', 'system'];

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) onclose();
	}
</script>

<svelte:window onkeydown={onkeydown} />

{#if open}
	<button
		type="button"
		class="bs-tweaks-scrim"
		aria-label="Close tweaks"
		onclick={onclose}
	></button>
{/if}

<aside
	class="bs-tweaks-panel"
	class:open
	aria-hidden={!open}
	aria-label="Theme tweaks"
>
	<header class="bs-tweaks-head">
		<div>
			<div
				class="section-label"
				style="margin-bottom: 2px;"
			>Tweaks</div>
			<div
				style="font-family: var(--bs-font-display); font-size: 20px; font-weight: 500; color: var(--bs-text); letter-spacing: -0.02em;"
			>Make it yours</div>
		</div>
		<button type="button" class="bs-tweaks-close" onclick={onclose} aria-label="Close">
			<Icon name="general/x-close" size={16} />
		</button>
	</header>

	<div class="bs-tweaks-body">
		<!-- Palette -->
		<section class="bs-tweaks-section">
			<div class="bs-tweaks-row-label">Palette</div>
			<div class="bs-tweaks-swatches">
				{#each paletteIds as id (id)}
					{@const p = PALETTES[id]}
					<button
						type="button"
						class="bs-swatch"
						class:active={theme.palette === id}
						title={p.label}
						aria-label={p.label}
						onclick={() => theme.setPalette(id)}
					>
						<span class="bs-swatch-dots">
							<span style="background: {p.swatches[0]};"></span>
							<span style="background: {p.swatches[1]};"></span>
							<span style="background: {p.swatches[2]};"></span>
						</span>
						<span class="bs-swatch-label">{p.label}</span>
					</button>
				{/each}
			</div>
		</section>

		<!-- Color mode -->
		<section class="bs-tweaks-section">
			<div class="bs-tweaks-row-label">Color mode</div>
			<div class="bs-tweaks-segmented">
				{#each modes as m (m)}
					<button
						type="button"
						class="bs-seg"
						class:active={theme.value === m}
						onclick={() => theme.set(m)}
					>{m}</button>
				{/each}
			</div>
		</section>

		<!-- Typography -->
		<section class="bs-tweaks-section">
			<div class="bs-tweaks-row-label">Typography</div>
			<div class="bs-tweaks-list">
				{#each typographyIds as id (id)}
					{@const t = TYPOGRAPHY[id]}
					<button
						type="button"
						class="bs-list-row"
						class:active={theme.typography === id}
						onclick={() => theme.setTypography(id)}
					>
						<span style="font-family: {t.sans}; font-weight: 500;">Aa</span>
						<span style="font-family: {t.display}; font-style: italic;">123</span>
						<span style="flex: 1; text-align: left;">{t.label}</span>
						{#if theme.typography === id}
							<Icon name="general/check" size={14} />
						{/if}
					</button>
				{/each}
			</div>
		</section>

		<!-- Density -->
		<section class="bs-tweaks-section">
			<div class="bs-tweaks-row-label">Density</div>
			<div class="bs-tweaks-segmented">
				{#each densities as d (d)}
					<button
						type="button"
						class="bs-seg"
						class:active={theme.density === d}
						onclick={() => theme.setDensity(d)}
					>{d}</button>
				{/each}
			</div>
		</section>

		<!-- Radius -->
		<section class="bs-tweaks-section">
			<div class="bs-tweaks-row-label">
				<span>Card radius</span>
				<span class="bs-mono" style="color: var(--bs-text-2); font-size: 12px;">{theme.radius}px</span>
			</div>
			<input
				type="range"
				min="0"
				max="24"
				step="1"
				value={theme.radius}
				oninput={(e) => theme.setRadius(Number((e.target as HTMLInputElement).value))}
				class="bs-tweaks-slider"
				aria-label="Card radius"
			/>
		</section>

		<!-- Shadow -->
		<section class="bs-tweaks-section">
			<div class="bs-tweaks-row-label">Shadow</div>
			<div class="bs-tweaks-segmented">
				{#each shadows as s (s)}
					<button
						type="button"
						class="bs-seg"
						class:active={theme.shadow === s}
						onclick={() => theme.setShadow(s)}
					>{s}</button>
				{/each}
			</div>
		</section>

		<!-- Chart style -->
		<section class="bs-tweaks-section">
			<div class="bs-tweaks-row-label">Chart style</div>
			<div class="bs-tweaks-segmented">
				{#each charts as c (c)}
					<button
						type="button"
						class="bs-seg"
						class:active={theme.chart === c}
						onclick={() => theme.setChart(c)}
					>{c}</button>
				{/each}
			</div>
		</section>

		<button
			type="button"
			class="bs-tweaks-reset"
			onclick={() => theme.resetTweaks()}
		>Reset to defaults</button>
	</div>
</aside>

<style>
	.bs-tweaks-scrim {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.32);
		border: none;
		z-index: 60;
		animation: bs-fade 200ms ease;
		cursor: pointer;
	}

	.bs-tweaks-panel {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 360px;
		max-width: 92vw;
		background: var(--bs-surface);
		color: var(--bs-text);
		border-left: 0.5px solid var(--bs-border);
		box-shadow: -16px 0 40px rgba(0, 0, 0, 0.18);
		z-index: 61;
		transform: translateX(100%);
		transition: transform 320ms cubic-bezier(.3, .8, .3, 1);
		display: flex;
		flex-direction: column;
		font-family: var(--bs-font-sans);
	}
	.bs-tweaks-panel.open {
		transform: translateX(0);
	}
	.bs-tweaks-panel[aria-hidden='true'] {
		pointer-events: none;
	}

	.bs-tweaks-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 22px 22px 14px;
		border-bottom: 0.5px solid var(--bs-border);
	}

	.bs-tweaks-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 999px;
		background: var(--bs-surface-2);
		color: var(--bs-text-2);
		border: 0.5px solid var(--bs-border);
	}

	.bs-tweaks-body {
		flex: 1;
		overflow-y: auto;
		padding: 14px 22px 28px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.bs-tweaks-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.bs-tweaks-row-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: var(--bs-text-2);
		text-transform: capitalize;
	}

	.bs-tweaks-swatches {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
	}

	.bs-swatch {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 10px 12px;
		border-radius: var(--bs-radius-sm);
		background: var(--bs-surface-2);
		border: 1px solid transparent;
		color: var(--bs-text);
		font-size: 12.5px;
		font-weight: 500;
		text-align: left;
		transition: background-color 120ms, border-color 120ms;
	}
	.bs-swatch:hover {
		background: color-mix(in oklch, var(--bs-text-3) 10%, var(--bs-surface-2));
	}
	.bs-swatch.active {
		border-color: var(--bs-brand);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--bs-brand) 22%, transparent);
	}
	.bs-swatch-dots {
		display: inline-flex;
		gap: -4px;
		flex-shrink: 0;
	}
	.bs-swatch-dots > span {
		width: 14px;
		height: 14px;
		border-radius: 999px;
		border: 1.5px solid var(--bs-surface);
		margin-left: -4px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	.bs-swatch-dots > span:first-child {
		margin-left: 0;
	}
	.bs-swatch-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bs-tweaks-segmented {
		display: flex;
		gap: 3px;
		padding: 3px;
		background: var(--bs-surface-2);
		border-radius: 999px;
	}
	.bs-seg {
		flex: 1;
		padding: 7px 10px;
		font-size: 12px;
		font-weight: 500;
		text-transform: capitalize;
		color: var(--bs-text-2);
		background: transparent;
		border: none;
		border-radius: 999px;
		transition: background-color 140ms, color 140ms;
	}
	.bs-seg:hover {
		color: var(--bs-text);
	}
	.bs-seg.active {
		background: var(--bs-surface);
		color: var(--bs-text);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}

	.bs-tweaks-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.bs-list-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 12px;
		border-radius: var(--bs-radius-sm);
		background: var(--bs-surface-2);
		color: var(--bs-text);
		font-size: 13px;
		border: 1px solid transparent;
		transition: background-color 120ms, border-color 120ms;
	}
	.bs-list-row:hover {
		background: color-mix(in oklch, var(--bs-text-3) 10%, var(--bs-surface-2));
	}
	.bs-list-row.active {
		border-color: var(--bs-brand);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--bs-brand) 22%, transparent);
	}

	.bs-tweaks-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 6px;
		border-radius: 999px;
		background: color-mix(in oklch, var(--bs-text-3) 18%, transparent);
		outline: none;
	}
	.bs-tweaks-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: var(--bs-brand);
		border: 2px solid var(--bs-surface);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
		cursor: pointer;
	}
	.bs-tweaks-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: var(--bs-brand);
		border: 2px solid var(--bs-surface);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
		cursor: pointer;
	}

	.bs-tweaks-reset {
		margin-top: 4px;
		padding: 11px 14px;
		border-radius: var(--bs-radius-sm);
		background: transparent;
		border: 0.5px solid var(--bs-border-2);
		color: var(--bs-text-2);
		font-size: 13px;
		font-weight: 500;
	}
	.bs-tweaks-reset:hover {
		background: var(--bs-surface-2);
		color: var(--bs-text);
	}
</style>
