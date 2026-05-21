// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
/// <reference types="vite-plugin-pwa/svelte" />

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				AZURE_DOC_INTEL_ENDPOINT?: string;
				AZURE_DOC_INTEL_KEY?: string;
				AZURE_DOC_INTEL_MODEL?: string;
				AZURE_DOC_INTEL_API_VERSION?: string;
				ALLOWED_ORIGINS?: string;
			};
		}
	}
}

export {};
