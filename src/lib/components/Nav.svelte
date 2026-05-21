<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { NAV_ICONS } from '$lib/icons';
	import Icon from './Icon.svelte';

	// Primary nav (everything except Settings, which is pinned to the bottom)
	const items = [
		{ href: '/', label: 'Home', icon: NAV_ICONS.home },
		{ href: '/transactions', label: 'Transactions', icon: NAV_ICONS.transactions },
		{ href: '/budgets', label: 'Budgets', icon: NAV_ICONS.budgets },
		{ href: '/accounts', label: 'Accounts', icon: NAV_ICONS.accounts },
		{ href: '/goals', label: 'Goals', icon: NAV_ICONS.goals },
		{ href: '/business', label: 'Business', icon: NAV_ICONS.business },
		{ href: '/taxes', label: 'Taxes', icon: NAV_ICONS.taxes }
	];
	const settingsItem = { href: '/settings', label: 'Settings', icon: NAV_ICONS.settings };

	function isActive(href: string) {
		const path = page.url.pathname;
		const full = `${base}${href === '/' ? '' : href}`;
		if (href === '/') return path === base || path === `${base}/` || path === '/';
		return path.startsWith(full);
	}
</script>

<!-- Desktop sidebar -->
<aside class="hidden md:flex md:w-56 md:flex-col md:border-r md:border-slate-200 md:bg-white md:dark:border-slate-800 md:dark:bg-slate-900">
	<a href={`${base}/`} class="flex flex-col items-center justify-center px-4 pt-6 pb-5 transition-opacity hover:opacity-80" aria-label="Home">
		<span class="mb-2 text-lg font-bold text-slate-800 dark:text-slate-100">BudgetSparrow</span>
		<img src={`${base}/logo.png`} alt="BudgetSparrow" class="h-20 w-20 object-contain" />
	</a>
	<nav class="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
		{#each items as item (item.href)}
			<a
				href={`${base}${item.href === '/' ? '/' : item.href}`}
				class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive(item.href)
					? 'bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
					: 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
			>
				<Icon name={item.icon} size={18} />
				{item.label}
			</a>
		{/each}
	</nav>
	<!-- Settings pinned to the bottom -->
	<div class="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
		<a
			href={`${base}${settingsItem.href}`}
			class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive(settingsItem.href)
				? 'bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
				: 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
		>
			<Icon name={settingsItem.icon} size={18} />
			{settingsItem.label}
		</a>
	</div>
</aside>

<!-- Mobile bottom nav: every item, with Settings pinned at the end -->
<nav
	class="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-slate-800 dark:bg-slate-900"
>
	{#each items as item (item.href)}
		<a
			href={`${base}${item.href === '/' ? '/' : item.href}`}
			class="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] {isActive(item.href)
				? 'text-brand-600 dark:text-brand-300'
				: 'text-slate-500 dark:text-slate-400'}"
		>
			<Icon name={item.icon} size={20} />
			<span class="w-full truncate text-center leading-none">{item.label}</span>
		</a>
	{/each}
	<a
		href={`${base}${settingsItem.href}`}
		class="flex min-w-0 flex-1 flex-col items-center gap-0.5 border-l border-slate-200 px-1 py-2 text-[10px] dark:border-slate-800 {isActive(settingsItem.href)
			? 'text-brand-600 dark:text-brand-300'
			: 'text-slate-500 dark:text-slate-400'}"
	>
		<Icon name={settingsItem.icon} size={20} />
		<span class="w-full truncate text-center leading-none">{settingsItem.label}</span>
	</a>
</nav>
