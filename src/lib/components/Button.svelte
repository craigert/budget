<script lang="ts">
	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'onbrand';
		size?: 'sm' | 'md';
		type?: 'button' | 'submit';
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: import('svelte').Snippet;
		class?: string;
	}

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		onclick,
		children,
		class: klass = ''
	}: Props = $props();

	/*
	 * Variants are styled against the Claude Design hand-off tokens so they
	 * work on the new cream/white page headers (the old translucent-white
	 * 'onbrand' style was built for the green hero bar that no longer exists).
	 *
	 *   primary   — dark filled pill, light text. The default page CTA.
	 *   secondary — surface bg, hairline border, dark text. Outline-style.
	 *   ghost     — text-only, subtle hover bg.
	 *   onbrand   — alias of primary now (kept so old call-sites still work).
	 *   danger    — --bs-neg solid.
	 */
	const sizes = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm'
	};
</script>

<button
	{type}
	{disabled}
	{onclick}
	class="bs-btn bs-btn-{variant} inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-opacity focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {sizes[size]} {klass}"
>
	{@render children?.()}
</button>

<style>
	:global(.bs-btn-primary),
	:global(.bs-btn-onbrand) {
		background: var(--bs-text);
		color: var(--bs-bg);
		border: 0;
	}
	:global(.bs-btn-primary:hover:not(:disabled)),
	:global(.bs-btn-onbrand:hover:not(:disabled)) {
		opacity: 0.9;
	}

	:global(.bs-btn-secondary) {
		background: var(--bs-surface);
		color: var(--bs-text);
		border: 0.5px solid var(--bs-border);
		box-shadow: var(--bs-shadow);
	}
	:global(.bs-btn-secondary:hover:not(:disabled)) {
		background: var(--bs-surface-2);
	}

	:global(.bs-btn-ghost) {
		background: transparent;
		color: var(--bs-text-2);
		border: 0;
	}
	:global(.bs-btn-ghost:hover:not(:disabled)) {
		background: color-mix(in oklch, var(--bs-text-3) 12%, transparent);
		color: var(--bs-text);
	}

	:global(.bs-btn-danger) {
		background: var(--bs-neg);
		color: white;
		border: 0;
	}
	:global(.bs-btn-danger:hover:not(:disabled)) {
		opacity: 0.9;
	}
</style>
