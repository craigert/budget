/*
 * BudgetSparrow theme engine — adapted from the Claude Design handoff
 * bundle. Five palettes (light + dark each), four typography systems, three
 * density modes, runtime radius/shadow/chart-style. Tokens are written to
 * documentElement on every change. Each tweak persists in Dexie settings.
 *
 * The light/dark/system mode is still exposed as `theme.value` / `theme.set`
 * / `theme.cycle` / `theme.resolved` for compatibility with existing call
 * sites (PageHeader, Settings, layout).
 */
import { db } from './db';

export type ColorMode = 'light' | 'dark' | 'system';
export type PaletteId = 'mint' | 'navy' | 'forest' | 'clay' | 'ink';
export type TypographyId = 'geist' | 'inter' | 'serif' | 'grotesk';
export type DensityId = 'compact' | 'regular' | 'comfy';
export type ShadowId = 'none' | 'subtle' | 'lifted';
export type ChartStyle = 'hairline' | 'soft' | 'bars';

type Tokens = Record<string, string>;

export interface PaletteDef {
	id: PaletteId;
	label: string;
	swatches: [string, string, string]; // [bg, surface, accent] for the swatch UI
	light: Tokens;
	dark: Tokens;
}

/* ── Palettes ───────────────────────────────────────────────────────────── */
/* Values lifted verbatim from theme.js in the design handoff. The "mint"
   key is the bundle's "Forest immersive" — deep jungle bg with cream cards
   in light mode. Set as default. */
