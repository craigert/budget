import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

const base = process.env.NODE_ENV === 'production' ? (process.env.BASE_PATH ?? '/BudgetSparrow') : '';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			strategies: 'generateSW',
			scope: `${base}/`,
			base: `${base}/`,
			manifest: {
				name: 'Budget',
				short_name: 'Budget',
				description: 'Personal budgeting PWA',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',
				start_url: `${base}/`,
				scope: `${base}/`,
				icons: [
					{ src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
					{ src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
					{
						src: `${base}/icons/icon-512-maskable.png`,
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,webmanifest}'],
				navigateFallback: `${base}/`,
				navigateFallbackDenylist: [/^\/api/]
			},
			devOptions: {
				enabled: false,
				type: 'module'
			}
		})
	]
});
