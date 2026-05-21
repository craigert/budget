import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'prompt',
			strategies: 'generateSW',
			scope: '/',
			base: '/',
			manifest: {
				name: 'BudgetSparrow',
				short_name: 'BudgetSparrow',
				description:
					'Local-first personal budgeting PWA — accounts, transactions, budgets, goals, taxes, and receipt OCR.',
				lang: 'en',
				categories: ['finance', 'productivity'],
				// theme_color controls the Android nav-bar tint while the app is
				// open; background_color is the splash backdrop iOS / Chromium
				// show before the first paint. Kept on-brand: dark chrome but
				// white splash, matching the sparrow artwork.
				theme_color: '#0f172a',
				background_color: '#ffffff',
				display: 'standalone',
				orientation: 'any',
				start_url: '/',
				scope: '/',
				icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
					{
						src: '/icons/icon-512-maskable.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				],
				// Long-press the app icon on Android / right-click on desktop Chrome
				// to jump straight into these actions.
				shortcuts: [
					{
						name: 'Add transaction',
						short_name: 'Add',
						url: '/transactions',
						icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
					},
					{
						name: 'Dashboard',
						short_name: 'Home',
						url: '/',
						icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
					},
					{
						name: 'Settings',
						short_name: 'Settings',
						url: '/settings',
						icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
					}
				]
				// TODO: add screenshots[] for richer Android install dialog once we
				// have real captures to drop into static/screenshots/.
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,webmanifest}'],
				// Serve the offline shell when the network is unreachable for a
				// navigation request. /offline is precached so it's always available.
				navigateFallback: '/offline',
				navigateFallbackDenylist: [/^\/api/]
			},
			devOptions: {
				enabled: false,
				type: 'module'
			}
		})
	]
});
