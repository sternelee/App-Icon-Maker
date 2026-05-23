import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Provider } from "./config";
import { SYSTEM_PREFIX } from "./config";

export interface GenerateOptions {
  provider: Provider;
  model: string;
  prompt: string;
  apiKey: string;
  numImages?: number;
}

export interface GenerateResult {
  images: string[]; // base64 strings
  error?: string;
}

export async function generateIcons(
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const { provider, model, prompt, apiKey, numImages = 3 } = opts;

  if (!apiKey) {
    return { images: [], error: "API key is required" };
  }

  switch (provider) {
    case "openai":
      return generateOpenAI(model, prompt, apiKey, numImages);
    case "gemini":
      return generateGemini(model, prompt, apiKey, numImages);
    case "openrouter":
      return generateOpenRouter(model, prompt, apiKey, numImages);
    case "fal":
      return generateFal(model, prompt, apiKey, numImages);
    case "stepfun":
      return generateStepfun(model, prompt, apiKey, numImages);
    default:
      return { images: [], error: `Unknown provider: ${provider}` };
  }
}

async function generateOpenAI(
  model: string,
  prompt: string,
  apiKey: string,
  numImages: number,
): Promise<GenerateResult> {
  const formData = new FormData();
  formData.append("prompt", `${SYSTEM_PREFIX} ${prompt}`);
  formData.append("model", model || "gpt-image-1");
  formData.append("n", String(numImages));
  formData.append("size", "1024x1024");
  formData.append("response_format", "b64_json");

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    return { images: [], error: err };
  }

  const data = await res.json();
  const images = data.data
    .map((item: { b64_json?: string }) => item.b64_json)
    .filter(Boolean);
  return { images };
}

async function generateGemini(
  model: string,
  prompt: string,
  apiKey: string,
  numImages: number,
): Promise<GenerateResult> {
  // Gemini generates 1 image per request; parallelize
  const requests = Array.from({ length: numImages }).map(async () => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-2.5-flash-image"}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${SYSTEM_PREFIX} ${prompt}` }],
              role: "user",
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    const data = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find(
      (p: { inline_data?: { data?: string } }) => p.inline_data,
    );
    return part?.inline_data?.data;
  });

  try {
    const images = (await Promise.all(requests)).filter(Boolean);
    return { images };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { images: [], error: msg };
  }
}

async function generateOpenRouter(
  model: string,
  prompt: string,
  apiKey: string,
  numImages: number,
): Promise<GenerateResult> {
  const requests = Array.from({ length: numImages }).map(async () => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "openai/gpt-5-image",
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: `${SYSTEM_PREFIX} ${prompt}` }],
          },
        ],
        n: 1,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/data:image\/[^;]+;base64,([^"]+)/);
    return match ? match[1] : null;
  });

  try {
    const images = (await Promise.all(requests)).filter(Boolean);
    return { images };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { images: [], error: msg };
  }
}

async function generateFal(
  model: string,
  prompt: string,
  apiKey: string,
  numImages: number,
): Promise<GenerateResult> {
  const falModel = model || "fal-ai/nano-banana-2/edit";
  const queueRes = await fetch(`https://queue.fal.run/${falModel}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `${SYSTEM_PREFIX} ${prompt}`,
      num_images: numImages,
      image_size: "1024x1024",
    }),
  });

  if (!queueRes.ok) {
    const err = await queueRes.text();
    return { images: [], error: err };
  }

  const queueData = await queueRes.json();
  const statusUrl = queueData.status_url;

  let attempts = 0;
  const maxAttempts = 60;
  while (attempts < maxAttempts) {
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    const statusData = await statusRes.json();

    if (statusData.status === "COMPLETED") {
      const resultRes = await fetch(statusData.response_url, {
        headers: { Authorization: `Key ${apiKey}` },
      });
      const resultData = await resultRes.json();
      const images =
        resultData.images
          ?.map((img: { url?: string }) => {
            const b64 = img.url?.split(",")[1] || img.url || "";
            return b64;
          })
          .filter(Boolean) || [];
      return { images };
    }

    if (statusData.status === "FAILED") {
      return { images: [], error: statusData.error || "fal generation failed" };
    }

    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
  }

  return { images: [], error: "fal generation timed out" };
}

async function generateStepfun(
  model: string,
  prompt: string,
  apiKey: string,
  numImages: number,
): Promise<GenerateResult> {
  const requests = Array.from({ length: numImages }).map(async (_, i) => {
    const res = await fetch("https://api.stepfun.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "step-image-edit-2",
        prompt: `${SYSTEM_PREFIX} ${prompt}`,
        size: "1024x1024",
        n: 1,
        response_format: "b64_json",
        seed: Math.floor(Math.random() * 2147483647) + i,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    const data = await res.json();
    return data.data?.[0]?.b64_json;
  });

  try {
    const images = (await Promise.all(requests)).filter(Boolean);
    return { images };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { images: [], error: msg };
  }
}

export function getTempDir(): string {
  const dir = path.join(os.tmpdir(), "app-icon-maker-raycast");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function saveBase64Image(b64: string, filename: string): string {
  const dir = getTempDir();
  const filepath = path.join(dir, filename);
  const buffer = Buffer.from(b64, "base64");
  fs.writeFileSync(filepath, buffer);
  return filepath;
}
