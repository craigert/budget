<script lang="ts">
	/*
	 * Inline SVG brand mark — geometric sparrow silhouette from icons.jsx.
	 * Uses currentColor so it inherits text color, with one eye dot tinted
	 * by --bs-surface so it reads against any body color.
	 */
	interface Props {
		size?: number;
		class?: string;
	}
	let { size = 22, class: cls = '' }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 32 32"
	fill="none"
	aria-hidden="true"
	class={cls}
	style="flex-shrink: 0; display: block;"
>
	<path
		d="M5 17.5 C5 12.5 9 9.5 14 9.5 C17 9.5 19.5 11 21 13 L27 11 L25 16 C25.5 17 25.5 18 25 19 L24 21 C22.5 23 20 24 17 24 L11 24 C7 24 5 21 5 17.5 Z"
		fill="currentColor"
	/>
	<path
		d="M11 14 C13 13 16 13 19 15 L18 18 C16 17 13.5 16.5 11 17 Z"
		fill="currentColor"
		opacity="0.35"
	/>
	<circle cx="21.5" cy="14" r="0.9" fill="var(--bs-surface, #fff)" />
	<path d="M25.5 13 L29 12.5 L27 14.5 Z" fill="currentColor" opacity="0.7" />
</svg>
