# Monorepo Restructure & Web Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) for syntax tracking.

**Goal:** Restructure app-icon-maker into pnpm monorepo with `packages/utils` and `packages/ui` shared packages, then build a web version with Astro + React + Cloudflare Workers.

**Architecture:** monorepo with `packages/utils` (pure TS types/hooks/utilities) and `packages/ui` (shared React components). Tauri desktop app imports both. Web version (Astro + React + Tailwind, deployed to CF Workers via `@astrojs/cloudflare`) also imports both, using Astro API routes to proxy AI provider requests.

**Tech Stack:** pnpm workspace, TypeScript, tsup (package builds), React 19, Tailwind CSS 4, Vite (Tauri), Astro 6, Cloudflare Workers

---

## File Structure

```
packages/utils/src/
  index.ts              — re-exports
  icon-types.ts         — move from src/lib/icon-types.ts
  squircle.ts           — move from src/lib/squircle.ts
  utils.ts              — move from src/lib/utils.ts
  icon-pipeline.ts      — refactored from src/lib/icon-pipeline.ts (Transport pattern)

packages/ui/src/
  index.ts              — re-exports all components
  components/
    macos-icon.tsx       — move from src/components/macos-icon.tsx
    prompt-input.tsx     — move from src/components/prompt-input.tsx
    variant-picker.tsx   — move from src/components/variant-picker.tsx
    icon-face.tsx        — move from src/components/icon-face.tsx
    icon-stack.tsx       — move from src/components/icon-stack.tsx
    single-refine-icon.tsx — move from src/components/single-refine-icon.tsx
    blueprint-face.tsx   — move from src/components/blueprint-face.tsx
    squircle-clip-defs.tsx — move from src/components/squircle-clip-defs.tsx
    error-modal.tsx      — move from src/components/error-modal.tsx
    save-success-modal.tsx — move from src/components/save-success-modal.tsx
    title-bar-status.tsx — move from src/components/title-bar-status.tsx
    theme-provider.tsx   — move from src/components/theme-provider.tsx
    ui/select.tsx        — move from src/components/ui/select.tsx

src-tauri/src/lib.rs    — unchanged (Rust backend stays as-is)

src/
  lib/
    tauri-transport.ts   — NEW: Transport implementation using Tauri IPC
  components/
    app-content.tsx      — MODIFY: import from @app-icon-maker/*
    openai-api-key-modals.tsx — MODIFY: import from @app-icon-maker/utils
  lib/
    icon-pipeline.ts     — REMOVE (moved to packages/utils)
    icon-types.ts        — REMOVE (moved to packages/utils)
    squircle.ts          — REMOVE (moved to packages/utils)
    utils.ts             — REMOVE (moved to packages/utils)

web/
  astro.config.mjs       — MODIFY: add react + cloudflare adapters
  package.json           — MODIFY: add deps
  src/
    pages/index.astro    — MODIFY: use React components
    pages/api/generate.ts — NEW: AI generation proxy
    pages/api/download.ts — NEW: image download proxy
    lib/
      web-transport.ts   — NEW: fetch-based Transport
      api-key-manager.ts — NEW: localStorage key management
    components/
      web-app-content.tsx — NEW: web-specific AppContent
    layouts/Layout.astro — MODIFY: add Tailwind CSS
    styles/global.css    — NEW: Tailwind CSS entry
```

---

### Task 1: Configure pnpm workspace

**Files:**
- Modify: `pnpm-workspace.yaml`

- [ ] **Update pnpm-workspace.yaml to include all packages**

```yaml
packages:
  - "packages/*"
  - "web"
```

- [ ] **Commit**

---

### Task 2: Create packages/utils scaffold

**Files:**
- Create: `packages/utils/package.json`
- Create: `packages/utils/tsconfig.json`
- Create: `packages/utils/tsup.config.ts`

- [ ] **Create package.json**

```json
{
  "name": "@app-icon-maker/utils",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.6.0"
  },
  "peerDependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "tsup": "^8.4.0",
    "typescript": "~5.8.3",
    "@types/react": "^19.1.8"
  }
}
```

- [ ] **Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Create tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
```

- [ ] **Create src/index.ts placeholder**

```typescript
export {};
```

- [ ] **Commit**

---

### Task 3: Create packages/ui scaffold

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/tsup.config.ts`

- [ ] **Create package.json**