export const PALETTES: Record<PaletteId, PaletteDef> = {
	mint: {
		id: 'mint',
		/*
		 * Forest immersive — exact LIGHT/DARK objects from the rendered
		 * reference (Budget Sparrow — Desktop standalone). Page bg is CREAM,
		 * cards are WHITE, and the dark forest only shows up as a *panel*
		 * (hero card, goals card, etc.) via --bs-panel. Earlier iteration
		 * mistakenly mapped --bs-bg to the dark color; that inverted the
		 * design and made the entire app dark instead of just the hero.
		 */
		label: 'Forest immersive',
		swatches: ['#F5F2EB', '#1A2118', '#B07842'],
		light: {
			'--bs-bg': '#F5F2EB',
			'--bs-bg-2': '#EDE7D8',
			'--bs-bg-on': '#1A1408',
			'--bs-bg-on-2': 'rgba(26, 20, 8, 0.65)',
			'--bs-bg-on-3': 'rgba(26, 20, 8, 0.42)',
			'--bs-bg-line': 'rgba(26, 20, 8, 0.08)',
			'--bs-surface': '#FFFFFF',
			'--bs-surface-2': '#EDE7D8',
			'--bs-surface-3': '#E5DCC4',
			'--bs-border': 'rgba(26, 20, 8, 0.08)',
			'--bs-border-2': 'rgba(26, 20, 8, 0.13)',
			'--bs-text': '#1A1408',
			'--bs-text-2': '#5C4A2E',
			'--bs-text-3': '#A39681',
			'--bs-brand': '#1E5A2C',
			'--bs-brand-2': '#3F8A50',
			'--bs-brand-3': '#5FA856',
			'--bs-brand-soft': 'rgba(30, 90, 44, 0.10)',
			'--bs-brand-tint': 'rgba(30, 90, 44, 0.05)',
			'--bs-accent': '#B07842',
			'--bs-accent-2': '#C8945A',
			'--bs-accent-soft': 'rgba(176, 120, 66, 0.12)',
			'--bs-accent-tint': 'rgba(176, 120, 66, 0.06)',
			'--bs-clay': '#7B5A36',
			'--bs-clay-soft': 'rgba(123, 90, 54, 0.12)',
			'--bs-pos': '#1E8A3C',
			'--bs-pos-soft': 'rgba(30, 138, 60, 0.10)',
			'--bs-neg': '#C0492E',
			'--bs-neg-soft': 'rgba(192, 73, 46, 0.10)',
			'--bs-warn': '#C8945A',
			'--bs-glass': 'rgba(245, 242, 235, 0.82)',
			'--bs-panel': '#1A2118',
			'--bs-panel-2': '#28311F',
			'--bs-panel-tx': '#E8E0CC',
			'--bs-panel-tx-2': 'rgba(232, 224, 204, 0.66)',
			'--bs-panel-tx-3': 'rgba(232, 224, 204, 0.42)',
			'--bs-panel-line': 'rgba(232, 224, 204, 0.12)'
		},
		dark: {
			'--bs-bg': '#0E1510',
			'--bs-bg-2': '#141D15',
			'--bs-bg-on': '#E9E2D2',
			'--bs-bg-on-2': 'rgba(233, 226, 210, 0.65)',
			'--bs-bg-on-3': 'rgba(233, 226, 210, 0.42)',
			'--bs-bg-line': 'rgba(233, 226, 210, 0.09)',
			'--bs-surface': '#19221A',
			'--bs-surface-2': '#141D15',
			'--bs-surface-3': '#212B20',
			'--bs-border': 'rgba(233, 226, 210, 0.09)',
			'--bs-border-2': 'rgba(233, 226, 210, 0.15)',
			'--bs-text': '#E9E2D2',
			'--bs-text-2': '#ABA289',
			'--bs-text-3': '#766C53',
			'--bs-brand': '#5FBF63',
			'--bs-brand-2': '#74CF77',
			'--bs-brand-3': '#86DC88',
			'--bs-brand-soft': 'rgba(95, 191, 99, 0.15)',
			'--bs-brand-tint': 'rgba(95, 191, 99, 0.08)',
			'--bs-accent': '#D9A45E',
			'--bs-accent-2': '#E6B775',
			'--bs-accent-soft': 'rgba(217, 164, 94, 0.15)',
			'--bs-accent-tint': 'rgba(217, 164, 94, 0.08)',
			'--bs-clay': '#D49560',
			'--bs-clay-soft': 'rgba(212, 149, 96, 0.15)',
			'--bs-pos': '#5FBF63',
			'--bs-pos-soft': 'rgba(95, 191, 99, 0.15)',
			'--bs-neg': '#E07A5C',
			'--bs-neg-soft': 'rgba(224, 122, 92, 0.15)',
			'--bs-warn': '#E6B775',
			'--bs-glass': 'rgba(14, 21, 16, 0.78)',
			'--bs-panel': '#243520',
			'--bs-panel-2': '#2C3A26',
			'--bs-panel-tx': '#ECE5D2',
			'--bs-panel-tx-2': 'rgba(236, 229, 210, 0.66)',
			'--bs-panel-tx-3': 'rgba(236, 229, 210, 0.40)',
			'--bs-panel-line': 'rgba(236, 229, 210, 0.13)'
		}
	},
	navy: {
		id: 'navy',
		label: 'Navy slate',
		swatches: ['#FAFAF7', '#FFFFFF', '#1A2A4E'],
		light: {
			'--bs-bg': '#FAFAF7',
			'--bs-bg-on': '#0F172A',
			'--bs-bg-on-2': 'rgba(15, 23, 42, 0.65)',
			'--bs-bg-on-3': 'rgba(15, 23, 42, 0.42)',
			'--bs-bg-line': 'rgba(15, 23, 42, 0.08)',
			'--bs-surface': '#FFFFFF',
			'--bs-surface-2': '#F4F4EE',
			'--bs-border': 'oklch(0.92 0.005 250)',
			'--bs-border-2': 'oklch(0.86 0.008 250)',
			'--bs-text': '#0F172A',
			'--bs-text-2': '#475569',
			'--bs-text-3': '#94A3B8',
			'--bs-brand': '#1A2A4E',
			'--bs-brand-2': '#28406F',
			'--bs-brand-3': '#5D76A8',
			'--bs-brand-soft': 'oklch(0.94 0.02 260)',
			'--bs-brand-tint': 'oklch(0.97 0.01 260)',
			'--bs-accent': 'oklch(0.55 0.12 50)',
			'--bs-accent-2': 'oklch(0.65 0.13 50)',
			'--bs-accent-soft': 'oklch(0.94 0.05 50)',
			'--bs-accent-tint': 'oklch(0.97 0.025 50)',
			'--bs-pos': 'oklch(0.55 0.10 158)',
			'--bs-pos-soft': 'oklch(0.94 0.04 158)',
			'--bs-neg': 'oklch(0.55 0.13 25)',
			'--bs-neg-soft': 'oklch(0.94 0.03 25)',
			'--bs-warn': 'oklch(0.65 0.12 60)'
		},
		dark: {
			'--bs-bg': '#0B1020',
			'--bs-bg-on': '#E6E8F0',
			'--bs-bg-on-2': 'rgba(230, 232, 240, 0.65)',
			'--bs-bg-on-3': 'rgba(230, 232, 240, 0.42)',
			'--bs-bg-line': 'rgba(230, 232, 240, 0.08)',
			'--bs-surface': '#111733',
			'--bs-surface-2': '#0F1530',
			'--bs-border': 'oklch(0.28 0.02 260)',
			'--bs-border-2': 'oklch(0.34 0.02 260)',
			'--bs-text': '#E6E8F0',
			'--bs-text-2': '#9AA3BE',
			'--bs-text-3': '#5B6385',
			'--bs-brand': '#C4CCFF',
			'--bs-brand-2': '#A6B0F0',
			'--bs-brand-3': '#8B95E0',
			'--bs-brand-soft': 'oklch(0.28 0.05 260)',
			'--bs-brand-tint': 'oklch(0.22 0.04 260)',
			'--bs-accent': 'oklch(0.72 0.12 50)',
			'--bs-accent-2': 'oklch(0.78 0.13 50)',
			'--bs-accent-soft': 'oklch(0.30 0.06 50)',
			'--bs-accent-tint': 'oklch(0.24 0.04 50)',
			'--bs-pos': 'oklch(0.72 0.10 158)',
			'--bs-pos-soft': 'oklch(0.30 0.05 158)',
			'--bs-neg': 'oklch(0.68 0.13 25)',
			'--bs-neg-soft': 'oklch(0.28 0.06 25)',
			'--bs-warn': 'oklch(0.74 0.12 60)'
		}
	},
	forest: {
		id: 'forest',
		label: 'Forest sage',
		swatches: ['#F4F6F1', '#FFFFFF', '#2F4A38'],
		light: {
			'--bs-bg': '#F4F6F1',
			'--bs-bg-on': '#152019',
			'--bs-bg-on-2': 'rgba(21, 32, 25, 0.65)',
			'--bs-bg-on-3': 'rgba(21, 32, 25, 0.42)',
			'--bs-bg-line': 'rgba(21, 32, 25, 0.08)',
			'--bs-surface': '#FFFFFF',
			'--bs-surface-2': '#ECEFE6',
			'--bs-border': 'oklch(0.90 0.012 145)',
			'--bs-border-2': 'oklch(0.84 0.018 145)',
			'--bs-text': '#152019',
			'--bs-text-2': '#445248',
			'--bs-text-3': '#869386',
			'--bs-brand': '#2F4A38',
			'--bs-brand-2': '#456752',
			'--bs-brand-3': '#608A72',
			'--bs-brand-soft': 'oklch(0.94 0.03 145)',
			'--bs-brand-tint': 'oklch(0.97 0.015 145)',
			'--bs-accent': 'oklch(0.55 0.08 145)',
			'--bs-accent-2': 'oklch(0.65 0.09 145)',
			'--bs-accent-soft': 'oklch(0.93 0.04 145)',
			'--bs-accent-tint': 'oklch(0.96 0.02 145)',
			'--bs-pos': 'oklch(0.55 0.08 145)',
			'--bs-pos-soft': 'oklch(0.93 0.04 145)',
			'--bs-neg': 'oklch(0.55 0.13 25)',
			'--bs-neg-soft': 'oklch(0.93 0.04 25)',
			'--bs-warn': 'oklch(0.65 0.12 60)'
		},
		dark: {
			'--bs-bg': '#0E1612',
			'--bs-bg-on': '#E1E8DD',
			'--bs-bg-on-2': 'rgba(225, 232, 221, 0.65)',
			'--bs-bg-on-3': 'rgba(225, 232, 221, 0.42)',
			'--bs-bg-line': 'rgba(225, 232, 221, 0.08)',
			'--bs-surface': '#16201A',
			'--bs-surface-2': '#121C16',
			'--bs-border': 'oklch(0.28 0.018 145)',
			'--bs-border-2': 'oklch(0.34 0.022 145)',
			'--bs-text': '#E1E8DD',
			'--bs-text-2': '#A0AC9F',
			'--bs-text-3': '#6C7A6E',
			'--bs-brand': '#8DBFA0',
			'--bs-brand-2': '#A2D2B4',
			'--bs-brand-3': '#B8E0C6',
			'--bs-brand-soft': 'oklch(0.28 0.05 145)',
			'--bs-brand-tint': 'oklch(0.22 0.04 145)',
			'--bs-accent': 'oklch(0.72 0.08 145)',
			'--bs-accent-2': 'oklch(0.78 0.09 145)',
			'--bs-accent-soft': 'oklch(0.30 0.05 145)',
			'--bs-accent-tint': 'oklch(0.24 0.03 145)',
			'--bs-pos': 'oklch(0.72 0.08 145)',
			'--bs-pos-soft': 'oklch(0.30 0.05 145)',
			'--bs-neg': 'oklch(0.68 0.13 25)',
			'--bs-neg-soft': 'oklch(0.28 0.06 25)',
			'--bs-warn': 'oklch(0.74 0.12 60)'
		}
	},
	clay: {
		id: 'clay',
		label: 'Warm clay',
		swatches: ['#F7F3EE', '#FFFFFF', '#7A4E2E'],
		light: {
			'--bs-bg': '#F7F3EE',
			'--bs-bg-on': '#2A1F14',
			'--bs-bg-on-2': 'rgba(42, 31, 20, 0.65)',
			'--bs-bg-on-3': 'rgba(42, 31, 20, 0.42)',
			'--bs-bg-line': 'rgba(42, 31, 20, 0.08)',
			'--bs-surface': '#FFFFFF',
			'--bs-surface-2': '#F0EAE0',
			'--bs-border': 'oklch(0.90 0.012 60)',
			'--bs-border-2': 'oklch(0.84 0.018 60)',
			'--bs-text': '#2A1F14',
			'--bs-text-2': '#5A4A38',
			'--bs-text-3': '#9A8870',
			'--bs-brand': '#7A4E2E',
			'--bs-brand-2': '#8E6240',
			'--bs-brand-3': '#A77858',
			'--bs-brand-soft': 'oklch(0.94 0.04 60)',
			'--bs-brand-tint': 'oklch(0.97 0.02 60)',
			'--bs-accent': 'oklch(0.58 0.07 45)',
			'--bs-accent-2': 'oklch(0.68 0.08 45)',
			'--bs-accent-soft': 'oklch(0.93 0.04 45)',
			'--bs-accent-tint': 'oklch(0.96 0.02 45)',
			'--bs-pos': 'oklch(0.55 0.08 145)',
			'--bs-pos-soft': 'oklch(0.93 0.04 145)',
			'--bs-neg': 'oklch(0.55 0.13 25)',
			'--bs-neg-soft': 'oklch(0.93 0.04 25)',
			'--bs-warn': 'oklch(0.65 0.12 60)'
		},
		dark: {
			'--bs-bg': '#1A1410',
			'--bs-bg-on': '#EBE3D6',
			'--bs-bg-on-2': 'rgba(235, 227, 214, 0.65)',
			'--bs-bg-on-3': 'rgba(235, 227, 214, 0.42)',
			'--bs-bg-line': 'rgba(235, 227, 214, 0.08)',
			'--bs-surface': '#231B14',
			'--bs-surface-2': '#1E1812',
			'--bs-border': 'oklch(0.28 0.018 60)',
			'--bs-border-2': 'oklch(0.34 0.022 60)',
			'--bs-text': '#EBE3D6',
			'--bs-text-2': '#B5A78F',
			'--bs-text-3': '#7B6A52',
			'--bs-brand': '#D9A87B',
			'--bs-brand-2': '#E5B98E',
			'--bs-brand-3': '#F0CAA3',
			'--bs-brand-soft': 'oklch(0.30 0.05 60)',
			'--bs-brand-tint': 'oklch(0.24 0.04 60)',
			'--bs-accent': 'oklch(0.72 0.08 45)',
			'--bs-accent-2': 'oklch(0.78 0.09 45)',
			'--bs-accent-soft': 'oklch(0.30 0.05 45)',
			'--bs-accent-tint': 'oklch(0.24 0.03 45)',
			'--bs-pos': 'oklch(0.72 0.08 145)',
			'--bs-pos-soft': 'oklch(0.30 0.05 145)',
			'--bs-neg': 'oklch(0.68 0.13 25)',
			'--bs-neg-soft': 'oklch(0.28 0.06 25)',
			'--bs-warn': 'oklch(0.74 0.12 60)'
		}
	},
	ink: {
		id: 'ink',
		label: 'Mono ink',
		swatches: ['#F6F6F4', '#FFFFFF', '#0A0A0A'],
		light: {
			'--bs-bg': '#F6F6F4',
			'--bs-bg-on': '#0A0A0A',
			'--bs-bg-on-2': 'rgba(10, 10, 10, 0.65)',
			'--bs-bg-on-3': 'rgba(10, 10, 10, 0.42)',
			'--bs-bg-line': 'rgba(10, 10, 10, 0.08)',
			'--bs-surface': '#FFFFFF',
			'--bs-surface-2': '#EDEDEA',
			'--bs-border': 'oklch(0.91 0.003 250)',
			'--bs-border-2': 'oklch(0.85 0.004 250)',
			'--bs-text': '#0A0A0A',
			'--bs-text-2': '#525252',
			'--bs-text-3': '#A3A3A3',
			'--bs-brand': '#0A0A0A',
			'--bs-brand-2': '#262626',
			'--bs-brand-3': '#525252',
			'--bs-brand-soft': 'oklch(0.94 0.003 250)',
			'--bs-brand-tint': 'oklch(0.97 0.002 250)',
			'--bs-accent': 'oklch(0.55 0.06 165)',
			'--bs-accent-2': 'oklch(0.65 0.07 165)',
			'--bs-accent-soft': 'oklch(0.94 0.03 165)',
			'--bs-accent-tint': 'oklch(0.97 0.015 165)',
			'--bs-pos': 'oklch(0.55 0.08 165)',
			'--bs-pos-soft': 'oklch(0.94 0.03 165)',
			'--bs-neg': 'oklch(0.55 0.13 25)',
			'--bs-neg-soft': 'oklch(0.94 0.03 25)',
			'--bs-warn': 'oklch(0.65 0.12 60)'
		},
		dark: {
			'--bs-bg': '#0A0A0A',
			'--bs-bg-on': '#F5F5F5',
			'--bs-bg-on-2': 'rgba(245, 245, 245, 0.65)',
			'--bs-bg-on-3': 'rgba(245, 245, 245, 0.42)',
			'--bs-bg-line': 'rgba(245, 245, 245, 0.08)',
			'--bs-surface': '#141414',
			'--bs-surface-2': '#0F0F0F',
			'--bs-border': 'oklch(0.25 0.003 250)',
			'--bs-border-2': 'oklch(0.32 0.004 250)',
			'--bs-text': '#F5F5F5',
			'--bs-text-2': '#A3A3A3',
			'--bs-text-3': '#525252',
			'--bs-brand': '#FFFFFF',
			'--bs-brand-2': '#E5E5E5',
			'--bs-brand-3': '#CCCCCC',
			'--bs-brand-soft': 'oklch(0.22 0.003 250)',
			'--bs-brand-tint': 'oklch(0.18 0.003 250)',
			'--bs-accent': 'oklch(0.72 0.08 165)',
			'--bs-accent-2': 'oklch(0.78 0.09 165)',
			'--bs-accent-soft': 'oklch(0.28 0.04 165)',
			'--bs-accent-tint': 'oklch(0.22 0.03 165)',
			'--bs-pos': 'oklch(0.72 0.08 165)',
			'--bs-pos-soft': 'oklch(0.28 0.04 165)',
			'--bs-neg': 'oklch(0.68 0.13 25)',
			'--bs-neg-soft': 'oklch(0.28 0.06 25)',
			'--bs-warn': 'oklch(0.74 0.12 60)'
		}
	}
};

