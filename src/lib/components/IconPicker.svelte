<script lang="ts">
	import { ICON_GROUPS } from '$lib/icons';
	import Icon from './Icon.svelte';

	interface Props {
		value: string;
		/** Pass any changing value (e.g. modal `open`) to reset internal state on open */
		resetKey?: unknown;
	}

	let { value = $bindable(), resetKey }: Props = $props();

	const COMMON_ICONS = [
		'finance-ecommerce/coins-01',
		'finance-ecommerce/shopping-cart',
		'general/home',
		'maps-travel/car',
		'general/heart',
		'education/briefcase-01'
	];

	let showAll = $state(false);
	let query = $state('');

	// Reset expanded state whenever the parent opens or resets the form
	$effect(() => {
		resetKey; // track as dependency
		showAll = false;
		query = '';
	});

	// Always surface the active icon even if it's not in the common set
	const compactIcons = $derived.by(() => {
		const icons = [...COMMON_ICONS];
		if (!icons.includes(value)) icons.push(value);
		return icons;
	});

	const filteredGroups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return ICON_GROUPS;
		return ICON_GROUPS.map((g) => ({
			label: g.label,
			icons: g.icons.filter((p) => p.toLowerCase().includes(q))
		})).filter((g) => g.icons.length > 0);
	});

	function iconLabel(p: string) {
		const name = p.split('/').pop() ?? p;
		return name.replace(/-\d+$/, '').replace(/-/g, ' ');
	}

	function select(icon: string) {
		value = icon;
		showAll = false;
	}
</script>

{#if showAll}
	<!-- Expanded: search + full grouped list -->
	<input type="search" bind:value={query} placeholder="Search icons…" class="mb-3 w-full" autofocus />
	<div class="space-y-3">
		{#each filteredGroups as g (g.label)}
			<div>
				<div class="section-label mb-1.5">{g.label}</div>
				<div class="grid grid-cols-8 gap-1 sm:grid-cols-10">
					{#each g.icons as p (p)}
						<button
							type="button"
							title={iconLabel(p)}
							class="flex h-9 w-9 items-center justify-center rounded transition-colors {value === p
								? 'bg-brand-500 text-white'
								: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
							onclick={() => select(p)}
							aria-label={iconLabel(p)}
						>
							<Icon name={p} size={20} />
						</button>
					{/each}
				</div>
			</div>
		{/each}
		{#if filteredGroups.length === 0}
			<p class="py-4 text-center text-sm text-slate-500">No icons match "{query}".</p>
		{/if}
	</div>
	<button type="button" class="mt-2 text-xs text-slate-500 hover:underline" onclick={() => (showAll = false)}>
		Show less
	</button>
{:else}
	<!-- Compact: 6 common icons + current selection (if different) + expand button -->
	<div class="flex flex-wrap gap-1">
		{#each compactIcons as p (p)}
			<button
				type="button"
				title={iconLabel(p)}
				class="flex h-9 w-9 items-center justify-center rounded transition-colors {value === p
					? 'bg-brand-500 text-white'
					: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
				onclick={() => (value = p)}
				aria-label={iconLabel(p)}
			>
				<Icon name={p} size={20} />
			</button>
		{/each}
		<button
			type="button"
			class="flex h-9 w-9 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
			onclick={() => (showAll = true)}
			aria-label="Show all icons"
			title="More icons"
		>
			···
		</button>
	</div>
{/if}
