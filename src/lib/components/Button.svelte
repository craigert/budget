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

	const variants = {
		primary:
			'bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-400 shadow-sm',
		secondary:
			'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
		ghost:
			'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
		onbrand:
			'border border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm',
		danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
	};

	const sizes = {
		sm: 'px-2.5 py-1.5 text-xs',
		md: 'px-3.5 py-2 text-sm'
	};
</script>

<button
	{type}
	{disabled}
	{onclick}
	class="inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {variants[variant]} {sizes[size]} {klass}"
>
	{@render children?.()}
</button>
