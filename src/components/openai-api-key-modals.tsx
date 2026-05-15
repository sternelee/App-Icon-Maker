import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export type OpenAIApiKeyManageReason = "settings" | "authError";

export type Provider = "openai" | "gemini";

const PROVIDER_CONFIG: Record<
	Provider,
	{
		label: string;
		keyLabel: string;
		placeholder: string;
		helpUrl: string;
		getKeyCmd: string;
		setKeyCmd: string;
	}
> = {
	openai: {
		label: "OpenAI",
		keyLabel: "OpenAI API key",
		placeholder: "sk-…",
		helpUrl: "https://platform.openai.com/api-keys",
		getKeyCmd: "get_stored_openai_api_key",
		setKeyCmd: "set_openai_api_key",
	},
	gemini: {
		label: "Google Gemini",
		keyLabel: "Gemini API key",
		placeholder: "AIza…",
		helpUrl: "https://aistudio.google.com/app/apikey",
		getKeyCmd: "get_stored_gemini_api_key",
		setKeyCmd: "set_gemini_api_key",
	},
};

function openExternalUrl(url: string) {
	invoke("open_external_url", { url }).catch(() => {});
}

async function persistKey(
	provider: Provider,
	key: string,
): Promise<string | null> {
	const trimmed = key.trim();
	if (!trimmed) return "Enter your API key.";
	try {
		await invoke(PROVIDER_CONFIG[provider].setKeyCmd, { apiKey: trimmed });
		return null;
	} catch {
		return "Could not save the API key. Try again.";
	}
}

/** Provider toggle for use inside modals. */
function ProviderToggle({
	provider,
	onChange,
	disabled,
}: {
	provider: Provider;
	onChange: (p: Provider) => void;
	disabled?: boolean;
}) {
	return (
		<div className="flex items-center gap-1 rounded-full border border-border bg-secondary/30 p-0.5 w-fit">
			{(["openai", "gemini"] as Provider[]).map((p) => (
				<button
					key={p}
					type="button"
					onClick={() => onChange(p)}
					disabled={disabled}
					className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
						provider === p
							? "bg-primary text-primary-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground"
					} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
				>
					{PROVIDER_CONFIG[p].label}
				</button>
			))}
		</div>
	);
}

// ── Shared API key form (used by both modals) ──────────────────────────────

function ApiKeyForm({
	provider,
	error,
	busy,
	value,
	onChange,
	onKeyDown,
	description,
}: {
	provider: Provider;
	error: string | null;
	busy: boolean;
	value: string;
	onChange: (v: string) => void;
	onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
	description: React.ReactNode;
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
		</div>
	);
}

// ── Startup modal ──────────────────────────────────────────────────────────

export function OpenAIApiKeyStartupModal({
	onSaved,
}: {
	onSaved: (provider: Provider) => void;
}) {
	const [provider, setProvider] = useState<Provider>("openai");
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
		const errMsg = await persistKey(provider, key);
		setBusy(false);
		if (errMsg) {
			setError(
				errMsg === "API key cannot be empty." ? "Enter your API key." : errMsg,
			);
		} else {
			onSaved(provider);
		}
	}, [value, provider, onSaved]);

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
					<ProviderToggle provider={provider} onChange={setProvider} />
				</div>

				<ApiKeyForm
					provider={provider}
					error={error}
					busy={busy}
					value={value}
					onChange={setValue}
					onKeyDown={onKeyDown}
					description={
						provider === "openai"
							? `Icon generation uses OpenAI. Paste a key below; it is stored only in this app's preferences on your computer.`
							: `Icon generation uses Google Gemini. Paste a key below; it is stored only in this app's preferences on your computer.`
					}
				/>

				<div className="flex items-center justify-between gap-3 px-4 pb-4">
					<button
						type="button"
						onClick={() => openExternalUrl(PROVIDER_CONFIG[provider].helpUrl)}
						className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary transition-colors shrink-0"
						aria-label={`Open ${PROVIDER_CONFIG[provider].label} API keys in your browser`}
					>
						<ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
						Get API Key
					</button>
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

export function OpenAIApiKeyManageModal({
	reason,
	defaultProvider,
	onClose,
}: {
	reason: OpenAIApiKeyManageReason;
	defaultProvider?: Provider;
	onClose: (saved: boolean, provider?: Provider) => void;
}) {
	const [provider, setProvider] = useState<Provider>(
		defaultProvider ?? "openai",
	);
	const [value, setValue] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	// Load stored key when provider changes
	useEffect(() => {
		invoke<{ api_key: string }>(PROVIDER_CONFIG[provider].getKeyCmd)
			.then((r) => setValue(r.api_key ?? ""))
			.catch(() => setValue(""));
	}, [provider]);

	const submit = useCallback(async () => {
		const key = value.trim();
		if (!key) {
			setError("Enter your API key.");
			return;
		}
		setBusy(true);
		setError(null);
		const errMsg = await persistKey(provider, key);
		setBusy(false);
		if (errMsg) {
			setError(
				errMsg === "API key cannot be empty." ? "Enter your API key." : errMsg,
			);
		} else {
			onClose(true, provider);
		}
	}, [value, provider, onClose]);

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
				the one saved in this app&apos;s preferences.
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
					<ProviderToggle provider={provider} onChange={setProvider} />
				</div>

				<ApiKeyForm
					provider={provider}
					error={error}
					busy={busy}
					value={value}
					onChange={setValue}
					onKeyDown={onKeyDown}
					description={description}
				/>

				<div className="flex items-center justify-between gap-3 px-4 pb-4">
					<button
						type="button"
						onClick={() => openExternalUrl(PROVIDER_CONFIG[provider].helpUrl)}
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
