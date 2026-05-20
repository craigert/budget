// One-off script: generate PWA icons from an inline SVG.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'static', 'icons');

// Brand SVG — green gradient circle with "$" glyph and a tiny chart accent
const SVG = ({ size, padding = 0, bg = '#0f172a' }) => {
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

async function render(svg, size, outFile) {
	await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(outFile);
	console.log('wrote', outFile);
}

await mkdir(outDir, { recursive: true });
// Standard (any) icons — let the bg show
await render(SVG({ size: 192 }), 192, join(outDir, 'icon-192.png'));
await render(SVG({ size: 512 }), 512, join(outDir, 'icon-512.png'));
// Maskable: pad the design so the safe-zone (80% center) holds the mark
await render(SVG({ size: 512, padding: 64 }), 512, join(outDir, 'icon-512-maskable.png'));
// Favicon (32x32) for the browser tab
await render(SVG({ size: 64 }), 64, join(outDir, 'icon-64.png'));

// Apple touch icon (rounded background expected, no transparency)
await render(SVG({ size: 180 }), 180, join(outDir, 'apple-touch-icon.png'));

console.log('Done.');
