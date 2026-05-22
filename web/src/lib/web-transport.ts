import type { Transport } from "@app-icon-maker/utils";

export function createWebTransport(
  getApiKey: (provider: string) => string | null,
): Transport {
  return {
    async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
      if (cmd === "generate_icon") {
        const { prompt, model, provider, referenceImage } = args as {
          prompt: string;
          model: string;
          provider: string;
          referenceImage?: string;
        };
        const apiKey = getApiKey(provider);
        if (!apiKey) {
          return {
            images: [],
            error: `API key not configured for ${provider}`,
          } as T;
        }
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            model,
            provider,
            referenceImage: referenceImage || "",
            apiKey,
          }),
        });
        if (!response.ok) {
          const text = await response.text();
          return { images: [], error: text } as T;
        }
        return response.json() as T;
      }
      throw new Error(`Unknown command: ${cmd}`);
    },
  };
}