/* ── Typography ─────────────────────────────────────────────────────────── */
export interface TypographyDef {
	id: TypographyId;
	label: string;
	sans: string;
	mono: string;
	display: string;
	feature: string;
}

export const TYPOGRAPHY: Record<TypographyId, TypographyDef> = {
	geist: {
		id: 'geist',
		label: 'Geist + Fraunces',
		sans: '"Geist", ui-sans-serif, system-ui, sans-serif',
		mono: '"Geist Mono", ui-monospace, monospace',
		display: '"Fraunces", "Times New Roman", serif',
		feature: '"ss01" on, "cv11" on'
	},
	inter: {
		id: 'inter',
		label: 'Inter Tight',
		sans: '"Inter Tight", "Inter", ui-sans-serif, system-ui, sans-serif',
		mono: '"JetBrains Mono", ui-monospace, monospace',
		display: '"Inter Tight", ui-sans-serif, sans-serif',
		feature: '"cv11" on, "ss01" on'
	},
	serif: {
		id: 'serif',
		label: 'Fraunces (full)',
		sans: '"Geist", ui-sans-serif, system-ui, sans-serif',
		mono: '"Fraunces", "Geist Mono", serif',
		display: '"Fraunces", "Times New Roman", serif',
		feature: 'normal'
	},
	grotesk: {
		id: 'grotesk',
		label: 'Space Grotesk',
		sans: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
		mono: '"JetBrains Mono", ui-monospace, monospace',
		display: '"Fraunces", "Times New Roman", serif',
		feature: 'normal'
	}
};

