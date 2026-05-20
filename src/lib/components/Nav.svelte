<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { theme } from '$lib/theme.svelte';

	const items = [
		{ href: '/', label: 'Home', icon: '🏠' },
		{ href: '/transactions', label: 'Transactions', icon: '💸' },
		{ href: '/budgets', label: 'Budgets', icon: '📊' },
		{ href: '/accounts', label: 'Accounts', icon: '🏦' },
		{ href: '/categories', label: 'Categories', icon: '🏷️' },
		{ href: '/settings', label: 'Settings', icon: '⚙️' }
	];

	function isActive(href: string) {
		const path = page.url.pathname;
		const full = `${base}${href === '/' ? '' : href}`;
		if (href === '/') return path === base || path === `${base}/` || path === '/';
		return path.startsWith(full);
	}
</script>

<!-- Desktop sidebar -->
<aside class="hidden md:flex md:w-56 md:flex-col md:border-r md:border-slate-200 md:bg-white md:dark:border-slate-800 md:dark:bg-slate-900">
	<div class="flex h-16 items-center px-5">
		<span class="text-xl font-semibold">💰 Budget</span>
	</div>
	<nav class="flex-1 space-y-1 px-3 pb-4">
		{#each items as item (item.href)}
			<a
				href={`${base}${item.href === '/' ? '/' : item.href}`}
				class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive(item.href)
					? 'bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
					: 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
			>
				<span class="text-base">{item.icon}</span>
				{item.label}
			</a>
		{/each}
	</nav>
	<div class="px-3 pb-4">
		<button
			onclick={() => theme.cycle()}
			class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
			aria-label="Toggle theme"
		>
			<span>Theme</span>
			<span class="text-xs uppercase tracking-wide text-slate-500">{theme.value}</span>
		</button>
	</div>
</aside>

<!-- Mobile bottom nav -->
<nav
	class="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-slate-800 dark:bg-slate-900"
>
	{#each items.slice(0, 5) as item (item.href)}
		<a
			href={`${base}${item.href === '/' ? '/' : item.href}`}
			class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs {isActive(item.href)
				? 'text-brand-600 dark:text-brand-300'
				: 'text-slate-500 dark:text-slate-400'}"
		>
			<span class="text-lg">{item.icon}</span>
			<span class="leading-none">{item.label}</span>
		</a>
	{/each}
</nav>
