import { db } from './index';

export interface AzureDocIntelConfig {
	endpoint: string; // e.g. "https://my-resource.cognitiveservices.azure.com"
	key: string;
	model: string; // e.g. "prebuilt-receipt"
	apiVersion: string; // e.g. "2024-11-30"
}

const KEYS = {
	endpoint: 'azure.docIntel.endpoint',
	key: 'azure.docIntel.key',
	model: 'azure.docIntel.model',
	apiVersion: 'azure.docIntel.apiVersion'
} as const;

export const AZURE_DEFAULTS: Pick<AzureDocIntelConfig, 'model' | 'apiVersion'> = {
	model: 'prebuilt-receipt',
	apiVersion: '2024-11-30'
};

/**
 * Build-time env config (see .env.example). When VITE_AZURE_DOC_INTEL_ENDPOINT
 * AND VITE_AZURE_DOC_INTEL_KEY are both set, the app uses these values and
 * the Settings UI hides its input fields.
 *
 * ⚠ These ship inside the client JS bundle. They are hidden from the Settings
 * UI, but anyone running DevTools on the deployed site can extract them. For
 * a real multi-user product, route the Azure call through a server-side proxy
 * (Cloudflare Worker / Azure Function) that holds the key as a secret.
 */
function readEnvConfig(): AzureDocIntelConfig | null {
	const env = import.meta.env as Record<string, string | undefined>;
	const endpoint = env.VITE_AZURE_DOC_INTEL_ENDPOINT?.trim();
	const key = env.VITE_AZURE_DOC_INTEL_KEY?.trim();
	if (!endpoint || !key) return null;
	return {
		endpoint: endpoint.replace(/\/+$/, ''),
		key,
		model: env.VITE_AZURE_DOC_INTEL_MODEL?.trim() || AZURE_DEFAULTS.model,
		apiVersion: env.VITE_AZURE_DOC_INTEL_API_VERSION?.trim() || AZURE_DEFAULTS.apiVersion
	};
}

/** True when a complete config was baked in via env vars at build time. */
export function isAzureConfiguredFromEnv(): boolean {
	return readEnvConfig() !== null;
}

export async function getAzureConfig(): Promise<AzureDocIntelConfig | null> {
	// Env vars take precedence so devs can override the user-stored config.
	const envCfg = readEnvConfig();
	if (envCfg) return envCfg;

	const [ep, key, model, apiVersion] = await Promise.all([
		db.settings.get(KEYS.endpoint),
		db.settings.get(KEYS.key),
		db.settings.get(KEYS.model),
		db.settings.get(KEYS.apiVersion)
	]);
	if (!ep?.value || !key?.value) return null;
	return {
		endpoint: String(ep.value).trim().replace(/\/+$/, ''),
		key: String(key.value).trim(),
		model: String(model?.value ?? AZURE_DEFAULTS.model),
		apiVersion: String(apiVersion?.value ?? AZURE_DEFAULTS.apiVersion)
	};
}

export async function saveAzureConfig(config: AzureDocIntelConfig): Promise<void> {
	await db.transaction('rw', db.settings, async () => {
		await db.settings.put({ key: KEYS.endpoint, value: config.endpoint.trim().replace(/\/+$/, '') });
		await db.settings.put({ key: KEYS.key, value: config.key.trim() });
		await db.settings.put({ key: KEYS.model, value: config.model.trim() || AZURE_DEFAULTS.model });
		await db.settings.put({ key: KEYS.apiVersion, value: config.apiVersion.trim() || AZURE_DEFAULTS.apiVersion });
	});
}

export async function clearAzureConfig(): Promise<void> {
	await db.settings.bulkDelete([KEYS.endpoint, KEYS.key, KEYS.model, KEYS.apiVersion]);
}

export interface AzureTestResult {
	ok: boolean;
	message: string;
}

/**
 * Lightweight reachability + auth check. Hits the service `info` endpoint
 * which returns 200 with the API key and 401 without — perfect for testing
 * configuration without consuming OCR quota.
 */
export async function testAzureConfig(config: AzureDocIntelConfig): Promise<AzureTestResult> {
	const url = `${config.endpoint.replace(/\/+$/, '')}/documentintelligence/info?api-version=${encodeURIComponent(config.apiVersion)}`;
	try {
		const res = await fetch(url, {
			method: 'GET',
			headers: { 'Ocp-Apim-Subscription-Key': config.key }
		});
		if (res.ok) return { ok: true, message: 'Connected. Authentication accepted.' };
		if (res.status === 401)
			return { ok: false, message: 'Authentication failed (401). Check that the key matches the endpoint.' };
		if (res.status === 403)
			return { ok: false, message: 'Forbidden (403). Key valid but this region/tier may not support the API.' };
		if (res.status === 404)
			return { ok: false, message: 'Endpoint or API version not found (404). Verify the resource URL and API version.' };
		const body = await res.text().catch(() => '');
		return { ok: false, message: `Azure returned ${res.status} ${res.statusText}. ${body.slice(0, 200)}` };
	} catch (e) {
		const msg = (e as Error).message;
		if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('cors'))
			return {
				ok: false,
				message:
					'Network/CORS error. The Azure endpoint must allow the app origin. Direct browser calls to Azure usually need a proxy (Functions / APIM / Worker).'
			};
		return { ok: false, message: `Network error: ${msg}` };
	}
}
