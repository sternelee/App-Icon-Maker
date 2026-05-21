export type Provider = "openai" | "gemini" | "openrouter" | "fal";

export const PROVIDER_CONFIG: Record<
	Provider,
	{
		label: string;
		keyLabel: string;
		placeholder: string;
		helpUrl: string;
	}
> = {
	openai: {
		label: "OpenAI",
		keyLabel: "OpenAI API key",
		placeholder: "sk-…",
		helpUrl: "https://platform.openai.com/api-keys",
	},
	gemini: {
		label: "Google Gemini",
		keyLabel: "Gemini API key",
		placeholder: "AIza…",
		helpUrl: "https://aistudio.google.com/app/apikey",
	},
	fal: {
		label: "Fal.ai",
		keyLabel: "fal.ai API key",
		placeholder: "…",
		helpUrl: "https://fal.ai/dashboard/api-keys",
	},
	openrouter: {
		label: "OpenRouter",
		keyLabel: "OpenRouter API key",
		placeholder: "sk-or-v1-…",
		helpUrl: "https://openrouter.ai/keys",
	},
};
