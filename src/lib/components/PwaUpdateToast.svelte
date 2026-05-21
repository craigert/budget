<script lang="ts">
	/**
	 * PWA update toast.
	 *
	 * vite-plugin-pwa is in "prompt" mode (see vite.config.ts), so a new
	 * service worker waits instead of activating automatically. We surface
	 * a small toast when one is waiting; clicking "Reload" calls
	 * updateServiceWorker(true), which sends skipWaiting and reloads.
	 *
	 * Auto-update would otherwise silently reload mid-session and clobber
	 * any in-progress form (receipt scan, transaction draft, etc.).
	 */
	import { useRegisterSW } from 'virtual:pwa-register/svelte';

	const { needRefresh, updateServiceWorker } = useRegisterSW({
		onRegisteredSW(swUrl, registration) {
			// Poll for updates every hour while the tab is open. Workbox normally
			// only re-checks on navigation; this keeps long-lived tabs honest.
			if (registration) {
				setInterval(() => {
					void registration.update();
				}, 60 * 60 * 1000);
			}
		}
	});

	function reload() {
		void updateServiceWorker(true);
	}

	function dismiss() {
		$needRefresh = false;
	}
</script>

{#if $needRefresh}
	<div
		role="status"
		aria-live="polite"
		class="fixed bottom-20 left-1/2 z-50 w-[min(20rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg md:bottom-4 dark:border-slate-700 dark:bg-slate-800"
	>
		<div class="flex items-start gap-3">
			<div class="flex-1 text-sm">
				<p class="font-medium text-slate-900 dark:text-slate-100">New version available</p>
				<p class="text-xs text-slate-500 dark:text-slate-400">Reload to get the latest update.</p>
			</div>
			<div class="flex shrink-0 flex-col gap-1">
				<button
					type="button"
					onclick={reload}
					class="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
				>
					Reload
				</button>
				<button
					type="button"
					onclick={dismiss}
					class="rounded-md px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
				>
					Later
				</button>
			</div>
		</div>
	</div>
{/if}