/* ── Density ────────────────────────────────────────────────────────────── */
export const DENSITY: Record<DensityId, Tokens> = {
	compact: { '--bs-pad-card': '16px', '--bs-pad-row': '10px', '--bs-gap': '12px', '--bs-row-h': '52px' },
	regular: { '--bs-pad-card': '22px', '--bs-pad-row': '14px', '--bs-gap': '16px', '--bs-row-h': '60px' },
	comfy: { '--bs-pad-card': '28px', '--bs-pad-row': '18px', '--bs-gap': '20px', '--bs-row-h': '70px' }
};

const SHADOWS: Record<ShadowId, string> = {
	none: 'none',
	subtle: '0 1px 0 rgba(15,23,42,.02), 0 1px 2px rgba(15,23,42,.04)',
	lifted: '0 4px 14px rgba(15,23,42,.06), 0 1px 0 rgba(15,23,42,.02)'
};

interface TweakDefaults {
	mode: ColorMode;
	palette: PaletteId;
	typography: TypographyId;
	density: DensityId;
	radius: number;
	shadow: ShadowId;
	chart: ChartStyle;
}

const DEFAULTS: TweakDefaults = {
	mode: 'system',
	palette: 'mint',
	typography: 'geist',
	density: 'regular',
	radius: 14,
	shadow: 'subtle',
	chart: 'soft'
};

