<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		open: boolean;
		title: string;
		onclose: () => void;
		children?: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	}

	let { open, title, onclose, children, footer }: Props = $props();

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={open ? onkeydown : null} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		role="dialog"
		aria-modal="true"
		onclick={onclose}
		onkeydown={(e) => e.key === 'Enter' && onclose()}
		tabindex="-1"
		transition:fade={{ duration: 110 }}
	>
		<div
			class="flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900"
			style="will-change: transform, opacity;"
			onclick={(e) => e.stopPropagation()}
			role="document"
			onkeydown={(e) => e.stopPropagation()}
			transition:scale={{ duration: 140, start: 0.97, easing: cubicOut }}
		>
			<div class="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
				<h2 class="text-lg font-semibold">{title}</h2>
				<button
					type="button"
					onclick={onclose}
					class="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
					aria-label="Close"
				>
					✕
				</button>
			</div>
			<div class="flex-1 overflow-y-auto px-5 py-4">
				{@render children?.()}
			</div>
			{#if footer}
				<div class="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
