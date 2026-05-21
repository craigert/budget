/**
 * Chromium / Android install prompt bridge.
 *
 * Chrome dispatches `beforeinstallprompt` once it decides the page meets
 * the install criteria (HTTPS, manifest, SW, engagement heuristics). The
 * spec lets you preventDefault() and stash the event, then call .prompt()
 * later in response to a user gesture. That's what powers the in-app
 * "Install" button — without it the only way to install on Android is the
 * three-dot menu, which most users never find.
 *
 * iOS Safari ignores this event entirely; IosInstallHint covers that path.
 */

interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	prompt(): Promise<void>;
	readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
let installed = $state(false);

if (typeof window !== 'undefined') {
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt = e as BeforeInstallPromptEvent;
	});
	window.addEventListener('appinstalled', () => {
		installed = true;
		deferredPrompt = null;
	});
	// Detect "already installed and launched as a PWA" so we don't offer the
	// button in that case.
	const standalone =
		window.matchMedia?.('(display-mode: standalone)').matches ||
		(window.navigator as Navigator & { standalone?: boolean }).standalone === true;
	if (standalone) installed = true;
}

export const installPrompt = {
	get canInstall() {
		return deferredPrompt !== null && !installed;
	},
	get installed() {
		return installed;
	},
	async show(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
		const evt = deferredPrompt;
		if (!evt) return 'unavailable';
		await evt.prompt();
		const { outcome } = await evt.userChoice;
		// Per spec, prompt() can only be called once per event.
		deferredPrompt = null;
		return outcome;
	}
};