```json
{
  "name": "@app-icon-maker/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.14.0",
    "tailwind-merge": "^3.6.0",
    "tailwindcss": "^4.3.0",
    "tailwindcss-animate": "^1.0.7"
  },
  "peerDependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "tsup": "^8.4.0",
    "typescript": "~5.8.3",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6"
  }
}
```

- [ ] **Create tsconfig.json** (same as packages/utils but with `jsx: "react-jsx"`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Create tsup.config.ts** (same format as utils)

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
```

- [ ] **Create src/index.ts placeholder**

```typescript
export {};
```

- [ ] **Commit**

---

### Task 4: Migrate utility modules to packages/utils

**Files:**
- Create: `packages/utils/src/icon-types.ts`
- Create: `packages/utils/src/squircle.ts`
- Create: `packages/utils/src/utils.ts`
- Create: `packages/utils/src/index.ts`

- [ ] **Copy and re-export icon-types.ts as-is (file has no internal deps)**

Read: `src/lib/icon-types.ts`
Create: `packages/utils/src/icon-types.ts` — same content

---

- [ ] **Copy squircle.ts as-is (file has no internal deps beyond React types for CSSProperties)**

Read: `src/lib/squircle.ts`
Create: `packages/utils/src/squircle.ts` — same content

---

- [ ] **Copy utils.ts as-is**

Read: `src/lib/utils.ts`
Create: `packages/utils/src/utils.ts` — same content

---

- [ ] **Wire up packages/utils/src/index.ts with all exports**

```typescript
export type { IconState } from "./icon-types";
export {
  SQUIRCLE_PATH_01,
  SQUIRCLE_PATH_100,
  BLUEPRINT_SQUICLE_D,
  ICON_CLIP_FILTER_BASE,
  ICON_FACE_EDGE_DEFAULT,
  ICON_STACK_EDGE,
  ICON_STACK_EDGE_PX,
  appIconShapeClip,
  squircleStrokeWidthVbForVisibleBorder,
} from "./squircle";
export { cn } from "./utils";
```

- [ ] **Build and verify**

Run: `pnpm --filter @app-icon-maker/utils build`
Expected: creates `packages/utils/dist/` with index.js, index.d.ts

- [ ] **Commit**

---

### Task 5: Refactor icon-pipeline with Transport interface

**Files:**
- Create: `packages/utils/src/icon-pipeline.ts`
- Modify: `packages/utils/src/index.ts`

- [ ] **Create refactored icon-pipeline.ts**

The core logic stays the same, but `tauriInvoke` is replaced by an injected `Transport`:

```typescript
import { useCallback, useRef, useState } from "react";

export type PipelineStatus = "idle" | "downloading" | "generating" | "done" | "error";

export interface PipelineProgress {
  fraction: number;
  label: string;
}

export interface GenerateParams {
  prompt: string;
  model: string;
  provider: string;
  referenceImage?: string;
}

export interface GenerateResult {
  images: string[];
  error?: string;
}

export interface Transport {
  generateIcon(params: GenerateParams): Promise<GenerateResult>;
}

export interface IconPipeline {
  status: PipelineStatus;
  progress: PipelineProgress;
  variants: (string | null)[];
  rawVariants: (string | null)[];
  generate: (prompt: string, model: string, provider: string, referenceDataUrl?: string) => void;
  cancel: () => void;
}

const SQUIRCLE_N = 3.2;

function squirclePath(width: number, height: number): Path2D {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const p = 2 / SQUIRCLE_N;
  const steps = 512;
  const path = new Path2D();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const x = cx + rx * Math.sign(cos) * Math.abs(cos) ** p;
    const y = cy + ry * Math.sign(sin) * Math.abs(sin) ** p;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

async function applySquircleMask(dataUrl: string): Promise<string> {
  const bitmap = await createImageBitmap(
    await fetch(dataUrl).then((r) => r.blob()),
  );
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clip(squirclePath(bitmap.width, bitmap.height));
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

async function blobUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useIconPipeline(transport: Transport): IconPipeline {
  const [status, setStatus] = useState<PipelineStatus>("idle");
  const [progress, setProgress] = useState<PipelineProgress>({ fraction: 0, label: "" });
  const [variants, setVariants] = useState<(string | null)[]>([null, null, null]);
  const [rawVariants, setRawVariants] = useState<(string | null)[]>([null, null, null]);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const generate = useCallback(
    async (prompt: string, model: string, provider: string, referenceDataUrl?: string) => {
      cancelledRef.current = false;
      setVariants([null, null, null]);
      setRawVariants([null, null, null]);
      setStatus("generating");
      setProgress({ fraction: 0, label: "" });

      try {
        let referenceImage = "";
        if (referenceDataUrl) {
          try {
            referenceImage = await blobUrlToBase64(referenceDataUrl);
          } catch {}
        }

        if (cancelledRef.current) {
          setStatus("idle");
          return;
        }

        const response = await transport.generateIcon({ prompt, model, provider, referenceImage });

        if (cancelledRef.current) {
          setStatus("idle");
          setProgress({ fraction: 0, label: "" });
          return;
        }

        if (response.error) {
          setStatus("error");
          setProgress({ fraction: 0, label: `Error: ${response.error}` });
          return;
        }

        const newVariants: (string | null)[] = [null, null, null];
        const newRawVariants: (string | null)[] = [null, null, null];
        for (let i = 0; i < Math.min(response.images.length, 3); i++) {
          const raw = `data:image/png;base64,${response.images[i]}`;
          newRawVariants[i] = raw;
          newVariants[i] = await applySquircleMask(raw);
        }
        setRawVariants(newRawVariants);
        setVariants(newVariants);
        setStatus("done");
        setProgress({ fraction: 1, label: "" });
      } catch (err) {
        if (cancelledRef.current) {
          setStatus("idle");
          setProgress({ fraction: 0, label: "" });
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[icon-pipeline] transport call failed:", err);
        setStatus("error");
        setProgress({ fraction: 0, label: `Error: ${msg}` });
      }
    },
    [transport],
  );

  return { status, progress, variants, rawVariants, generate, cancel };
}
```

- [ ] **Update index.ts to add icon-pipeline exports**

```typescript
export type { IconState } from "./icon-types";
export {
  SQUIRCLE_PATH_01, SQUIRCLE_PATH_100, BLUEPRINT_SQUICLE_D,
  ICON_CLIP_FILTER_BASE, ICON_FACE_EDGE_DEFAULT, ICON_STACK_EDGE,
  ICON_STACK_EDGE_PX, appIconShapeClip, squircleStrokeWidthVbForVisibleBorder,
} from "./squircle";
export { cn } from "./utils";
export type {
  PipelineStatus, PipelineProgress, GenerateParams, GenerateResult,
  Transport, IconPipeline,
} from "./icon-pipeline";
export { useIconPipeline } from "./icon-pipeline";
```

- [ ] **Build and verify**

Run: `pnpm --filter @app-icon-maker/utils build`
Expected: no errors

- [ ] **Commit**

---

### Task 6: Migrate UI components to packages/ui (batch 1 — leaf components)

**Files:**
- Create: `packages/ui/src/components/squircle-clip-defs.tsx`
- Create: `packages/ui/src/components/blueprint-face.tsx`
- Create: `packages/ui/src/components/title-bar-status.tsx`
- Create: `packages/ui/src/components/theme-provider.tsx`
- Create: `packages/ui/src/components/ui/select.tsx`

These components have minimal or no imports from `@/lib/*` or `@/components/*`. Copy them directly, replacing `@/lib/utils` with `@app-icon-maker/utils` and `@/components/` with relative `../components/` (or keep as relative within the package).

For each component:
1. Read the source file from `src/components/`
2. Copy to `packages/ui/src/components/` with same relative path
3. Replace `@/lib/utils` → `@app-icon-maker/utils`
4. Replace `@/components/` prefix → adjust to relative imports (e.g., `@/components/squircle-clip-defs` → `./squircle-clip-defs`)

- [ ] **Copy squircle-clip-defs.tsx** — no import changes needed (no deps on utils)
- [ ] **Copy blueprint-face.tsx** — check imports
- [ ] **Copy title-bar-status.tsx** — check imports
- [ ] **Copy theme-provider.tsx** — check imports
- [ ] **Copy ui/select.tsx** — check imports

- [ ] **Verify all files compile**

Run: `pnpm --filter @app-icon-maker/ui build`
Expected: no errors (may fail if imports aren't resolved yet)

- [ ] **Commit**

---

### Task 7: Migrate UI components (batch 2 — components with deps)

**Files:**
- Create: `packages/ui/src/components/icon-face.tsx`
- Create: `packages/ui/src/components/icon-stack.tsx`
- Create: `packages/ui/src/components/single-refine-icon.tsx`
- Create: `packages/ui/src/components/variant-picker.tsx`
- Create: `packages/ui/src/components/macos-icon.tsx`
- Create: `packages/ui/src/components/prompt-input.tsx`
- Create: `packages/ui/src/components/error-modal.tsx`
- Create: `packages/ui/src/components/save-success-modal.tsx`

Same process: copy each file, replace `@/lib/` → `@app-icon-maker/utils`, fix relative imports.

- [ ] **Copy icon-face.tsx** — likely imports from `@/lib/squircle` and `@/components/squircle-clip-defs`
- [ ] **Copy icon-stack.tsx** — similar
- [ ] **Copy single-refine-icon.tsx** — similar
- [ ] **Copy variant-picker.tsx** — similar
- [ ] **Copy macos-icon.tsx** — orchestrates icon-face/icon-stack/single-refine
- [ ] **Copy prompt-input.tsx** — has file upload logic, lucide icons
- [ ] **Copy error-modal.tsx** — dependencies on lucide
- [ ] **Copy save-success-modal.tsx** — dependencies on lucide

- [ ] **Wire up packages/ui/src/index.ts**

```typescript
export { MacOSIcon } from "./components/macos-icon";
export { PromptInput } from "./components/prompt-input";
export { VariantPicker } from "./components/variant-picker";
export { IconFace } from "./components/icon-face";
export { IconStack } from "./components/icon-stack";
export { SingleRefineIcon } from "./components/single-refine-icon";
export { BlueprintFace } from "./components/blueprint-face";
export { SquircleClipDefs } from "./components/squircle-clip-defs";
export { ErrorModal } from "./components/error-modal";
export { SaveSuccessModal } from "./components/save-success-modal";
export { TitleBarStatus } from "./components/title-bar-status";
export { ThemeProvider } from "./components/theme-provider";
export { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectSeparator, SelectValue } from "./components/ui/select";
```

- [ ] **Build and verify**

Run: `pnpm --filter @app-icon-maker/ui build`
Expected: no errors

- [ ] **Commit**

---

### Task 8: Create TauriTransport adapter

**Files:**
- Create: `src/lib/tauri-transport.ts`

- [ ] **Create Tauri-specific Transport implementation**

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { Transport, GenerateParams, GenerateResult } from "@app-icon-maker/utils";

export const tauriTransport: Transport = {
  async generateIcon(params: GenerateParams): Promise<GenerateResult> {
    return invoke<GenerateResult>("generate_icon", {
      prompt: params.prompt,
      model: params.model,
      provider: params.provider,
      referenceImage: params.referenceImage || "",
      seed: 0,
    });
  },
};
```

- [ ] **Commit**

---

### Task 9: Refactor Tauri app imports

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/app-content.tsx`
- Modify: `src/components/openai-api-key-modals.tsx`

- [ ] **Install workspace dependencies in root**

```bash
pnpm add @app-icon-maker/utils@workspace:* @app-icon-maker/ui@workspace:*
```

- [ ] **Update src/App.tsx** — change `@/components/theme-provider` and `@/components/app-content` imports. These stay as local imports (not from packages) since AppContent is app-specific.

Actually, `ThemeProvider` is now in packages. Update its import:
`src/App.tsx`: `import { ThemeProvider } from "@app-icon-maker/ui";`

`src/components/app-content.tsx`:
- Replace `@/components/macos-icon` → `@app-icon-maker/ui`
- Replace `@/components/openai-api-key-modals` → keep local
- Replace `@/components/ui/select` → `@app-icon-maker/ui`
- Replace `@/components/prompt-input` → `@app-icon-maker/ui`
- Replace `@/components/error-modal` → `@app-icon-maker/ui`
- Replace `@/components/save-success-modal` → `@app-icon-maker/ui`
- Replace `@/components/squircle-clip-defs` → `@app-icon-maker/ui`
- Replace `@/components/title-bar-status` → `@app-icon-maker/ui`
- Replace `@/lib/icon-types` → `@app-icon-maker/utils`
- Replace `@/lib/icon-pipeline` → `@app-icon-maker/utils`
- Replace `@/lib/utils` → `@app-icon-maker/utils`
- Add import for `tauriTransport` from `@/lib/tauri-transport`
- Change `useIconPipeline()` → `useIconPipeline(tauriTransport)`

`src/components/openai-api-key-modals.tsx`:
- Replace `@/lib/utils` → `@app-icon-maker/utils`

- [ ] **Remove old lib files** (icon-pipeline.ts, icon-types.ts, squircle.ts, utils.ts from src/lib/)

- [ ] **Build and verify**

Run: `pnpm build` (which runs `tsc && vite build`)
Expected: no errors

- [ ] **Commit**

---

### Task 10: Configure Astro for React + Tailwind + Cloudflare

**Files:**
- Modify: `web/package.json`
- Modify: `web/astro.config.mjs`
- Create: `web/src/styles/global.css`
- Modify: `web/src/layouts/Layout.astro`

- [ ] **Update web/package.json with dependencies**

```json
{
  "name": "web",
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro"
  },
  "dependencies": {
    "@app-icon-maker/utils": "workspace:*",
    "@app-icon-maker/ui": "workspace:*",
    "@astrojs/cloudflare": "^12.6.0",
    "@astrojs/react": "^4.3.0",
    "@fontsource-variable/inter": "^5.2.8",
    "@tailwindcss/postcss": "^4.3.0",
    "astro": "^6.3.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.14.0",
    "postcss": "^8.5.14",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "tailwind-merge": "^3.6.0",
    "tailwindcss": "^4.3.0",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6"
  }
}
```

- [ ] **Update astro.config.mjs**

```javascript
// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [react()],
});
```

- [ ] **Create postcss.config.js in web/**

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Create web/src/styles/global.css**

```css
@import "tailwindcss";
@import "@fontsource-variable/inter";

@custom-variant dark (&:is(.dark *));

/* Copy the same @theme inline, :root, .dark, @layer blocks from src/index.css */
/* (Full CSS theme definition matching the desktop app) */
```

Read `src/index.css` and copy the full `@theme inline`, `:root`, `.dark`, and `@layer` blocks into `web/src/styles/global.css`.

---

- [ ] **Update web/src/layouts/Layout.astro** to include global CSS

```astro
---
import "../styles/global.css";
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <meta name="generator" content={Astro.generator} />
    <title>App Icon Maker</title>
  </head>
  <body class="bg-background text-foreground">
    <slot />
  </body>
</html>
```

- [ ] **Install deps and verify**

Run: `pnpm install --filter web` then `pnpm --filter web build`
Expected: build succeeds

- [ ] **Commit**

---

### Task 11: Create web API routes (AI generation proxy)

**Files:**
- Create: `web/src/pages/api/generate.ts`

This Astro backend endpoint receives requests from the React frontend and proxies to the appropriate AI provider. It implements the same logic as `src-tauri/src/lib.rs`'s `generate_icon` but in TypeScript.

- [ ] **Create web/src/pages/api/generate.ts**

```typescript
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

        // Poll for completion
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
```

- [ ] **Commit**

---

### Task 12: Create web utility modules

**Files:**
- Create: `web/src/lib/web-transport.ts`
- Create: `web/src/lib/api-key-manager.ts`

- [ ] **Create web-transport.ts**

```typescript
import type { Transport, GenerateParams, GenerateResult } from "@app-icon-maker/utils";

export function createWebTransport(getApiKey: (provider: string) => string | null): Transport {
  return {
    async generateIcon(params: GenerateParams): Promise<GenerateResult> {
      const apiKey = getApiKey(params.provider);
      if (!apiKey) {
        return { images: [], error: `API key not configured for ${params.provider}` };
      }
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: params.prompt,
          model: params.model,
          provider: params.provider,
          referenceImage: params.referenceImage || "",
          apiKey,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        return { images: [], error: text };
      }
      return response.json();
    },
  };
}
```

- [ ] **Create api-key-manager.ts**

```typescript
const STORAGE_KEYS: Record<string, string> = {
  openai: "app-icon-maker:api-key:openai",
  gemini: "app-icon-maker:api-key:gemini",
  openrouter: "app-icon-maker:api-key:openrouter",
  fal: "app-icon-maker:api-key:fal",
};

export function getApiKey(provider: string): string | null {
  return localStorage.getItem(STORAGE_KEYS[provider] || "");
}

export function setApiKey(provider: string, key: string): void {
  const storageKey = STORAGE_KEYS[provider];
  if (storageKey) {
    localStorage.setItem(storageKey, key);
  }
}

export function hasApiKey(provider: string): boolean {
  return !!getApiKey(provider);
}

export function clearApiKey(provider: string): void {
  const storageKey = STORAGE_KEYS[provider];
  if (storageKey) {
    localStorage.removeItem(storageKey);
  }
}

export type Provider = "openai" | "gemini" | "openrouter" | "fal";
```

- [ ] **Commit**

---

### Task 13: Build web app-content

**Files:**
- Create: `web/src/components/web-app-content.tsx`
- Create: `web/src/components/web-api-key-modals.tsx`
- Modify: `web/src/pages/index.astro`

- [ ] **Create web-app-content.tsx**

This is a web-tailored version of `src/components/app-content.tsx`. Key differences:
- Uses `createWebTransport(getApiKey)` instead of Tauri IPC
- API key modal uses localStorage instead of Tauri store
- Save/download uses browser download instead of Tauri save dialog
- No .icns export (PNG/JPEG only)
- No title bar drag regions
- No Tauri window close interception

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import {
  MacOSIcon, PromptInput, ErrorModal, SaveSuccessModal,
  SquircleClipDefs, Select, SelectContent, SelectGroup,
  SelectItem, SelectTrigger, SelectSeparator, SelectValue,
  generationErrorSuggestsApiKeyIssue,
} from "@app-icon-maker/ui";
import type { IconState } from "@app-icon-maker/utils";
import { useIconPipeline } from "@app-icon-maker/utils";
import { createWebTransport } from "../lib/web-transport";
import { getApiKey, setApiKey, hasApiKey, type Provider } from "../lib/api-key-manager";
import { WebApiKeyModal } from "./web-api-key-modals";

type PrimaryAction = "submit" | "stop" | "select" | "refresh";

const MODEL_LIST: Record<Provider, { value: string; label: string }[]> = {
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
    { value: "google/gemini-3.1-flash-image-preview", label: "Nano Banana 2" },
  ],
  fal: [
    { value: "fal-ai/nano-banana-2/edit", label: "Nano Banana 2" },
    { value: "fal-ai/nano-banana-pro/edit", label: "Nano Banana Pro" },
    { value: "fal-ai/nano-banana/edit", label: "Nano Banana" },
    { value: "openai/gpt-image-2/edit", label: "gpt-image-2" },
    { value: "openai/gpt-image-1.5/edit", label: "gpt-image-1.5" },
    { value: "fal-ai/flux-2-pro/edit", label: "Flux 2 Pro" },
    { value: "fal-ai/flux-pro/kontext", label: "Flux Pro Kontext" },
    { value: "fal-ai/bytedance/seedream/v5/lite/edit", label: "Seedream v5 Lite" },
    { value: "fal-ai/bytedance/seedream/v4.5/edit", label: "Seedream v4.5" },
    { value: "fal-ai/gemini-3-pro-image-preview/edit", label: "Nano Banana Pro (Gemini)" },
    { value: "fal-ai/gemini-25-flash-image/edit", label: "Nano Banana (Gemini)" },
    { value: "fal-ai/qwen-image-edit-2511", label: "Qwen Image Edit" },
  ],
};

const transport = createWebTransport(getApiKey);

function getDefaultModel(provider: Provider): string {
  const list = MODEL_LIST[provider];
  return list && list.length > 0 ? list[0].value : "gpt-image-1";
}

export function WebAppContent() {
  const [iconState, setIconState] = useState<IconState>("idle");
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [baseIconSrc, setBaseIconSrc] = useState<string | null>(null);
  const [rawBaseIconSrc, setRawBaseIconSrc] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("gpt-image-1");

  const pipeline = useIconPipeline(transport);
  const resumeAfterCancelRef = useRef<"idle" | "generated" | "refine">("idle");

  useEffect(() => {
    const providers: Provider[] = ["openai", "gemini", "openrouter", "fal"];
    if (!providers.some((p) => hasApiKey(p))) {
      setShowApiKeyModal(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("web:provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("web:model", model);
  }, [model]);

  useEffect(() => {
    if (pipeline.status === "done") {
      const hasAny = pipeline.variants.some((v) => v !== null);
      setIconState(hasAny ? "generated" : "idle");
    } else if (pipeline.status === "error") {
      setIconState(resumeAfterCancelRef.current);
      const raw = pipeline.progress.label;
      setErrorMessage(raw.startsWith("Error: ") ? raw.slice(7) : raw);
    }
  }, [pipeline.status]);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const url of prev) URL.revokeObjectURL(url);
      return [];
    });
  }, []);

  const startGeneration = () => {
    if (!prompt.trim() || iconState === "generating") return;
    resumeAfterCancelRef.current =
      iconState === "refine" ? "refine"
      : iconState === "generated" ? "generated"
      : "idle";
    setSelectedVariant(null);
    setIconState("generating");
    const referenceImage =
      iconState === "refine" ? baseIconSrc : attachments[0];
    pipeline.generate(prompt, model, provider, referenceImage);
  };

  const stopGeneration = () => {
    pipeline.cancel();
    setIconState(resumeAfterCancelRef.current);
  };

  const confirmSelectedVariant = () => {
    if (iconState !== "generated" || selectedVariant === null) return;
    setBaseIconSrc(pipeline.variants[selectedVariant]);
    setRawBaseIconSrc(pipeline.rawVariants[selectedVariant]);
    setIconState("refine");
    setSelectedVariant(null);
    setPrompt("");
    clearAttachments();
  };

  const handleDownload = async (format: string) => {
    const rawSrc =
      iconState === "refine"
        ? rawBaseIconSrc
        : selectedVariant !== null
          ? pipeline.rawVariants[selectedVariant]
          : null;
    if (!rawSrc) return;

    const response = await fetch(rawSrc);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `app-icon.${format === "jpeg" ? "jpg" : format}`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveSuccess(true);
  };

  const inputPlaceholder =
    iconState === "refine"
      ? "Make changes to the icon or describe a new idea…"
      : "Describe your app icon…";

  const primaryAction: PrimaryAction =
    iconState === "generating" ? "stop"
    : iconState === "generated" && selectedVariant !== null ? "select"
    : iconState === "generated" && selectedVariant === null ? "refresh"
    : "submit";

  const primaryEnabled =
    iconState === "generating" ? true
    : primaryAction === "select" ? selectedVariant !== null
    : prompt.trim().length > 0;

  const onPrimary = () => {
    if (primaryAction === "stop") { stopGeneration(); return; }
    if (primaryAction === "select") { confirmSelectedVariant(); return; }
    startGeneration();
  };

  const canSave = iconState === "refine" && rawBaseIconSrc != null;

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden select-none">
      <SquircleClipDefs />

      {errorMessage && (
        <ErrorModal
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
          onUpdateApiKey={
            generationErrorSuggestsApiKeyIssue(errorMessage)
              ? () => { setErrorMessage(null); setShowApiKeyModal(true); }
              : undefined
          }
        />
      )}

      {saveSuccess && (
        <SaveSuccessModal
          folderPath="Downloads"
          icnsPath=""
          onClose={() => setSaveSuccess(false)}
        />
      )}

      {showApiKeyModal && (
        <WebApiKeyModal
          defaultProvider={provider}
          onClose={(p?: Provider) => {
            setShowApiKeyModal(false);
            if (p) { setProvider(p); setModel(getDefaultModel(p)); }
          }}
        />
      )}

      <div className="flex items-center px-4 pt-3">
        <Select
          value={model}
          onValueChange={(v) => v && setModel(v)}
          disabled={iconState === "generating"}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select model">
              {(() => {
                const items = MODEL_LIST[provider] || [];
                const found = items.find((m) => m.value === model);
                return found ? found.label : model;
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MODEL_LIST[provider] && (
              <SelectGroup>
                {MODEL_LIST[provider].map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>

        <button
          disabled={!canSave}
          onClick={() => handleDownload("png")}
          className={`flex ml-auto items-center gap-2 px-4 h-8 rounded-l-lg text-sm font-medium transition-all duration-200 ${
            canSave
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] shadow-md"
              : "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed"
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          Save
        </button>
        <Select
          value=""
          onValueChange={(v) => v && handleDownload(v)}
          disabled={!canSave}
        >
          <SelectTrigger className={`h-8 w-8 px-0 rounded-l-none rounded-r-lg border-none justify-center! ${
            canSave
              ? "bg-primary! text-primary-foreground hover:bg-primary/90"
              : "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed"
          }`} />
          <SelectContent>
            <SelectItem value="png">Save as .png</SelectItem>
            <SelectItem value="jpeg">Save as .jpeg</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-10">
        <MacOSIcon
          state={iconState}
          selected={selectedVariant}
          onSelect={setSelectedVariant}
          variants={pipeline.variants}
          baseIconSrc={baseIconSrc}
        />
      </div>

      <div className="flex flex-col items-center px-4 pb-6">
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          primaryAction={primaryAction}
          onPrimary={onPrimary}
          primaryEnabled={primaryEnabled}
          onRegenerate={primaryAction === "select" ? startGeneration : undefined}
          regenerateEnabled={prompt.trim().length > 0}
          inputDisabled={iconState === "generating"}
          placeholder={inputPlaceholder}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onOpenApiKeySettings={() => setShowApiKeyModal(true)}
        />
      </div>
    </div>
  );
}
```

Note: `generationErrorSuggestsApiKeyIssue` is used from `error-modal.tsx` which is in `@app-icon-maker/ui`. We need to ensure that function is exported from the components package. Check `src/components/error-modal.tsx` to see if it's exported.

- [ ] **Create web-api-key-modals.tsx**

A simplified key management modal using localStorage:

```typescript
import { useState } from "react";
import { X } from "lucide-react";
import { setApiKey, hasApiKey, type Provider } from "../lib/api-key-manager";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "fal", label: "fal.ai" },
];

