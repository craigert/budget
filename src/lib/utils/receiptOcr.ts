import { getAzureConfig, type AzureDocIntelConfig } from '$lib/db/azure';

export interface ReceiptScanResult {
	merchant?: string;
	total?: number; // dollars (largest numeric extracted)
	date?: string; // YYYY-MM-DD
	currency?: string;
	confidence?: number; // 0–1 from Azure on the top-level fields
	rawText?: string;
}

interface AzureAnalyzeStart {
	operationLocation: string;
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

interface AzureField {
	type: string;
	content?: string;
	valueString?: string;
	valueNumber?: number;
	valueCurrency?: { amount: number; currencyCode?: string };
	valueDate?: string;
	confidence?: number;
}

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_MS = 30_000;

/**
 * Run a receipt image through Azure Document Intelligence's prebuilt-receipt
 * model and return the extracted fields we care about. Throws if no config
 * is set or if the call errors.
 *
 * NOTE: This call goes directly from the browser to Azure. The Azure resource
 * MUST allow the app origin in CORS, or the request will fail. For production
 * you almost certainly want a server-side proxy.
 */
export async function scanReceiptWithAzure(blob: Blob): Promise<ReceiptScanResult> {
	const cfg = await getAzureConfig();
	if (!cfg) {
		throw new Error('Azure Document Intelligence is not configured. Open Settings to add a key.');
	}
	const operationLocation = await startAnalyze(cfg, blob);
	const result = await pollAnalyze(cfg.key, operationLocation);
	return parseResult(result);
}

async function startAnalyze(cfg: AzureDocIntelConfig, blob: Blob): Promise<string> {
	const url = `${cfg.endpoint}/documentintelligence/documentModels/${encodeURIComponent(cfg.model)}:analyze?api-version=${encodeURIComponent(cfg.apiVersion)}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Ocp-Apim-Subscription-Key': cfg.key,
			'Content-Type': blob.type || 'image/jpeg'
		},
		body: blob
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`Azure analyze start failed: ${res.status} ${res.statusText}. ${body.slice(0, 200)}`);
	}
	const opLoc = res.headers.get('operation-location');
	if (!opLoc) throw new Error('Azure response missing operation-location header.');
	return opLoc;
}

async function pollAnalyze(key: string, operationLocation: string): Promise<AzureAnalyzePoll> {
	const start = Date.now();
	while (Date.now() - start < MAX_POLL_MS) {
		const res = await fetch(operationLocation, {
			headers: { 'Ocp-Apim-Subscription-Key': key }
		});
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			throw new Error(`Azure poll failed: ${res.status} ${res.statusText}. ${body.slice(0, 200)}`);
		}
		const json = (await res.json()) as AzureAnalyzePoll;
		if (json.status === 'succeeded') return json;
		if (json.status === 'failed' || json.status === 'canceled') {
			throw new Error(`Azure analyze ${json.status}: ${json.error?.message ?? '(no detail)'}`);
		}
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}
	throw new Error('Azure analyze timed out after 30 seconds.');
}

function parseResult(result: AzureAnalyzePoll): ReceiptScanResult {
	const doc = result.analyzeResult?.documents?.[0];
	if (!doc) return { rawText: result.analyzeResult?.content };
	const f = doc.fields ?? {};

	let total: number | undefined;
	let currency: string | undefined;
	const totalField = f.Total ?? f.total;
	if (totalField) {
		if (totalField.valueCurrency) {
			total = totalField.valueCurrency.amount;
			currency = totalField.valueCurrency.currencyCode;
		} else if (typeof totalField.valueNumber === 'number') {
			total = totalField.valueNumber;
		}
	}

	const merchantField = f.MerchantName ?? f.merchantName;
	const merchant = merchantField?.valueString || merchantField?.content;

	const dateField = f.TransactionDate ?? f.transactionDate;
	const date = dateField?.valueDate; // already ISO YYYY-MM-DD per Azure

	return {
		merchant: merchant?.trim() || undefined,
		total: typeof total === 'number' && total > 0 ? total : undefined,
		date,
		currency,
		confidence: doc.confidence,
		rawText: result.analyzeResult?.content
	};
}
