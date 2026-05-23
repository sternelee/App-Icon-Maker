const STORAGE_KEYS: Record<string, string> = {
  openai: "app-icon-maker:api-key:openai",
  gemini: "app-icon-maker:api-key:gemini",
  openrouter: "app-icon-maker:api-key:openrouter",
  fal: "app-icon-maker:api-key:fal",
  stepfun: "app-icon-maker:api-key:stepfun",
};

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