interface Props {
  defaultProvider: Provider;
  onClose: (savedProvider?: Provider) => void;
}

export function WebApiKeyModal({ defaultProvider, onClose }: Props) {
  const [selectedProvider, setSelectedProvider] = useState<Provider>(defaultProvider);
  const [key, setKey] = useState("");

  const handleSave = () => {
    if (key.trim()) {
      setApiKey(selectedProvider, key.trim());
    }
    const hasAny = PROVIDERS.some((p) => hasApiKey(p.value));
    if (hasAny) {
      onClose(selectedProvider);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl shadow-2xl p-6 w-[400px] max-w-[90vw]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">API Key</h2>
          <button onClick={() => onClose()} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as Provider)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Enter your API key..."
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
          <button
            onClick={handleSave}
            disabled={!key.trim()}
            className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Update web/src/pages/index.astro**

```astro
---
import Layout from '../layouts/Layout.astro';
import { WebAppContent } from '../components/web-app-content';
---

<Layout>
  <WebAppContent client:only="react" />
</Layout>
```

- [ ] **Verify web build**

Run: `pnpm --filter web build`
Expected: compiles without errors

- [ ] **Commit**

---

### Task 14: Final cleanup and verification

**Files:**
- Modify: `src-tauri/tauri.conf.json` — already set up, no changes needed
- Modify: `CLAUDE.md` — update with new structure
- Potentially remove: `src/lib/icon-pipeline.ts`, `src/lib/icon-types.ts`, `src/lib/squircle.ts`, `src/lib/utils.ts` (if not already done)

- [ ] **Verify full monorepo build**

```bash
pnpm --filter @app-icon-maker/utils build
pnpm --filter @app-icon-maker/ui build
pnpm build          # desktop app
pnpm --filter web build  # web app
```

Expected: all three build successfully

- [ ] **Clean up old files if any remain**

- [ ] **Verify no remaining imports from removed files**

Run: `rg "@/lib/(icon-pipeline|icon-types|squircle|utils)" src/`
Expected: no matches

- [ ] **Commit**

---

## Implementation Order

The phases are sequential due to dependencies:

1. **Tasks 1-3** (monorepo scaffold) → can parallel
2. **Tasks 4-5** (utils package) → sequential (Task 5 depends on 4)
3. **Tasks 6-7** (ui package) → sequential (Task 7 depends on 6)
4. **Tasks 8-9** (Tauri refactor) → sequential (Task 9 depends on 8)
5. **Task 10** (Astro config) → after packages are available
6. **Tasks 11-13** (web features) → Task 12 depends on 11, Task 13 depends on both
7. **Task 14** (final cleanup) → last

## Spec Coverage Checklist

- [x] Monorepo structure with `packages/*` — Tasks 1, 2, 3
- [x] `@app-icon-maker/utils` with shared types/utilities — Tasks 4, 5
- [x] `@app-icon-maker/ui` with shared React components — Tasks 6, 7
- [x] Transport abstraction for icon-pipeline — Task 5
- [x] Tauri app refactored to use shared packages — Tasks 8, 9
- [x] Astro + React web version — Tasks 10, 13
- [x] Cloudflare Workers via Astro API routes — Task 11
- [x] API keys stored in localStorage — Task 12
- [x] All AI providers proxied through Workers — Task 11
- [x] PNG/JPEG download on web (no .icns) — Task 13
