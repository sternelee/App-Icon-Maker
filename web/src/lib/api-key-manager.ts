export const WEB_PROVIDERS = [
  "openai",
  "gemini",
  "openrouter",
  "fal",
  "stepfun",
  "agnes",
  "xai",
  "replicate",
  "ideogram",
] as const;

const STORAGE_KEYS: Record<string, string> = Object.fromEntries(
  WEB_PROVIDERS.map((p) => [p, `app-icon-maker:api-key:${p}`]),
);

export function getApiKey(provider: string): string | null {
  return localStorage.getItem(STORAGE_KEYS[provider] || "");
}

export function setApiKey(provider: string, key: string): void {
  const storageKey = STORAGE_KEYS[provider];
  if (storageKey) {
    localStorage.setItem(storageKey, key);
  }
}

export function hasApiKey(provider: string): boolean {
  return !!getApiKey(provider);
}

export function clearApiKey(provider: string): void {
  const storageKey = STORAGE_KEYS[provider];
  if (storageKey) {
    localStorage.removeItem(storageKey);
  }
}
