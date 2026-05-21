<script lang="ts">
	/**
	 * iOS install hint.
	 *
	 * Mobile Safari ignores beforeinstallprompt and only installs via the
	 * Share sheet → "Add to Home Screen" path. Chrome on Android handles this
	 * itself with its built-in install banner, but iOS users get nothing,
	 * so they need a one-time nudge.
	 *
	 * Shows only when:
	 *   - we're on iOS Safari (not Chrome/Firefox/Edge for iOS, which can't install)
	 *   - the app is NOT already running as a standalone PWA
	 *   - the user hasn't dismissed the hint before (localStorage flag)
	 */
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	const STORAGE_KEY = 'ios-install-hint-dismissed';

	let visible = $state(false);

	function isIosSafari(): boolean {
		if (typeof navigator === 'undefined') return false;
		const ua = navigator.userAgent;
		// iPad now reports as Macintosh; check for touch as well.
		const isIos = /iPad|iPhone|iPod/.test(ua) ||
			(ua.includes('Macintosh') && 'ontouchend' in document);
		if (!isIos) return false;
		// Exclude in-app browsers (CriOS = Chrome on iOS, FxiOS = Firefox on iOS,
		// EdgiOS = Edge on iOS, OPiOS = Opera on iOS). None can install a PWA.
		if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
		return /Safari/.test(ua);
	}

	function isStandalone(): boolean {
		if (typeof window === 'undefined') return false;
		return (
			window.matchMedia?.('(display-mode: standalone)').matches ||
			// Legacy iOS API.
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
	<div
		role="dialog"
		aria-label="Install BudgetSparrow"
		class="fixed bottom-20 left-1/2 z-50 w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-brand-200 bg-white p-4 shadow-xl dark:border-brand-900 dark:bg-slate-800"
	>
		<div class="flex items-start gap-3">
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
				<Icon name="general/download-cloud" size={18} />
			</div>
			<div class="flex-1 text-sm">
				<p class="font-medium text-slate-900 dark:text-slate-100">Install BudgetSparrow</p>
				<p class="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
					Tap <Icon name="general/share-04" size={12} /> Share, then
					<span class="font-medium">Add to Home Screen</span> for the best experience.
				</p>
			</div>
			<button
				type="button"
				onclick={dismiss}
				aria-label="Dismiss"
				class="-mr-1 -mt-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
			>
				<Icon name="general/x-close" size={16} />
			</button>
		</div>
	</div>
{/if}
