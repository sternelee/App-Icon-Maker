import type { APIRoute } from "astro";

interface GenerateRequest {
  prompt: string;
  model: string;
  provider: string;
  referenceImage?: string;
  apiKey: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: GenerateRequest = await request.json();
    const { prompt, model, provider, referenceImage, apiKey } = body;

    if (!apiKey) {
      return new Response(JSON.stringify({ images: [], error: "API key is required" }), { status: 400 });
    }

    const systemPrefix = "Premium macOS app icon artwork, centered composition, single object only, no text, no letters, no UI mockup, clean cohesive background, object fills the square canvas naturally,";

    switch (provider) {
      case "openai": {
        const url = referenceImage
          ? "https://api.openai.com/v1/images/edits"
          : "https://api.openai.com/v1/images/generations";

        const formData = new FormData();
        if (referenceImage) {
          const imageBlob = b64toBlob(referenceImage);
          formData.append("image", imageBlob, "image.png");
          formData.append("prompt", `${systemPrefix} ${prompt}`);
        } else {
          formData.append("prompt", `${systemPrefix} ${prompt}`);
        }
        formData.append("model", model || "gpt-image-1");
        formData.append("n", "3");
        formData.append("size", "1024x1024");
        formData.append("response_format", "b64_json");

        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.text();
          return new Response(JSON.stringify({ images: [], error: err }));
        }

        const data = await res.json();
        const images = data.data.map((item: any) => item.b64_json);
        return new Response(JSON.stringify({ images }));
      }

      case "gemini": {
        const contents: any[] = [
          {
            parts: [{ text: `${systemPrefix} ${prompt}` }],
            role: "user",
          },
        ];

        if (referenceImage) {
          contents[0].parts.unshift({
            inline_data: { mime_type: "image/png", data: referenceImage },
          });
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-2.5-flash-image"}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
          },
        );

        if (!res.ok) {
          const err = await res.text();
          return new Response(JSON.stringify({ images: [], error: err }));
        }

        const data = await res.json();
        const images = data.candidates?.[0]?.content?.parts
          ?.filter((p: any) => p.inline_data)
          .map((p: any) => p.inline_data.data) || [];
        return new Response(JSON.stringify({ images }));
      }

      case "openrouter": {
        const messages: any[] = [
          {
            role: "user",
            content: [
              { type: "text", text: `${systemPrefix} ${prompt}` },
            ],
          },
        ];

        if (referenceImage) {
          messages[0].content.push({
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
            messages,
            n: 3,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          return new Response(JSON.stringify({ images: [], error: err }));
        }

        const data = await res.json();
        const images = data.choices?.map((c: any) => {
          const content = c.message?.content || "";
          const match = content.match(/data:image\/[^;]+;base64,([^"]+)/);
          return match ? match[1] : null;
        }).filter(Boolean) || [];
        return new Response(JSON.stringify({ images }));
      }

      case "fal": {
        const falUrl = referenceImage
          ? `https://queue.fal.run/${model || "fal-ai/nano-banana-2/edit"}`
          : `https://queue.fal.run/${model || "fal-ai/nano-banana-2/edit"}`;

        const body: Record<string, any> = {
          prompt: `${systemPrefix} ${prompt}`,
          num_images: 3,
          image_size: "1024x1024",
        };

        if (referenceImage) {
          body.image_url = `data:image/png;base64,${referenceImage}`;
        }

        const queueRes = await fetch(falUrl, {
          method: "POST",
          headers: {
            Authorization: `Key ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!queueRes.ok) {
          const err = await queueRes.text();
          return new Response(JSON.stringify({ images: [], error: err }));
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
            const images = resultData.images?.map((img: any) => {
              const b64 = img.url?.split(",")[1] || img.url || "";
              return b64;
            }).filter(Boolean) || [];
            return new Response(JSON.stringify({ images }));
          }

          if (statusData.status === "FAILED") {
            return new Response(JSON.stringify({ images: [], error: statusData.error || "fal generation failed" }));
          }

          await new Promise((r) => setTimeout(r, 1000));
          attempts++;
        }

        return new Response(JSON.stringify({ images: [], error: "fal generation timed out" }));
      }

      default:
        return new Response(JSON.stringify({ images: [], error: `Unknown provider: ${provider}` }), { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ images: [], error: msg }), { status: 500 });
  }
};

function b64toBlob(b64: string): Blob {
  const byteChars = atob(b64);
  const byteArrays = [];
  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: "image/png" });
}