class ThemeStore {
	/** Light/dark/system mode — preserved API. */
	value = $state<ColorMode>(DEFAULTS.mode);
	resolved = $state<'light' | 'dark'>('light');

	palette = $state<PaletteId>(DEFAULTS.palette);
	typography = $state<TypographyId>(DEFAULTS.typography);
	density = $state<DensityId>(DEFAULTS.density);
	radius = $state<number>(DEFAULTS.radius);
	shadow = $state<ShadowId>(DEFAULTS.shadow);
	chart = $state<ChartStyle>(DEFAULTS.chart);

	#ready = false;

	async init() {
		const keys = ['theme', 'bs-palette', 'bs-typography', 'bs-density', 'bs-radius', 'bs-shadow', 'bs-chart'];
		const rows = await Promise.all(keys.map((k) => db.settings.get(k)));
		const [mode, palette, typography, density, radius, shadow, chart] = rows;
		if (mode?.value === 'light' || mode?.value === 'dark' || mode?.value === 'system') {
			this.value = mode.value;
		}
		if (typeof palette?.value === 'string' && palette.value in PALETTES) {
			this.palette = palette.value as PaletteId;
		}
		if (typeof typography?.value === 'string' && typography.value in TYPOGRAPHY) {
			this.typography = typography.value as TypographyId;
		}
		if (typeof density?.value === 'string' && density.value in DENSITY) {
			this.density = density.value as DensityId;
		}
		if (typeof radius?.value === 'number' && radius.value >= 0 && radius.value <= 32) {
			this.radius = radius.value;
		}
		if (shadow?.value === 'none' || shadow?.value === 'subtle' || shadow?.value === 'lifted') {
			this.shadow = shadow.value;
		}
		if (chart?.value === 'hairline' || chart?.value === 'soft' || chart?.value === 'bars') {
			this.chart = chart.value;
		}
		this.#ready = true;
		this.apply();
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		mq.addEventListener('change', () => this.apply());
	}

