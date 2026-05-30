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
		if (open && e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onkeydown} />

<!--
	The modal markup is always in the DOM and visibility-toggled via the
	`.open` class. Mounting the form children up front means the open
	path is just a class flip — no element creation, no form binding
	setup, no Svelte transition runtime — so click → visible is the
	fastest the browser can paint a single style change.

	When closed: `visibility: hidden; pointer-events: none;` so the
	overlay is unreachable to the cursor and skipped by accessibility
	trees. The original click that opened it can't hit the backdrop
	(pointer-events: none was still in effect at click time), so no
	open-then-close flicker.
-->
<div
	class="bs-modal-root"
	class:open
	role="dialog"
	aria-modal={open}
	aria-hidden={!open}
>
	<button
		type="button"
		class="bs-modal-backdrop"
		aria-label="Close"
		tabindex={open ? 0 : -1}
		onclick={onclose}
	></button>
	<div class="bs-modal-panel" role="document">
		<div class="bs-modal-header">
			<h2 class="bs-modal-title">{title}</h2>
			<button
				type="button"
				onclick={onclose}
				class="bs-modal-close"
				aria-label="Close"
			>
				✕
			</button>
		</div>
		<div class="bs-modal-content">
			{@render children?.()}
		</div>
		{#if footer}
			<div class="bs-modal-footer">
				{@render footer()}
			</div>
		{/if}
	</div>
</div>

<style>
	.bs-modal-root {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		visibility: hidden;
		pointer-events: none;
	}
	.bs-modal-root.open {
		visibility: visible;
		pointer-events: auto;
	}

	.bs-modal-backdrop {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		padding: 0;
		margin: 0;
		background: rgba(0, 0, 0, 0.5);
		cursor: default;
	}

	.bs-modal-panel {
		position: relative;
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
	}
	:global(.dark) .bs-modal-panel {
		background: var(--bs-panel, #1a2118);
		color: var(--bs-panel-tx, #e8e0cc);
	}

	.bs-modal-header {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--bs-border);
	}
	.bs-modal-title {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--bs-text);
	}
	.bs-modal-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		color: var(--bs-text-3);
		border-radius: 6px;
		cursor: pointer;
	}
	.bs-modal-close:hover {
		background: color-mix(in oklch, var(--bs-text) 6%, transparent);
		color: var(--bs-text);
	}

	.bs-modal-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
	}

	.bs-modal-footer {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 20px;
		border-top: 1px solid var(--bs-border);
	}
</style>
