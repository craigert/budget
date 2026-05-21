/**
 * Receipt OCR — client side.
 *
 * Posts the receipt image to the same-origin Cloudflare Worker proxy at
 * /api/scan-receipt. The Azure subscription key lives on the Worker, not in
 * the client bundle, and same-origin means no CORS dance.
 */

import { base } from '$app/paths';

export interface ReceiptScanResult {
	merchant?: string;
	total?: number;
	date?: string; // YYYY-MM-DD
	currency?: string;
	confidence?: number;
}

export async function scanReceiptWithAzure(blob: Blob): Promise<ReceiptScanResult> {
	const res = await fetch(`${base}/api/scan-receipt`, {
		method: 'POST',
		headers: { 'Content-Type': blob.type || 'image/jpeg' },
		body: blob
	});

	if (res.status === 503) {
		throw new Error('Receipt OCR is not configured on this deployment.');
	}
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		throw new Error(`OCR proxy ${res.status}: ${detail.slice(0, 200) || res.statusText}`);
	}
	return (await res.json()) as ReceiptScanResult;
}
