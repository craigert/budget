<script lang="ts">
	/*
	 * Count-up currency display. Matches the design's <MoneyUp> from
	 * proto/foundation.jsx — easeOutCubic over the requested duration with
	 * a settle timeout so backgrounded tabs never strand at the start value.
	 *
	 * Decimals is the number of fraction digits (0 = whole dollars). The
	 * span is tabular-nums so digits don't shift while animating.
	 */
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		value: number;
		duration?: number;
		delay?: number;
		decimals?: 0 | 2;
		prefix?: string;
		class?: string;
	}

	let {
		value,
		duration = 900,
		delay = 0,
		decimals = 0,
		prefix = '',
		class: cls = ''
	}: Props = $props();

	let displayed = $state(0);
	let raf = 0;
	let settle: ReturnType<typeof setTimeout> | null = null;
	let target = value;

	const fmt0 = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	});
	const fmt2 = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	function format(n: number) {
		const abs = Math.abs(n);
		const sign = n < 0 ? '-' : '';
		return prefix + sign + (decimals === 0 ? fmt0.format(abs) : fmt2.format(abs));
	}

	const text = $derived(format(displayed));

	function animateTo(next: number) {
		cancelAnimationFrame(raf);
		if (settle) clearTimeout(settle);
		const start = displayed;
		const t0 = performance.now() + delay;
		const ease = (t: number) => 1 - Math.pow(1 - t, 3);
		const tick = (now: number) => {
			const elapsed = now - t0;
			if (elapsed < 0) {
				raf = requestAnimationFrame(tick);
				return;
			}
			const p = Math.min(1, elapsed / duration);
			displayed = start + (next - start) * ease(p);
			if (p < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		settle = setTimeout(() => {
			displayed = next;
		}, delay + duration + 120);
	}

	onMount(() => {
		target = value;
		animateTo(value);
	});

	$effect(() => {
		if (value !== target) {
			target = value;
			animateTo(value);
		}
	});

	onDestroy(() => {
		cancelAnimationFrame(raf);
		if (settle) clearTimeout(settle);
	});
</script>

<span class={cls} style="font-variant-numeric: tabular-nums;">{text}</span>
