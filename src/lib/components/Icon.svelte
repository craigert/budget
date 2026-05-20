<script lang="ts">
	import { base } from '$app/paths';

	interface Props {
		name: string;
		size?: number | string;
		class?: string;
		title?: string;
	}

	let { name, size = 20, class: klass = '', title }: Props = $props();

	// Backward compat: emoji or plain glyph (no folder) renders as text.
	const isPath = $derived(name.includes('/'));
	const url = $derived(`${base}/icons/${name}${name.endsWith('.svg') ? '' : '.svg'}`);
	const dim = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

{#if isPath}
	<span
		class="inline-block bg-current align-middle {klass}"
		style="width:{dim};height:{dim};-webkit-mask:url({url}) no-repeat center / contain;mask:url({url}) no-repeat center / contain;"
		role={title ? 'img' : 'presentation'}
		aria-label={title}
	></span>
{:else}
	<span class="inline-flex items-center justify-center align-middle {klass}" style="width:{dim};height:{dim};font-size:calc({dim} * 0.85)" aria-label={title} role={title ? 'img' : 'presentation'}>
		{name}
	</span>
{/if}