	/* Apply every token to documentElement in one pass. Called on init and
	   on every setter — and from a watcher so swatch clicks re-render. */
	apply() {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		const dark =
			this.value === 'dark' ||
			(this.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		this.resolved = dark ? 'dark' : 'light';
		root.classList.toggle('dark', dark);
		root.dataset.bsDark = dark ? '1' : '0';
		root.dataset.bsChart = this.chart;

		const palette = PALETTES[this.palette] ?? PALETTES.mint;
		const tokens = dark ? palette.dark : palette.light;
		for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);

		const dens = DENSITY[this.density] ?? DENSITY.regular;
		for (const [k, v] of Object.entries(dens)) root.style.setProperty(k, v);

		const ty = TYPOGRAPHY[this.typography] ?? TYPOGRAPHY.geist;
		root.style.setProperty('--bs-font-sans', ty.sans);
		root.style.setProperty('--bs-font-mono', ty.mono);
		root.style.setProperty('--bs-font-display', ty.display);
		root.style.setProperty('--bs-font-serif', '"Fraunces", "Times New Roman", serif');
		root.style.setProperty('--bs-font-feat', ty.feature);

		root.style.setProperty('--bs-radius', `${this.radius}px`);
		root.style.setProperty('--bs-radius-sm', `${Math.max(4, this.radius - 4)}px`);
		root.style.setProperty('--bs-shadow', SHADOWS[this.shadow]);

		/* Status-bar color: match the running bg so iOS / Android chrome blends
		   with the app instead of clashing with the jungle palette. */
		const bg = tokens['--bs-bg'];
		if (bg) {
			let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
			if (!meta) {
				meta = document.createElement('meta');
				meta.name = 'theme-color';
				document.head.appendChild(meta);
			}
			meta.content = bg;
		}
	}

