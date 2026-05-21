<script lang="ts">
	interface Props {
		blob: Blob | null;
		title?: string;
		onclose: () => void;
	}
	let { blob, title = 'Receipt', onclose }: Props = $props();

	let url = $state<string | null>(null);
	$effect(() => {
		if (!blob) {
			url = null;
			return;
		}
		const u = URL.createObjectURL(blob);
		url = u;
		return () => URL.revokeObjectURL(u);
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={url ? onkeydown : null} />

{#if url}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		onclick={onclose}
		onkeydown={(e) => e.key === 'Enter' && onclose()}
		tabindex="-1"
	>
		<img
			src={url}
			alt={title}
			class="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		/>
		<button
			type="button"
			onclick={onclose}
			class="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/20"
			aria-label="Close"
		>
			✕
		</button>
		<div class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur">
			{title}
		</div>
	</div>
{/if}
