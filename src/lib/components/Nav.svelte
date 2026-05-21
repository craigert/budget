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

	const settingsActive = $derived(isActive(settingsItem.href));
</script>

<!--
	Desktop sidebar — Claude Design hand-off layout.
	Compact inline wordmark at top (small logo + "Budget Sparrow" text where
	"Sparrow" picks up the warm mahogany accent), nav items below, Settings
	pinned at the bottom. Background uses --bs-bg so the sidebar visually
	merges with the page body rather than reading as a distinct white panel.
-->
<aside
	class="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-col md:self-start"
	style="background: var(--bs-bg); border-right: 0.5px solid var(--bs-border);"
>
	<a
		href={`${base}/`}
		class="flex items-center gap-2.5 px-5 pt-6 pb-6 transition-opacity hover:opacity-80"
		aria-label="Home"
	>
		<img src={`${base}/logo.png`} alt="" class="h-9 w-9 object-contain shrink-0" />
		<span
			class="text-base font-semibold tracking-tight"
			style="font-family: var(--bs-font-display); color: var(--bs-text); letter-spacing: -0.015em;"
		>
			Budget<span style="font-weight: 500; color: var(--bs-accent);">&nbsp;Sparrow</span>
		</span>
	</a>
	<nav class="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
		{#each items as item (item.href)}
			{@const active = isActive(item.href)}
			<a
				href={`${base}${item.href === '/' ? '/' : item.href}`}
				class="bs-nav-item"
				class:bs-nav-active={active}
				aria-current={active ? 'page' : undefined}
			>
				<Icon name={item.icon} size={18} />
				{item.label}
			</a>
		{/each}
	</nav>
	<!-- Settings pinned to the bottom -->
	<div class="px-3 py-3" style="border-top: 0.5px solid var(--bs-border);">
		<a
			href={`${base}${settingsItem.href}`}
			class="bs-nav-item"
			class:bs-nav-active={settingsActive}
			aria-current={settingsActive ? 'page' : undefined}
		>
			<Icon name={settingsItem.icon} size={18} />
			{settingsItem.label}
		</a>
	</div>
</aside>

<!-- Mobile bottom nav: every item, with Settings pinned at the end -->
<nav
	class="fixed inset-x-0 bottom-0 z-30 flex pb-[env(safe-area-inset-bottom)] md:hidden"
	style="background: var(--bs-surface); border-top: 0.5px solid var(--bs-border);"
>
	{#each items as item (item.href)}
		{@const active = isActive(item.href)}
		<a
			href={`${base}${item.href === '/' ? '/' : item.href}`}
			class="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px]"
			style="color: {active ? 'var(--bs-brand)' : 'var(--bs-text-3)'};"
		>
			<Icon name={item.icon} size={20} />
			<span class="w-full truncate text-center leading-none">{item.label}</span>
		</a>
	{/each}
	<a
		href={`${base}${settingsItem.href}`}
		class="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px]"
		style="border-left: 0.5px solid var(--bs-border); color: {settingsActive ? 'var(--bs-brand)' : 'var(--bs-text-3)'};"
	>
		<Icon name={settingsItem.icon} size={20} />
		<span class="w-full truncate text-center leading-none">{settingsItem.label}</span>
	</a>
</nav>

<style>
	/* Nav row pulled into a single style so light/dark/active states all
	   resolve from --bs-* tokens. Active state matches the design's filled
	   green pill with brand-tinted text. */
	:global(.bs-nav-item) {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 9px 12px;
		font-size: 14px;
		font-weight: 500;
		color: var(--bs-text-2);
		border-radius: var(--bs-radius-sm);
		transition: background-color 0.12s ease, color 0.12s ease;
	}
	:global(.bs-nav-item:hover) {
		background: color-mix(in oklch, var(--bs-text-3) 10%, transparent);
		color: var(--bs-text);
	}
	:global(.bs-nav-item.bs-nav-active) {
		background: color-mix(in oklch, var(--bs-brand) 14%, transparent);
		color: var(--bs-brand);
	}
	:global(.bs-nav-item.bs-nav-active:hover) {
		background: color-mix(in oklch, var(--bs-brand) 20%, transparent);
	}
</style>
