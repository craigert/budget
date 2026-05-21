/**
 * Azure Document Intelligence configuration.
 *
 * Configuration comes ONLY from build-time environment variables (see
 * .env.example):
 *
 *   VITE_AZURE_DOC_INTEL_ENDPOINT
 *   VITE_AZURE_DOC_INTEL_KEY
 *   VITE_AZURE_DOC_INTEL_MODEL        (default: prebuilt-receipt)
 *   VITE_AZURE_DOC_INTEL_API_VERSION  (default: 2024-11-30)
 *
 * ⚠ These ship inside the client JS bundle. Anyone running DevTools on the
 * deployed site can extract them. The Settings UI hides them, but that does
 * not make them secret. For a real multi-user product, route the Azure call
 * through a server-side proxy (Cloudflare Worker / Azure Function) that holds
 * the key as a secret and gates by user authentication.
 */

export interface AzureDocIntelConfig {
	endpoint: string;
	key: string;
	model: string;
	apiVersion: string;
}

export const AZURE_DEFAULTS: Pick<AzureDocIntelConfig, 'model' | 'apiVersion'> = {
	model: 'prebuilt-receipt',
	apiVersion: '2024-11-30'
};

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

export function isAzureConfigured(): boolean {
	return readEnvConfig() !== null;
}

export async function getAzureConfig(): Promise<AzureDocIntelConfig | null> {
	return readEnvConfig();
}