	async set(v: ColorMode) {
		this.value = v;
		this.apply();
		if (this.#ready) await db.settings.put({ key: 'theme', value: v });
	}

	cycle() {
		const next: ColorMode =
			this.value === 'light' ? 'dark' : this.value === 'dark' ? 'system' : 'light';
		this.set(next);
	}

	async setPalette(p: PaletteId) {
		this.palette = p;
		this.apply();
		if (this.#ready) await db.settings.put({ key: 'bs-palette', value: p });
	}

	async setTypography(t: TypographyId) {
		this.typography = t;
		this.apply();
		if (this.#ready) await db.settings.put({ key: 'bs-typography', value: t });
	}

	async setDensity(d: DensityId) {
		this.density = d;
		this.apply();
		if (this.#ready) await db.settings.put({ key: 'bs-density', value: d });
	}

	async setRadius(r: number) {
		this.radius = r;
		this.apply();
		if (this.#ready) await db.settings.put({ key: 'bs-radius', value: r });
	}

	async setShadow(s: ShadowId) {
		this.shadow = s;
		this.apply();
		if (this.#ready) await db.settings.put({ key: 'bs-shadow', value: s });
	}

	async setChart(c: ChartStyle) {
		this.chart = c;
		this.apply();
		if (this.#ready) await db.settings.put({ key: 'bs-chart', value: c });
	}

	async resetTweaks() {
		await Promise.all([
			this.setPalette(DEFAULTS.palette),
			this.setTypography(DEFAULTS.typography),
			this.setDensity(DEFAULTS.density),
			this.setRadius(DEFAULTS.radius),
			this.setShadow(DEFAULTS.shadow),
			this.setChart(DEFAULTS.chart)
		]);
	}
}

export const theme = new ThemeStore();
