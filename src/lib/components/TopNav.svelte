<script lang="ts">
	/*
	 * Desktop top pill nav, matching the Forest reference in the Claude Design
	 * handoff (chat transcript: "I thought the navigation was on top on
	 * desktop"). Sticky, glass-backdrop, with:
	 *   left:   sparrow logo + "Budget Sparrow" wordmark (Sparrow italic brass)
	 *   center: pill nav (Home / Transactions / Budgets / Accounts / Taxes)
	 *   right:  search field, dark toggle, theme tweaks, Add CTA, avatar
	 *
	 * On mobile we fall through to a tight collapsed header (logo + Add + dark
	 * toggle) and let the existing bottom Nav.svelte handle tab switching.
	 */
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { theme } from '$lib/theme.svelte';
	import Icon from './Icon.svelte';
	import SearchOverlay from './SearchOverlay.svelte';

	let showSearch = $state(false);

	const items = [
		{ href: '/', label: 'Home', icon: 'home' },
		{ href: '/transactions', label: 'Transactions', icon: 'list' },
		{ href: '/budgets', label: 'Budgets', icon: 'pie' },
		{ href: '/accounts', label: 'Accounts', icon: 'wallet' },
		{ href: '/taxes', label: 'Taxes', icon: 'receipt' }
	];

	function isActive(href: string) {
		const path = page.url.pathname;
		const full = `${base}${href === '/' ? '' : href}`;
		if (href === '/') return path === base || path === `${base}/` || path === '/';
		return path.startsWith(full);
	}

	function onkeydown(e: KeyboardEvent) {
		const meta = e.ctrlKey || e.metaKey;
		if (meta && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			showSearch = true;
		}
	}

	function toggleDark() {
		theme.set(theme.resolved === 'dark' ? 'light' : 'dark');
	}
</script>

<svelte:window onkeydown={onkeydown} />

