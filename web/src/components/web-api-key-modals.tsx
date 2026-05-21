import {
	ApiKeyStartupModal,
	ApiKeyManageModal,
	type Provider,
} from "@app-icon-maker/ui";
import { setApiKey, getApiKey, hasApiKey } from "../lib/api-key-manager";

export function WebApiKeyModal({
	defaultProvider,
	onClose,
}: {
	defaultProvider: Provider;
	onClose: (savedProvider?: Provider) => void;
}) {
	const hasAny = ["openai", "gemini", "openrouter", "fal" as Provider].some(
		(p) => hasApiKey(p),
	);

	async function persistKey(
		provider: Provider,
		key: string,
	): Promise<string | null> {
		const trimmed = key.trim();
		if (!trimmed) return "Enter your API key.";
		setApiKey(provider, trimmed);
		return null;
	}

	async function loadKey(provider: Provider): Promise<string> {
		return getApiKey(provider) ?? "";
	}

	function openExternalUrl(url: string) {
		window.open(url, "_blank", "noopener,noreferrer");
	}

	if (!hasAny) {
		return (
			<ApiKeyStartupModal
				defaultProvider={defaultProvider}
				onPersistKey={persistKey}
				onOpenExternalUrl={openExternalUrl}
				onClose={(saved, provider) => {
					if (saved && provider) onClose(provider);
					else onClose();
				}}
			/>
		);
	}

	return (
		<ApiKeyManageModal
			defaultProvider={defaultProvider}
			reason="settings"
			onPersistKey={persistKey}
			onLoadKey={loadKey}
			onOpenExternalUrl={openExternalUrl}
			onClose={(saved, provider) => {
				if (saved && provider) onClose(provider);
				else onClose();
			}}
		/>
	);
}
