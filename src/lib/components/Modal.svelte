<script lang="ts">
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

	/* Only close when the click is genuinely on the backdrop. Without this,
	   the click event that triggered openEdit can bubble in once the modal
	   mounts synchronously and immediately fire onclose. Also using
	   pointerdown→pointerup matching so a drag started inside the panel
	   that ends on the backdrop doesn't dismiss it. */
	let backdropPointerDown = false;
	function onBackdropPointerDown(e: PointerEvent) {
		backdropPointerDown = e.target === e.currentTarget;
	}
	function onBackdropClick(e: MouseEvent) {
		if (backdropPointerDown && e.target === e.currentTarget) onclose();
		backdropPointerDown = false;
	}
</script>

<svelte:window onkeydown={open ? onkeydown : null} />

{#if open}
	<div
		class="bs-modal-backdrop"
		role="dialog"
		aria-modal="true"
		onpointerdown={onBackdropPointerDown}
		onclick={onBackdropClick}
		onkeydown={(e) => e.key === 'Enter' && onclose()}
		tabindex="-1"
	>
		<div
			class="bs-modal-panel"
			onclick={(e) => e.stopPropagation()}
			role="document"
			onkeydown={(e) => e.stopPropagation()}
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

<style>
	/* CSS keyframes (not Svelte transitions) so the animation kicks in the
	   same paint frame the element mounts. Svelte's `transition:` directive
	   adds a tick of overhead before it computes from/to styles — enough to
	   feel like a delay between the click and the modal showing. */
	@keyframes bs-modal-backdrop-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes bs-modal-panel-in {
		from {
			opacity: 0;
			transform: scale(0.97);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	.bs-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.5);
		animation: bs-modal-backdrop-in 90ms ease-out;
	}
	.bs-modal-panel {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 32rem;
		max-height: 80dvh;
		overflow: hidden;
		border-radius: 1rem;
		background: var(--bs-surface, #fff);
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 4px 6px -4px rgba(0, 0, 0, 0.1);
		animation: bs-modal-panel-in 120ms cubic-bezier(0.2, 0.8, 0.3, 1);
		will-change: transform, opacity;
	}
	@media (prefers-reduced-motion: reduce) {
		.bs-modal-backdrop,
		.bs-modal-panel {
			animation: none;
		}
	}
</style>
