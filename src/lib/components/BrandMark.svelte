<script lang="ts" module>
	/*
	 * Merchant / bank brand marks from the Claude Design handoff
	 * (proto/foundation.jsx BRANDS + BANKS). Each entry is { bg, fg, txt } —
	 * background, foreground, and the monogram letters to show. If a payee
	 * doesn't match a known brand, we fall back to the first letter on a
	 * surface-2 tile.
	 */
	export interface BrandEntry {
		bg: string;
		fg: string;
		txt: string;
	}

	export const BRANDS: Record<string, BrandEntry> = {
		"Peet's Coffee": { bg: '#C8442E', fg: '#fff', txt: 'P' },
		Geico: { bg: '#0C2074', fg: '#fff', txt: 'G' },
		IKEA: { bg: '#0058A3', fg: '#FFDB00', txt: 'IK' },
		'Stripe payout': { bg: '#635BFF', fg: '#fff', txt: 'S' },
		'Trader Joe’s': { bg: '#B5121B', fg: '#fff', txt: 'TJ' },
		"Trader Joe's": { bg: '#B5121B', fg: '#fff', txt: 'TJ' },
		Shell: { bg: '#FBCE07', fg: '#D42A1C', txt: 'Sh' },
		'Comcast Xfinity': { bg: '#0089CF', fg: '#fff', txt: 'X' },
		'Whole Foods': { bg: '#00674B', fg: '#fff', txt: 'WF' },
		Spotify: { bg: '#1DB954', fg: '#fff', txt: 'Sp' },
		Notion: { bg: '#000000', fg: '#fff', txt: 'N' },
		'Apartment Rent': { bg: '#1E5A2C', fg: '#fff', txt: 'R' },
		Chevron: { bg: '#1B3D8F', fg: '#E01E2B', txt: 'C' },
		'CVS Pharmacy': { bg: '#CC0000', fg: '#fff', txt: 'CV' },
		'AMC Theaters': { bg: '#E11A2C', fg: '#fff', txt: 'A' },
		'Acme Payroll': { bg: '#1E8A3C', fg: '#fff', txt: 'A' }
	};

	export const BANKS: Record<string, BrandEntry> = {
		'Wells Fargo': { bg: '#D71E2B', fg: '#FFCD41', txt: 'WF' },
		Marcus: { bg: '#0033A0', fg: '#fff', txt: 'M' },
		Chase: { bg: '#117ACA', fg: '#fff', txt: 'C' },
		'American Express': { bg: '#006FCF', fg: '#fff', txt: 'AX' },
		Fidelity: { bg: '#00754A', fg: '#fff', txt: 'F' },
		Vanguard: { bg: '#96151D', fg: '#fff', txt: 'V' },
		Ally: { bg: '#751975', fg: '#fff', txt: 'A' }
	};

	function fallback(name: string): BrandEntry {
		const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
		return { bg: 'var(--bs-surface-2)', fg: 'var(--bs-text-2)', txt: initial };
	}

	export function lookup(name: string, map: 'brand' | 'bank' = 'brand'): BrandEntry {
		const table = map === 'bank' ? BANKS : BRANDS;
		return table[name] ?? fallback(name);
	}
</script>

<script lang="ts">
	interface Props {
		name: string;
		size?: number;
		radius?: number;
		map?: 'brand' | 'bank';
	}

	let { name, size = 38, radius = 12, map = 'brand' }: Props = $props();

	const entry = $derived(lookup(name, map));
	const fontSize = $derived(entry.txt.length > 1 ? size * 0.32 : size * 0.42);
</script>

<span
	class="bs-brand-mark"
	style="width: {size}px; height: {size}px; border-radius: {radius}px; background: {entry.bg}; color: {entry.fg}; font-size: {fontSize}px;"
>{entry.txt}</span>

<style>
	.bs-brand-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-family: var(--bs-font-sans);
		font-weight: 600;
		letter-spacing: -0.02em;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
	}
</style>
