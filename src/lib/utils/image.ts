/**
 * Resize + recompress an image client-side before we stuff it into IndexedDB.
 * Typical phone photos are 3–5 MB; receipts only need to be legible, so we cap
 * the longest side at 1280px and re-encode at JPEG 70%. End result is usually
 * 80–150 KB.
 */
export async function compressImage(
	source: Blob | File,
	maxDimension = 1280,
	quality = 0.7
): Promise<Blob> {
	const bitmap = await createImageBitmap(source);
	const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
	const w = Math.round(bitmap.width * scale);
	const h = Math.round(bitmap.height * scale);

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		// Fallback: hand back the original if 2D context isn't available
		return source instanceof Blob ? source : new Blob([source]);
	}
	// White background so transparent/HEIC sources don't read as black after JPEG
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, w, h);
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close?.();

	const blob: Blob | null = await new Promise((resolve) => {
		canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
	});
	return blob ?? (source instanceof Blob ? source : new Blob([source]));
}

/** Pick a sensible thumbnail size in CSS pixels for a row preview. */
export const RECEIPT_THUMB_PX = 40;
