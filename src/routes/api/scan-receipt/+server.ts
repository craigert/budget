/**
 * Server-side proxy for Azure Document Intelligence receipt OCR.
 *
 * Runs on the Cloudflare Worker (via @sveltejs/adapter-cloudflare). The Azure
 * subscription key lives only on the Worker — it never touches the client
 * bundle, so visitors cannot extract it from DevTools.
 *
 * Required Cloudflare environment variables (set in dashboard → Settings →
 * Variables; mark the key as a Secret):
 *
 *   AZURE_DOC_INTEL_ENDPOINT      e.g. https://YOUR-RESOURCE.cognitiveservices.azure.com
 *   AZURE_DOC_INTEL_KEY           32-char subscription key (SECRET)
 *   AZURE_DOC_INTEL_MODEL         (optional, default: prebuilt-receipt)
 *   AZURE_DOC_INTEL_API_VERSION   (optional, default: 2024-11-30)
 *
 * Optional:
 *   ALLOWED_ORIGINS               comma-separated list of allowed Origin headers.
 *                                 If unset, all origins are accepted (dev mode).
 *
 * Auth posture: Origin-header check only. Stops casual abuse via curl/Postman
 * but is trivially bypassed by anyone willing to spoof a header. Fine for an
 * internal demo; do NOT treat this as production-grade access control.
 */

import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';

export const prerender = false;

const DEFAULT_MODEL = 'prebuilt-receipt';
const DEFAULT_API_VERSION = '2024-11-30';
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_MS = 30_000;
const MAX_BODY_BYTES = 6 * 1024 * 1024; // 6 MB — Workers free plan request cap is ~10 MB.

interface AzureField {
	type: string;
	content?: string;
	valueString?: string;
	valueNumber?: number;
	valueCurrency?: { amount: number; currencyCode?: string };
	valueDate?: string;
	confidence?: number;
}

interface AzureAnalyzePoll {
	status: 'notStarted' | 'running' | 'succeeded' | 'failed' | 'canceled';
	analyzeResult?: {
		documents?: Array<{
			fields?: Record<string, AzureField>;
			confidence?: number;
		}>;
		content?: string;
	};
	error?: { code: string; message: string };
}

function checkOrigin(request: Request, allowed: string | undefined): boolean {
	if (!allowed || !allowed.trim()) return true; // unset = allow all (dev)
	const origin = request.headers.get('origin');
	if (!origin) return false;
	const list = allowed.split(',').map((s) => s.trim()).filter(Boolean);
	return list.includes(origin);
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	const endpoint = env?.AZURE_DOC_INTEL_ENDPOINT?.trim().replace(/\/+$/, '');
	const key = env?.AZURE_DOC_INTEL_KEY?.trim();
	const model = env?.AZURE_DOC_INTEL_MODEL?.trim() || DEFAULT_MODEL;
	const apiVersion = env?.AZURE_DOC_INTEL_API_VERSION?.trim() || DEFAULT_API_VERSION;

	if (!endpoint || !key) {
		throw error(503, 'Receipt OCR is not configured on this deployment.');
	}

	if (!checkOrigin(request, env?.ALLOWED_ORIGINS)) {
		throw error(403, 'Origin not allowed.');
	}

	const contentType = request.headers.get('content-type') || 'application/octet-stream';
	if (!contentType.startsWith('image/')) {
		throw error(415, 'Body must be an image (image/jpeg, image/png, …).');
	}

	const body = await request.arrayBuffer();
	if (body.byteLength === 0) throw error(400, 'Empty request body.');
	if (body.byteLength > MAX_BODY_BYTES) {
		throw error(413, `Image is too large (${body.byteLength} bytes; max ${MAX_BODY_BYTES}).`);
	}

	// Start analyze.
	const startUrl = `${endpoint}/documentintelligence/documentModels/${encodeURIComponent(model)}:analyze?api-version=${encodeURIComponent(apiVersion)}`;
	const startRes = await fetch(startUrl, {
		method: 'POST',
		headers: {
			'Ocp-Apim-Subscription-Key': key,
			'Content-Type': contentType
		},
		body
	});
	if (!startRes.ok) {
		const detail = await startRes.text().catch(() => '');
		throw error(502, `Azure analyze start failed: ${startRes.status} ${startRes.statusText}. ${detail.slice(0, 200)}`);
	}
	const operationLocation = startRes.headers.get('operation-location');
	if (!operationLocation) {
		throw error(502, 'Azure response missing operation-location header.');
	}

	// Poll.
	const startedAt = Date.now();
	let poll: AzureAnalyzePoll | null = null;
	while (Date.now() - startedAt < MAX_POLL_MS) {
		const pollRes = await fetch(operationLocation, {
			headers: { 'Ocp-Apim-Subscription-Key': key }
		});
		if (!pollRes.ok) {
			const detail = await pollRes.text().catch(() => '');
			throw error(502, `Azure poll failed: ${pollRes.status} ${pollRes.statusText}. ${detail.slice(0, 200)}`);
		}
		poll = (await pollRes.json()) as AzureAnalyzePoll;
		if (poll.status === 'succeeded') break;
		if (poll.status === 'failed' || poll.status === 'canceled') {
			throw error(502, `Azure analyze ${poll.status}: ${poll.error?.message ?? '(no detail)'}`);
		}
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}
	if (!poll || poll.status !== 'succeeded') {
		throw error(504, 'Azure analyze timed out after 30 seconds.');
	}

	// Parse fields we care about.
	const doc = poll.analyzeResult?.documents?.[0];
	const f = doc?.fields ?? {};
	const totalField = f.Total ?? f.total;
	let total: number | undefined;
	let currency: string | undefined;
	if (totalField) {
		if (totalField.valueCurrency) {
			total = totalField.valueCurrency.amount;
			currency = totalField.valueCurrency.currencyCode;
		} else if (typeof totalField.valueNumber === 'number') {
			total = totalField.valueNumber;
		}
	}
	const merchantField = f.MerchantName ?? f.merchantName;
	const merchant = (merchantField?.valueString || merchantField?.content)?.trim();
	const dateField = f.TransactionDate ?? f.transactionDate;
	const date = dateField?.valueDate;

	return json({
		merchant: merchant || undefined,
		total: typeof total === 'number' && total > 0 ? total : undefined,
		date,
		currency,
		confidence: doc?.confidence
	});
};