<header class="bs-topnav">
	<a href={`${base}/`} class="bs-topnav-brand" aria-label="Budget Sparrow home">
		<img src={`${base}/logo.png`} alt="" width="30" height="30" class="bs-topnav-logo" />
		<span class="bs-topnav-wordmark">
			Budget<span class="bs-topnav-wordmark-accent">Sparrow</span>
		</span>
	</a>

	<nav class="bs-topnav-pills" aria-label="Primary">
		{#each items as item (item.href)}
			{@const active = isActive(item.href)}
			<a
				href={`${base}${item.href === '/' ? '/' : item.href}`}
				class="bs-pill"
				class:active
				aria-current={active ? 'page' : undefined}
			>
				{#if item.icon === 'home'}
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={active ? 2 : 1.7} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M3 11.5 12 4l9 7.5M5 10v9.5h14V10" />
					</svg>
				{:else if item.icon === 'list'}
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={active ? 2 : 1.7} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M8 6h12M8 12h12M8 18h12" />
						<circle cx="4" cy="6" r="1" />
						<circle cx="4" cy="12" r="1" />
						<circle cx="4" cy="18" r="1" />
					</svg>
				{:else if item.icon === 'pie'}
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={active ? 2 : 1.7} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 3v9h9" />
						<path d="M21 12a9 9 0 1 1-9-9" />
					</svg>
				{:else if item.icon === 'wallet'}
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={active ? 2 : 1.7} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M3 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
						<path d="M3 7V6a2 2 0 0 1 2-2h11" />
						<circle cx="16" cy="13.5" r="1" />
					</svg>
				{:else if item.icon === 'receipt'}
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={active ? 2 : 1.7} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M5 3v18l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4V3l-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4L5 3Z" />
						<path d="M9 8h6M9 12h6" />
					</svg>
				{/if}
				<span class="bs-pill-label">{item.label}</span>
			</a>
		{/each}
	</nav>

	<div class="bs-topnav-spacer"></div>

	<div class="bs-topnav-right">
		<button
			type="button"
			class="bs-topnav-search"
			onclick={() => (showSearch = true)}
			aria-label="Search (Ctrl+K)"
			title="Search (Ctrl+K)"
		>
			<Icon name="general/search-md" size={15} />
			<span class="bs-topnav-search-label">Search…</span>
		</button>
		<button
			type="button"
			class="bs-topnav-icon"
			onclick={toggleDark}
			aria-label="Toggle dark mode"
		>
			{#if theme.resolved === 'dark'}
				<Icon name="weather/sun" size={17} />
			{:else}
				<Icon name="weather/moon" size={17} />
			{/if}
		</button>
		<a href={`${base}/transactions`} class="bs-topnav-add">
			<Icon name="general/plus" size={16} />
			<span>Add</span>
		</a>
		<a href={`${base}/settings`} class="bs-topnav-avatar" aria-label="Settings">JL</a>
	</div>
</header>

<SearchOverlay open={showSearch} onclose={() => (showSearch = false)} />

<style>
	.bs-topnav {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 14px 32px;
		background: var(--bs-glass, color-mix(in oklch, var(--bs-bg) 82%, transparent));
		backdrop-filter: blur(20px) saturate(160%);
		-webkit-backdrop-filter: blur(20px) saturate(160%);
		border-bottom: 1px solid var(--bs-border);
	}

	.bs-topnav-brand {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		flex-shrink: 0;
	}
	.bs-topnav-logo {
		object-fit: contain;
		display: block;
		flex-shrink: 0;
	}
	.bs-topnav-wordmark {
		font-size: 16px;
		font-weight: 500;
		color: var(--bs-text);
		letter-spacing: -0.005em;
	}
	.bs-topnav-wordmark-accent {
		font-family: var(--bs-font-serif);
		font-style: italic;
		color: var(--bs-accent);
		margin-left: 3px;
		font-weight: 500;
	}

	.bs-topnav-pills {
		display: flex;
		gap: 2px;
		padding: 4px;
		margin-left: 10px;
		border-radius: 999px;
		background: var(--bs-bg-2);
	}

	.bs-pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 15px;
		border-radius: 999px;
		background: transparent;
		color: var(--bs-text-2);
		font-size: 13.5px;
		font-weight: 450;
		text-decoration: none;
		transition: background 160ms, color 160ms;
	}
	.bs-pill:hover {
		color: var(--bs-text);
	}
	.bs-pill.active {
		background: var(--bs-surface);
		color: var(--bs-brand);
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.bs-topnav-spacer {
		flex: 1;
	}

	.bs-topnav-right {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.bs-topnav-search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		border-radius: 999px;
		background: var(--bs-surface);
		border: 1px solid var(--bs-border);
		color: var(--bs-text-3);
		width: 200px;
		font-size: 12.5px;
		text-align: left;
	}
	.bs-topnav-search:hover {
		color: var(--bs-text-2);
	}

	.bs-topnav-icon {
		width: 38px;
		height: 38px;
		border-radius: 999px;
		background: var(--bs-surface);
		border: 1px solid var(--bs-border);
		color: var(--bs-text-2);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background 140ms, color 140ms, transform 0.05s ease;
	}
	.bs-topnav-icon:hover {
		background: var(--bs-surface-2);
		color: var(--bs-text);
	}
	.bs-topnav-icon:active {
		transform: scale(0.96);
	}

	.bs-topnav-add {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 9px 16px;
		border-radius: 999px;
		background: var(--bs-brand);
		color: #fff;
		font-size: 13.5px;
		font-weight: 500;
		text-decoration: none;
		transition: opacity 0.15s ease, transform 0.05s ease;
	}
	.bs-topnav-add:hover {
		opacity: 0.92;
	}
	.bs-topnav-add:active {
		transform: scale(0.97);
	}

	.bs-topnav-avatar {
		width: 36px;
		height: 36px;
		border-radius: 999px;
		background: var(--bs-accent);
		color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--bs-font-serif);
		font-style: italic;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
		text-decoration: none;
	}

	/* ── Tablet / medium-screen layout (768 → 1100) ───────────────────
	   At these widths the full "icon + label" pill nav and 200px search
	   input overflow the bar. Drop pill labels (icons-only) and collapse
	   the search into a small round icon-button matching the dark/avatar
	   circles. Pill nav stays visible so users can still navigate from
	   the top — Tailwind's md: breakpoint hides the bottom nav at
	   ≥768px, so the top nav takes over from there.
	   At ≥1100px the full label layout returns. */
	@media (max-width: 1099px) and (min-width: 768px) {
		.bs-pill-label {
			display: none;
		}
		.bs-pill {
			padding: 8px 10px;
			gap: 0;
		}
		.bs-topnav-search-label {
			display: none;
		}
		.bs-topnav-search {
			width: 38px;
			height: 38px;
			padding: 0;
			justify-content: center;
			color: var(--bs-text-2);
		}
		.bs-topnav-search:hover {
			color: var(--bs-text);
			background: var(--bs-surface-2);
		}
		.bs-topnav {
			gap: 12px;
		}
	}

	/* ── Mobile compact layout (<768, matches Tailwind's md: breakpoint)
	   The bottom Nav.svelte tab bar takes over here, so the top bar drops
	   the pill nav + search and shows just brand + dark/gear/Add/avatar. */
	@media (max-width: 767px) {
		.bs-topnav {
			padding: 12px 16px;
			gap: 10px;
		}
		.bs-topnav-pills,
		.bs-topnav-search,
		.bs-topnav-add span {
			display: none;
		}
		.bs-topnav-add {
			padding: 9px 14px;
		}
		.bs-topnav-spacer {
			flex: 1;
		}
	}

	/* Tighten the brand wordmark + Add CTA on small phones so the row
	   doesn't overflow at 320 px. */
	@media (max-width: 480px) {
		.bs-topnav {
			padding: 10px 14px;
			gap: 8px;
		}
		.bs-topnav-right {
			gap: 6px;
		}
		.bs-topnav-add {
			padding: 8px 12px;
		}
		.bs-topnav-avatar {
			width: 32px;
			height: 32px;
			font-size: 12px;
		}
		.bs-topnav-wordmark {
			font-size: 14px;
		}
	}
</style>
