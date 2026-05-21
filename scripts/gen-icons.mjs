// Build-time script: regenerate PWA icons + iOS splash screens from one SVG.
// Wired into `npm run build` via the prebuild npm hook.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'static', 'icons');
const splashDir = join(__dirname, '..', 'static', 'splash');

// Brand SVG — green gradient circle with "$" glyph
const ICON_SVG = ({ size, padding = 0, bg = '#0f172a' }) => {
	const s = size;
	const p = padding;
	const inner = s - p * 2;
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="#10b981"/>
			<stop offset="100%" stop-color="#0ea5e9"/>
		</linearGradient>
	</defs>
	<rect x="0" y="0" width="${s}" height="${s}" fill="${bg}"/>
	<circle cx="${s / 2}" cy="${s / 2}" r="${inner / 2 - inner * 0.04}" fill="url(#g)"/>
	<text x="${s / 2}" y="${s / 2 + inner * 0.13}" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="700" font-size="${inner * 0.55}" text-anchor="middle" fill="white">$</text>
</svg>`;
};

// iOS splash: solid dark background with the brand mark centered. Apple wants
// PNGs at the device's native pixel resolution.
const SPLASH_SVG = ({ width, height, bg = '#0f172a' }) => {
	const mark = Math.round(Math.min(width, height) * 0.22);
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="#10b981"/>
			<stop offset="100%" stop-color="#0ea5e9"/>
		</linearGradient>
	</defs>
	<rect x="0" y="0" width="${width}" height="${height}" fill="${bg}"/>
	<circle cx="${width / 2}" cy="${height / 2}" r="${mark / 2}" fill="url(#g)"/>
	<text x="${width / 2}" y="${height / 2 + mark * 0.13}" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="700" font-size="${mark * 0.55}" text-anchor="middle" fill="white">$</text>
</svg>`;
};

async function renderPng(svg, width, height, outFile) {
	await sharp(Buffer.from(svg), { density: 384 })
		.resize(width, height)
		.png({ compressionLevel: 9 })
		.toFile(outFile);
	console.log('wrote', outFile);
}

await mkdir(iconsDir, { recursive: true });
await mkdir(splashDir, { recursive: true });

// --- PWA icons ---------------------------------------------------------------
// Standard (any) icons — let the bg show.
await renderPng(ICON_SVG({ size: 192 }), 192, 192, join(iconsDir, 'icon-192.png'));
await renderPng(ICON_SVG({ size: 512 }), 512, 512, join(iconsDir, 'icon-512.png'));
// Maskable: pad the design so the safe-zone (80% center) holds the mark.
await renderPng(ICON_SVG({ size: 512, padding: 64 }), 512, 512, join(iconsDir, 'icon-512-maskable.png'));
// Favicon for the browser tab.
await renderPng(ICON_SVG({ size: 64 }), 64, 64, join(iconsDir, 'icon-64.png'));
// Apple touch icon (rounded background expected, no transparency).
await renderPng(ICON_SVG({ size: 180 }), 180, 180, join(iconsDir, 'apple-touch-icon.png'));

// --- iOS launch screens ------------------------------------------------------
// Per https://developer.apple.com/design/human-interface-guidelines/launching,
// iOS wants a launch image per device resolution. Without these, the installed
// app shows a white flash on launch. Sizes pulled from Apple's published list.
const splashes = [
	// iPhone 14 Pro Max / 15 Plus
	{ w: 1290, h: 2796 },
	// iPhone 14 Pro / 15
	{ w: 1179, h: 2556 },
	// iPhone 14 Plus / 13 Pro Max / 12 Pro Max
	{ w: 1284, h: 2778 },
	// iPhone 14 / 13 / 13 Pro / 12 / 12 Pro
	{ w: 1170, h: 2532 },
	// iPhone 13 mini / 12 mini / 11 Pro / XS / X
	{ w: 1125, h: 2436 },
	// iPhone 11 Pro Max / XS Max
	{ w: 1242, h: 2688 },
	// iPhone 11 / XR
	{ w: 828, h: 1792 },
	// iPhone 8 Plus / 7 Plus / 6 Plus
	{ w: 1242, h: 2208 },
	// iPhone 8 / 7 / 6s / 6 / SE 2/3
	{ w: 750, h: 1334 },
	// iPhone SE 1st gen / 5 / 5s
	{ w: 640, h: 1136 },
	// iPad Pro 12.9"
	{ w: 2048, h: 2732 },
	// iPad Pro 11" / Air 10.9"
	{ w: 1668, h: 2388 },
	// iPad 10.5"
	{ w: 1668, h: 2224 },
	// iPad mini / Air 2
	{ w: 1536, h: 2048 }
];
for (const { w, h } of splashes) {
	await renderPng(SPLASH_SVG({ width: w, height: h }), w, h, join(splashDir, `splash-${w}x${h}.png`));
}

console.log('Done.');
