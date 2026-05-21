// Build-time script: regenerate PWA icons + iOS splash screens.
// Wired into `npm run build` via the prebuild npm hook.
//
// Source:
//   1. If `static/brand/sparrow.png` exists, the brand artwork is used as
//      the source for every icon variant (resize for icons, composite at
//      80% scale on a white square for the maskable, composite at ~22%
//      scale on the splash background).
//   2. Otherwise, falls back to an inline SVG mark (green circle with $).
//
// Drop a 1024x1024 PNG (or larger, square, transparent or solid bg) at
// static/brand/sparrow.png and re-run the build — every icon regenerates.
import sharp from 'sharp';
import { mkdir, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'static', 'icons');
const splashDir = join(__dirname, '..', 'static', 'splash');
const brandPng = join(__dirname, '..', 'static', 'brand', 'applogo.png');

// Splash background — kept white so it matches the brand artwork (which
// has a white backdrop). Change to '#0f172a' to revert to the dark splash.
const SPLASH_BG = '#ffffff';
// Maskable safe-zone backdrop. Same rationale as above.
const MASKABLE_BG = '#ffffff';

// Fallback SVG — used when no brand PNG is present yet.
const FALLBACK_SVG = ({ size, padding = 0, bg = '#0f172a' }) => {
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

async function fileExists(path) {
	try {
		await access(path, FS.R_OK);
		return true;
	} catch {
		return false;
	}
}

await mkdir(iconsDir, { recursive: true });
await mkdir(splashDir, { recursive: true });

const usingBrand = await fileExists(brandPng);
console.log(usingBrand ? `Using brand artwork: ${brandPng}` : 'No brand PNG found — using fallback SVG mark.');

// --- Helpers -----------------------------------------------------------------

async function makeIcon(size, outFile) {
	if (usingBrand) {
		// 'contain' so the full mark (bird + coin + leaf) is always visible.
		// 'cover' would crop the top/bottom on a non-square source, eating
		// the dollar coin or the leaf.
		await sharp(brandPng)
			.resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
			.flatten({ background: '#ffffff' })
			.png({ compressionLevel: 9 })
			.toFile(outFile);
	} else {
		await sharp(Buffer.from(FALLBACK_SVG({ size }))).resize(size, size).png({ compressionLevel: 9 }).toFile(outFile);
	}
	console.log('wrote', outFile);
}

async function makeMaskable(size, outFile) {
	// Maskable spec: design must sit inside the 80% safe-zone. Pad the brand
	// art onto a solid square so the OS can crop to any shape (circle,
	// squircle, rounded square) without clipping the bird.
	if (usingBrand) {
		const inner = Math.round(size * 0.8);
		const offset = Math.round((size - inner) / 2);
		const innerBuf = await sharp(brandPng).resize(inner, inner, { fit: 'contain', background: MASKABLE_BG }).png().toBuffer();
		await sharp({
			create: { width: size, height: size, channels: 4, background: MASKABLE_BG }
		})
			.composite([{ input: innerBuf, top: offset, left: offset }])
			.png({ compressionLevel: 9 })
			.toFile(outFile);
	} else {
		// SVG fallback already pads internally.
		await sharp(Buffer.from(FALLBACK_SVG({ size, padding: Math.round(size / 8) }))).resize(size, size).png({ compressionLevel: 9 }).toFile(outFile);
	}
	console.log('wrote', outFile);
}

async function makeSplash(width, height, outFile) {
	if (usingBrand) {
		// Center the bird at ~22% of the shorter dimension on the splash bg.
		const mark = Math.round(Math.min(width, height) * 0.22);
		const markBuf = await sharp(brandPng).resize(mark, mark, { fit: 'contain', background: SPLASH_BG }).png().toBuffer();
		const top = Math.round((height - mark) / 2);
		const left = Math.round((width - mark) / 2);
		await sharp({
			create: { width, height, channels: 4, background: SPLASH_BG }
		})
			.composite([{ input: markBuf, top, left }])
			.png({ compressionLevel: 9 })
			.toFile(outFile);
	} else {
		const mark = Math.round(Math.min(width, height) * 0.22);
		const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
	<rect x="0" y="0" width="${width}" height="${height}" fill="${SPLASH_BG}"/>
	<circle cx="${width / 2}" cy="${height / 2}" r="${mark / 2}" fill="#10b981"/>
	<text x="${width / 2}" y="${height / 2 + mark * 0.13}" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="${mark * 0.55}" text-anchor="middle" fill="white">$</text>
</svg>`;
		await sharp(Buffer.from(svg)).resize(width, height).png({ compressionLevel: 9 }).toFile(outFile);
	}
	console.log('wrote', outFile);
}

// --- PWA icons ---------------------------------------------------------------
await makeIcon(192, join(iconsDir, 'icon-192.png'));
await makeIcon(512, join(iconsDir, 'icon-512.png'));
await makeIcon(64, join(iconsDir, 'icon-64.png'));
await makeIcon(180, join(iconsDir, 'apple-touch-icon.png'));
await makeMaskable(512, join(iconsDir, 'icon-512-maskable.png'));

// --- iOS launch screens ------------------------------------------------------
// Sizes pulled from Apple's published launch-image list. Without these the
// installed app shows a white flash on every launch.
const splashes = [
	{ w: 1290, h: 2796 }, // iPhone 14 Pro Max / 15 Plus
	{ w: 1179, h: 2556 }, // iPhone 14 Pro / 15
	{ w: 1284, h: 2778 }, // iPhone 14 Plus / 13 Pro Max / 12 Pro Max
	{ w: 1170, h: 2532 }, // iPhone 14 / 13 / 13 Pro / 12 / 12 Pro
	{ w: 1125, h: 2436 }, // iPhone 13 mini / 12 mini / 11 Pro / XS / X
	{ w: 1242, h: 2688 }, // iPhone 11 Pro Max / XS Max
	{ w: 828, h: 1792 }, // iPhone 11 / XR
	{ w: 1242, h: 2208 }, // iPhone 8 Plus / 7 Plus / 6 Plus
	{ w: 750, h: 1334 }, // iPhone 8 / 7 / 6s / 6 / SE 2-3
	{ w: 640, h: 1136 }, // iPhone SE 1st gen / 5 / 5s
	{ w: 2048, h: 2732 }, // iPad Pro 12.9"
	{ w: 1668, h: 2388 }, // iPad Pro 11" / Air 10.9"
	{ w: 1668, h: 2224 }, // iPad 10.5"
	{ w: 1536, h: 2048 } // iPad mini / Air 2
];
for (const { w, h } of splashes) {
	await makeSplash(w, h, join(splashDir, `splash-${w}x${h}.png`));
}

console.log('Done.');
