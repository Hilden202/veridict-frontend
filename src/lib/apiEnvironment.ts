export type ApiEnvironmentMode = "local" | "production";

export type ApiEnvironmentConfig = {
	mode: ApiEnvironmentMode;
	apiBaseUrl: string;
	publicCatalogUrl: string;
	label: string;
	tone: "local" | "production";
};

const STORAGE_KEY = "veridict:review-api-environment";
const LOCAL_API_FALLBACK = "http://localhost:5293";
const LOCAL_FRONTEND_FALLBACK = "http://localhost:5173";
const PRODUCTION_API_FALLBACK = "https://veridict-53fa.onrender.com";
const PRODUCTION_FRONTEND_FALLBACK = "https://veridict.hildenmedia.se";

const env = import.meta.env as Record<string, string | undefined>;

export function getStoredApiEnvironmentMode(): ApiEnvironmentMode {
	if (!hasBrowserStorage()) {
		return "production";
	}

	return normalizeMode(localStorage.getItem(STORAGE_KEY)) ?? getPublicFrontendEnvironmentMode();
}

export function setStoredApiEnvironmentMode(mode: ApiEnvironmentMode) {
	if (hasBrowserStorage()) {
		localStorage.setItem(STORAGE_KEY, mode);
	}
}

export function getPublicFrontendEnvironmentMode(): ApiEnvironmentMode {
	if (typeof window === "undefined") {
		return "production";
	}

	return isLocalFrontendHost(window.location.hostname) ? "local" : "production";
}

export function getApiEnvironmentConfig(mode: ApiEnvironmentMode): ApiEnvironmentConfig {
	if (mode === "local") {
		return {
			mode,
			apiBaseUrl: stripTrailingSlash(
				env.PUBLIC_LOCAL_API_BASE_URL ||
					env.VITE_LOCAL_API_BASE_URL ||
					env.VITE_API_LOCAL_BASE_URL ||
					LOCAL_API_FALLBACK,
			),
			publicCatalogUrl: stripTrailingSlash(
				env.PUBLIC_LOCAL_FRONTEND_URL || env.VITE_LOCAL_FRONTEND_URL || LOCAL_FRONTEND_FALLBACK,
			),
			label: "LOKAL MILJÖ",
			tone: "local",
		};
	}

	return {
		mode,
		apiBaseUrl: stripTrailingSlash(
			env.PUBLIC_API_BASE_URL || env.VITE_API_BASE_URL || PRODUCTION_API_FALLBACK,
		),
		publicCatalogUrl: stripTrailingSlash(
			env.PUBLIC_PRODUCTION_FRONTEND_URL ||
				env.VITE_PRODUCTION_FRONTEND_URL ||
				PRODUCTION_FRONTEND_FALLBACK,
		),
		label: "PUBLICERAD MILJÖ",
		tone: "production",
	};
}

export function getReviewApiToken() {
	return env.PUBLIC_REVIEW_API_TOKEN || env.VITE_REVIEW_API_TOKEN || "";
}

export function isInternalReviewEnabledForCurrentBrowser() {
	if (env.PUBLIC_ENABLE_INTERNAL_REVIEW === "true" || env.VITE_ENABLE_INTERNAL_REVIEW === "true") {
		return true;
	}

	if (getReviewApiToken()) {
		return true;
	}

	if (import.meta.env.DEV) {
		return true;
	}

	if (typeof window === "undefined") {
		return false;
	}

	return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function isLocalFrontendRuntime() {
	if (import.meta.env.DEV) {
		return true;
	}

	if (typeof window === "undefined") {
		return false;
	}

	return isLocalFrontendHost(window.location.hostname);
}

export function resolveScreenshotUrl(reference: string, environment: ApiEnvironmentConfig) {
	if (!reference.trim()) {
		return "";
	}

	if (/^(https?:|data:|blob:)/i.test(reference)) {
		return reference;
	}

	if (reference.startsWith("/storage/")) {
		return `${environment.apiBaseUrl}${reference}`;
	}

	if (reference.startsWith("storage/")) {
		return `${environment.apiBaseUrl}/${reference}`;
	}

	if (reference.startsWith("/screenshots/")) {
		return `${environment.publicCatalogUrl}${reference}`;
	}

	if (reference.startsWith("screenshots/")) {
		return `${environment.publicCatalogUrl}/${reference}`;
	}

	return `${environment.apiBaseUrl}/${reference}`;
}

function normalizeMode(value: string | null | undefined): ApiEnvironmentMode | null {
	if (value === "local" || value === "production") {
		return value;
	}

	return null;
}

function stripTrailingSlash(value: string) {
	return value.replace(/\/+$/, "");
}

function hasBrowserStorage() {
	return typeof localStorage !== "undefined";
}

function isLocalFrontendHost(hostname: string) {
	return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

