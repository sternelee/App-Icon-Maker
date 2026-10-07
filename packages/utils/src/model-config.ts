import type { Provider } from "./api-key-config";

export const MODEL_LIST: Record<Provider, { value: string; label: string }[]> =
  {
    openai: [
      { value: "gpt-image-1", label: "gpt-image-1" },
      { value: "gpt-image-2", label: "gpt-image-2" },
    ],
    gemini: [
      { value: "gemini-2.5-flash-image", label: "Nano Banana" },
      { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro" },
      { value: "gemini-3.1-flash-image-preview", label: "Nano Banana 2" },
    ],
    openrouter: [
      { value: "openai/gpt-5-image", label: "gpt-image-1" },
      { value: "openai/gpt-5.4-image-2", label: "gpt-image-2" },
      { value: "openai/gpt-5-image-mini", label: "gpt-image-1-mini" },
      { value: "google/gemini-2.5-flash-image", label: "Nano Banana" },
      { value: "google/gemini-3-pro-image-preview", label: "Nano Banana Pro" },
      {
        value: "google/gemini-3.1-flash-image-preview",
        label: "Nano Banana 2",
      },
    ],
    fal: [
      { value: "fal-ai/nano-banana-2/edit", label: "Nano Banana 2" },
      { value: "fal-ai/nano-banana-pro/edit", label: "Nano Banana Pro" },
      { value: "fal-ai/nano-banana/edit", label: "Nano Banana" },
      { value: "openai/gpt-image-2/edit", label: "gpt-image-2" },
      { value: "openai/gpt-image-1.5/edit", label: "gpt-image-1.5" },
      { value: "fal-ai/flux-2-pro/edit", label: "Flux 2 Pro" },
      { value: "fal-ai/flux-pro/kontext", label: "Flux Pro Kontext" },
      {
        value: "fal-ai/bytedance/seedream/v5/lite/edit",
        label: "Seedream v5 Lite",
      },
      { value: "fal-ai/bytedance/seedream/v4.5/edit", label: "Seedream v4.5" },
      {
        value: "fal-ai/gemini-3-pro-image-preview/edit",
        label: "Nano Banana Pro (Gemini)",
      },
      {
        value: "fal-ai/gemini-25-flash-image/edit",
        label: "Nano Banana (Gemini)",
      },
      { value: "fal-ai/qwen-image-edit-2511", label: "Qwen Image Edit" },
    ],
    stepfun: [
      { value: "step-image-edit-2", label: "step-image-edit-2" },
      { value: "step-2x-large", label: "step-2x-large" },
      { value: "step-1x-medium", label: "step-1x-medium" },
    ],
    agnes: [
      { value: "agnes-image-2.5-flash", label: "Agnes Image 2.5 Flash" },
      { value: "agnes-image-2.1-flash", label: "Agnes Image 2.1 Flash" },
      { value: "agnes-image-2.0-flash", label: "Agnes Image 2.0 Flash" },
    ],
    xai: [
      {
        value: "grok-imagine-image-quality",
        label: "Grok Imagine (quality)",
      },
    ],
    replicate: [
      {
        value: "black-forest-labs/flux-schnell",
        label: "FLUX.1 Schnell",
      },
      {
        value: "black-forest-labs/flux-dev",
        label: "FLUX.1 Dev",
      },
      {
        value: "black-forest-labs/flux-1.1-pro",
        label: "FLUX.1.1 Pro",
      },
      {
        value: "stability-ai/stable-diffusion-3.5-large",
        label: "SD 3.5 Large",
      },
      {
        value: "bytedance/seedream-3",
        label: "Seedream 3",
      },
      {
        value: "google/imagen-4-fast",
        label: "Imagen 4 Fast",
      },
    ],
    ideogram: [
      { value: "V_2", label: "Ideogram v2" },
      { value: "V_2_TURBO", label: "Ideogram v2 Turbo" },
      { value: "V_3", label: "Ideogram v3" },
      { value: "V_3_DEFAULT", label: "Ideogram v3 Default" },
    ],
  };

export function getDefaultModel(provider: Provider): string {
  const list = MODEL_LIST[provider];
  return list && list.length > 0 ? list[0].value : "gpt-image-1";
}
