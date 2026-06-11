export type Provider = "openai" | "gemini" | "openrouter" | "fal" | "stepfun" | "agnes";


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
  stepfun: {
    label: "Stepfun",
    keyLabel: "Stepfun API key",
    placeholder: "sk-…",
    helpUrl: "https://platform.stepfun.com/docs/zh/api-reference/quickstart",
  },
  agnes: {
    label: "Agnes",
    keyLabel: "Agnes API key",
    placeholder: "…",
    helpUrl: "https://agnes-ai.com/doc/agnes-image-21-flash",
  },
};
