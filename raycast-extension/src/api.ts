import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Provider } from "./config";
import { SYSTEM_PREFIX } from "./config";

function b64toBlob(b64: string): Blob {
  const byteChars = atob(b64);
  const byteArrays = [];
  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNums = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNums[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNums));
  }
  return new Blob(byteArrays, { type: "image/png" });
}

export interface GenerateOptions {
  provider: Provider;
  model: string;
  prompt: string;
  apiKey: string;
  numImages?: number;
  referenceImage?: string; // base64 string without data: prefix
}

export interface GenerateResult {
  images: string[]; // base64 strings
  error?: string;
}

export async function generateIcons(
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const {
    provider,
    model,
    prompt,
    apiKey,
    numImages = 3,
    referenceImage,
  } = opts;

  if (!apiKey) {
    return { images: [], error: "API key is required" };
  }

  switch (provider) {
    case "openai":
      return generateOpenAI(model, prompt, apiKey, numImages, referenceImage);
    case "gemini":
      return generateGemini(model, prompt, apiKey, numImages, referenceImage);
    case "openrouter":
      return generateOpenRouter(
        model,
        prompt,
        apiKey,
        numImages,
        referenceImage,
      );
    case "fal":
      return generateFal(model, prompt, apiKey, numImages, referenceImage);
    case "stepfun":
      return generateStepfun(model, prompt, apiKey, numImages, referenceImage);
    default:
      return { images: [], error: `Unknown provider: ${provider}` };
  }
}

async function generateOpenAI(
  model: string,
  prompt: string,
  apiKey: string,
  numImages: number,
  referenceImage?: string,
): Promise<GenerateResult> {
  const url = referenceImage
    ? "https://api.openai.com/v1/images/edits"
    : "https://api.openai.com/v1/images/generations";

  const formData = new FormData();
  if (referenceImage) {
    formData.append("image", b64toBlob(referenceImage), "image.png");
    formData.append("prompt", `${SYSTEM_PREFIX} ${prompt}`);
  } else {
    formData.append("prompt", `${SYSTEM_PREFIX} ${prompt}`);
  }
  formData.append("model", model || "gpt-image-1");
  formData.append("n", String(numImages));
  formData.append("size", "1024x1024");
  formData.append("response_format", "b64_json");

  const res = await fetch(url, {
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
  referenceImage?: string,
): Promise<GenerateResult> {
  const requests = Array.from({ length: numImages }).map(async () => {
    const parts: {
      text?: string;
      inline_data?: { mime_type: string; data: string };
    }[] = [{ text: `${SYSTEM_PREFIX} ${prompt}` }];

    if (referenceImage) {
      parts.unshift({
        inline_data: { mime_type: "image/png", data: referenceImage },
      });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-2.5-flash-image"}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts, role: "user" }],
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
  referenceImage?: string,
): Promise<GenerateResult> {
  const requests = Array.from({ length: numImages }).map(async () => {
    const content: {
      type: string;
      text?: string;
      image_url?: { url: string };
    }[] = [{ type: "text", text: `${SYSTEM_PREFIX} ${prompt}` }];

    if (referenceImage) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${referenceImage}` },
      });
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "openai/gpt-5-image",
        messages: [{ role: "user", content }],
        n: 1,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    const match = rawContent.match(/data:image\/[^;]+;base64,([^"]+)/);
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
  referenceImage?: string,
): Promise<GenerateResult> {
  const falModel = model || "fal-ai/nano-banana-2/edit";
  const body: Record<string, unknown> = {
    prompt: `${SYSTEM_PREFIX} ${prompt}`,
    num_images: numImages,
    image_size: "1024x1024",
  };

  if (referenceImage) {
    body.image_url = `data:image/png;base64,${referenceImage}`;
  }

  const queueRes = await fetch(`https://queue.fal.run/${falModel}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
  referenceImage?: string,
): Promise<GenerateResult> {
  const url = referenceImage
    ? "https://api.stepfun.com/v1/images/edits"
    : "https://api.stepfun.com/v1/images/generations";

  const requests = Array.from({ length: numImages }).map(async (_, i) => {
    if (referenceImage) {
      const formData = new FormData();
      formData.append("model", model || "step-image-edit-2");
      formData.append("image", b64toBlob(referenceImage), "image.png");
      formData.append("prompt", `${SYSTEM_PREFIX} ${prompt}`);
      formData.append("response_format", "b64_json");

      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const data = await res.json();
      return data.data?.[0]?.b64_json;
    } else {
      const res = await fetch(url, {
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
    }
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
