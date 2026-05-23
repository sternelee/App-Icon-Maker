import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { ExternalLink } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { type Provider, PROVIDER_CONFIG } from "@app-icon-maker/utils";

export type { Provider } from "@app-icon-maker/utils";

export interface ApiKeyModalBaseProps {
  defaultProvider?: Provider;
  onPersistKey: (provider: Provider, key: string) => Promise<string | null>;
  onOpenExternalUrl: (url: string) => void;
  onClose: (saved: boolean, provider?: Provider) => void;
}

function ProviderSelect({
  provider,
  onChange,
  disabled,
}: {
  provider: Provider;
  onChange: (p: Provider) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={provider}
      onValueChange={(v) => v && onChange(v as Provider)}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 text-xs w-[150px]">
        <SelectValue placeholder="Select provider">
          {(v: any) => PROVIDER_CONFIG[v as Provider]?.label || v}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(["openai", "gemini", "openrouter", "fal", "stepfun"] as Provider[]).map((p) => (
          <SelectItem key={p} value={p}>
            {PROVIDER_CONFIG[p].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ApiKeyForm({
  provider,
  error,
  busy,
  value,
  onChange,
  onKeyDown,
  description,
  showHelpButton = true,
  onOpenExternalUrl,
}: {
  provider: Provider;
  error: string | null;
  busy: boolean;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  description: React.ReactNode;
  showHelpButton?: boolean;
  onOpenExternalUrl?: (url: string) => void;
}) {
  return (
    <div className="px-4 py-3 space-y-2">
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
        {description}
      </p>
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={PROVIDER_CONFIG[provider].placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={busy}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs h-9"
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {showHelpButton && onOpenExternalUrl && (
        <button
          type="button"
          onClick={() => onOpenExternalUrl(PROVIDER_CONFIG[provider].helpUrl)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
          aria-label={`Open ${PROVIDER_CONFIG[provider].label} API keys in your browser`}
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Get API Key
        </button>
      )}
    </div>
  );
}

// ── Startup modal ──────────────────────────────────────────────────────────

export function ApiKeyStartupModal({
  defaultProvider,
  onPersistKey,
  onOpenExternalUrl,
  onClose,
}: ApiKeyModalBaseProps) {
  const [provider, setProvider] = useState<Provider>(
    defaultProvider ?? "openai",
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    const key = value.trim();
    if (!key) {
      setError("Enter your API key.");
      return;
    }
    setBusy(true);
    setError(null);
    const errMsg = await onPersistKey(provider, key);
    setBusy(false);
    if (errMsg) {
      setError(
        errMsg === "API key cannot be empty." ? "Enter your API key." : errMsg,
      );
    } else {
      onClose(true, provider);
    }
  }, [value, provider, onPersistKey, onClose]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-startup-title"
    >
      <div className="relative w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
          <h2
            id="api-key-startup-title"
            className="font-medium text-foreground text-sm"
          >
            Add API key
          </h2>
          <ProviderSelect provider={provider} onChange={setProvider} />
        </div>

        <ApiKeyForm
          provider={provider}
          error={error}
          busy={busy}
          value={value}
          onChange={setValue}
          onKeyDown={onKeyDown}
          description={`Paste your ${PROVIDER_CONFIG[provider].keyLabel} below; it is stored only locally on your device.`}
          onOpenExternalUrl={onOpenExternalUrl}
        />

        <div className="flex items-center justify-end gap-3 px-4 pb-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="h-8 px-4 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manage modal ───────────────────────────────────────────────────────────

export interface ApiKeyManageModalProps extends ApiKeyModalBaseProps {
  reason?: "authError" | "settings";
  onLoadKey?: (provider: Provider) => Promise<string>;
}

export function ApiKeyManageModal({
  defaultProvider,
  reason,
  onPersistKey,
  onLoadKey,
  onOpenExternalUrl,
  onClose,
}: ApiKeyManageModalProps) {
  const [provider, setProvider] = useState<Provider>(
    defaultProvider ?? "openai",
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load stored key when provider changes
  useEffect(() => {
    if (onLoadKey) {
      onLoadKey(provider)
        .then((k) => setValue(k))
        .catch(() => setValue(""));
    } else {
      setValue("");
    }
  }, [provider, onLoadKey]);

  const submit = useCallback(async () => {
    const key = value.trim();
    if (!key) {
      setError("Enter your API key.");
      return;
    }
    setBusy(true);
    setError(null);
    const errMsg = await onPersistKey(provider, key);
    setBusy(false);
    if (errMsg) {
      setError(
        errMsg === "API key cannot be empty." ? "Enter your API key." : errMsg,
      );
    } else {
      onClose(true, provider);
    }
  }, [value, provider, onPersistKey, onClose]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  const description =
    reason === "authError" ? (
      <>
        {PROVIDER_CONFIG[provider].label} rejected the last request (often an
        invalid, expired, or mistyped key). Enter a valid key below; it replaces
        the one saved locally.
      </>
    ) : (
      <>
        Here&apos;s your {PROVIDER_CONFIG[provider].keyLabel}. Edit it and save
        to update it.
      </>
    );

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-manage-title"
    >
      <div className="relative w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
          <h2
            id="api-key-manage-title"
            className="font-medium text-foreground text-sm"
          >
            {reason === "authError" ? "Update API key" : "API key"}
          </h2>
          <ProviderSelect provider={provider} onChange={setProvider} />
        </div>

        <ApiKeyForm
          provider={provider}
          error={error}
          busy={busy}
          value={value}
          onChange={setValue}
          onKeyDown={onKeyDown}
          description={description}
          onOpenExternalUrl={onOpenExternalUrl}
        />

        <div className="flex items-center justify-between gap-3 px-4 pb-4">
          <button
            type="button"
            onClick={() => onOpenExternalUrl(PROVIDER_CONFIG[provider].helpUrl)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary transition-colors shrink-0"
            aria-label={`Open ${PROVIDER_CONFIG[provider].label} API keys in your browser`}
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
            Get API Key
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onClose(false, provider)}
              className="h-8 px-4 rounded-lg text-xs font-medium bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="h-8 px-4 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
