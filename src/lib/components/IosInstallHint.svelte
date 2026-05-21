<script lang="ts">
	/**
	 * iOS install hint — instructional, not actionable.
	 *
	 * Mobile Safari ignores `beforeinstallprompt` and gives no JS API to
	 * trigger Add-to-Home-Screen. The ONLY install path is the user tapping
	 * Share → Add to Home Screen themselves. So this component is a tutorial
	 * card, not a button. We deliberately make it look like instructions
	 * (numbered steps, share-icon glyph, no big tappable area) so users don't
	 * mistake it for an install button and tap the card expecting magic.
	 *
	 * Shows only when:
	 *   - we're on iOS Safari (not Chrome/Firefox/Edge for iOS, which can't install)
	 *   - the app is NOT already running as a standalone PWA
	 *   - the user hasn't dismissed the hint before (localStorage flag)
	 */
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	// v2: bumped so devices that dismissed the original button-styled card
	// see the redesigned instructional version. Increment again if the copy
	// or layout changes materially.
	const STORAGE_KEY = 'ios-install-hint-dismissed-v2';

	let visible = $state(false);

	function isIosSafari(): boolean {
		if (typeof navigator === 'undefined') return false;
		const ua = navigator.userAgent;
		// iPad now reports as Macintosh; check for touch too.
		const isIos = /iPad|iPhone|iPod/.test(ua) ||
			(ua.includes('Macintosh') && 'ontouchend' in document);
		if (!isIos) return false;
		// Exclude in-app browsers and non-Safari iOS browsers — none can install.
		if (/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\//.test(ua)) return false;
		return /Safari/.test(ua);
	}

	function isStandalone(): boolean {
		if (typeof window === 'undefined') return false;
		return (
			window.matchMedia?.('(display-mode: standalone)').matches ||
			(window.navigator as Navigator & { standalone?: boolean }).standalone === true
		);
	}

	onMount(() => {
		if (!isIosSafari() || isStandalone()) return;
		if (localStorage.getItem(STORAGE_KEY) === '1') return;
		visible = true;
	});

	function dismiss() {
		try {
			localStorage.setItem(STORAGE_KEY, '1');
		} catch {
			// localStorage can throw in private mode — fine, just hide for this session.
		}
		visible = false;
	}
</script>

{#if visible}
	<!--
		Pinned to the bottom of the screen, just above Safari's own toolbar
		so the arrow can visually point toward Safari's Share button.
	-->
	<div
		role="dialog"
		aria-label="Install BudgetSparrow on your home screen"
		class="fixed bottom-2 left-1/2 z-50 w-[min(22rem,calc(100%-1rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
	>
		<div class="mb-3 flex items-center justify-between gap-3">
			<div class="flex items-center gap-2">
				<Icon name="general/download-cloud" size={18} class="text-brand-600 dark:text-brand-400" />
				<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Install BudgetSparrow</p>
			</div>
			<button
				type="button"
				onclick={dismiss}
				aria-label="Dismiss"
				class="-mr-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
			>
				<Icon name="general/x-close" size={16} />
			</button>
		</div>

		<ol class="space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
			<li class="flex items-start gap-2">
				<span class="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">1</span>
				<span class="flex flex-wrap items-center gap-1">
					Tap the
					<span class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium dark:bg-slate-700">
						<Icon name="general/share-04" size={12} /> Share
					</span>
					button in Safari's toolbar.
				</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">2</span>
				<span>
					Scroll down and choose
					<span class="font-medium text-slate-900 dark:text-white">Add to Home Screen</span>.
				</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">3</span>
				<span>Tap <span class="font-medium text-slate-900 dark:text-white">Add</span> to confirm.</span>
			</li>
		</ol>

		<button
			type="button"
			onclick={dismiss}
			class="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
		>
			Got it
		</button>
	</div>
{/if}
