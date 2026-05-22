import { invoke } from "@tauri-apps/api/core";
import {
  ApiKeyStartupModal,
  ApiKeyManageModal,
  type Provider,
} from "@app-icon-maker/ui";

export type OpenAIApiKeyManageReason = "settings" | "authError";

const CMD_MAP: Record<Provider, { get: string; set: string }> = {
  openai: { get: "get_stored_openai_api_key", set: "set_openai_api_key" },
  gemini: { get: "get_stored_gemini_api_key", set: "set_gemini_api_key" },
  fal: { get: "get_stored_fal_api_key", set: "set_fal_api_key" },
  openrouter: {
    get: "get_stored_openrouter_api_key",
    set: "set_openrouter_api_key",
  },
};

async function persistKey(
  provider: Provider,
  key: string,
): Promise<string | null> {
  const trimmed = key.trim();
  if (!trimmed) return "Enter your API key.";
  try {
    await invoke(CMD_MAP[provider].set, { apiKey: trimmed });
    return null;
  } catch {
    return "Could not save the API key. Try again.";
  }
}

async function loadKey(provider: Provider): Promise<string> {
  const r = await invoke<{ api_key: string }>(CMD_MAP[provider].get);
  return r.api_key ?? "";
}

function openExternalUrl(url: string) {
  invoke("open_external_url", { url }).catch(() => {});
}

// ── Desktop wrappers ───────────────────────────────────────────────────────

export function OpenAIApiKeyStartupModal({
  onSaved,
}: {
  onSaved: (provider: Provider) => void;
}) {
  return (
    <ApiKeyStartupModal
      defaultProvider="openai"
      onPersistKey={persistKey}
      onOpenExternalUrl={openExternalUrl}
      onClose={(saved, provider) => {
        if (saved && provider) onSaved(provider);
      }}
    />
  );
}

export function OpenAIApiKeyManageModal({
  reason,
  defaultProvider,
  onClose,
}: {
  reason: OpenAIApiKeyManageReason;
  defaultProvider?: Provider;
  onClose: (saved: boolean, provider?: Provider) => void;
}) {
  return (
    <ApiKeyManageModal
      defaultProvider={defaultProvider}
      reason={reason}
      onPersistKey={persistKey}
      onLoadKey={loadKey}
      onOpenExternalUrl={openExternalUrl}
      onClose={onClose}
    />
  );
}
