# Repository Guidelines

## Project Overview

App Icon Maker is an AI-powered icon generator producing macOS-style app icons. Dual deployment: **Tauri 2 desktop app** (primary, macOS/Linux/Windows/Android) and **Astro 6 web app** (secondary, Cloudflare Workers). Both frontends share icon generation pipeline and UI components through workspace packages.

## Architecture & Data Flow

### Transport Pattern

The central abstraction is the `Transport` interface (`packages/utils/src/transport.ts`):

```ts
export interface Transport {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}
```

- **Desktop** (`src/lib/tauri-transport.ts`): `invoke` calls through to `@tauri-apps/api/core` `invoke()`, which routes to Rust `#[tauri::command]` handlers.
- **Web** (`web/src/lib/web-transport.ts`): `invoke` sends `fetch()` to `/api/generate` with the user's API key, proxying through an Astro API route.

Both `useIconPipeline` and `useAppWorkflow` consume a `Transport` — they never know whether they're in desktop or web context.

### State Machine

`IconState` type (`packages/utils/src/icon-types.ts`): `"idle" | "generating" | "generated" | "refine"`

Two shared hooks drive all UI logic:
1. **`useIconPipeline(transport)`** — manages the 3-variant icon generation pipeline: calls `transport.invoke("generate_icon", ...)`, receives 3 base64 PNGs, applies Canvas squircle mask for **preview only**, keeps raw unmasked images for export.
2. **`useAppWorkflow(pipeline, model, provider)`** — wraps the pipeline with user-facing workflow: primary action button (`submit`/`stop`/`select`/`refresh`), variant selection, error handling, prompt state, attachment management.

### Preview vs Export Distinction (Critical)

- **Preview**: Squircle-masked base64 data URLs (Canvas-drawn Lamé superellipse with n=3.2).
- **Export/Save**: Raw unmasked square images from `pipeline.rawVariants[]` / `wf.rawBaseIconSrc`. Never use the preview URL for saving.

### Provider Routing

Four AI providers: `openai`, `gemini`, `openrouter`, `fal`. Provider type is `"openai" | "gemini" | "openrouter" | "fal"` (`packages/utils/src/api-key-config.ts`).

**Desktop** (`src-tauri/src/lib.rs` → `generate_icon` command):
- Routes to provider-specific async functions (`openai_generate_images`, `gemini_generate_images`, `openrouter_generate_images`, `fal_generate_images`)
- Each has a `_generate` and `_edit` variant (edit = image-to-image with reference image)
- API keys stored via `tauri-plugin-store` to `app-icon-maker.json`

**Web** (`web/src/pages/api/generate.ts`):
- Single Astro API route that proxies to provider APIs
- API key passed per-request from client (never stored server-side)

## Key Directories

|Directory|Purpose|
|---|---|
|`src/`|Desktop frontend: React + Vite + Tailwind 4. Entry: `main.tsx` → `App.tsx` → `AppContent`|
|`src-tauri/`|Rust backend: Tauri commands, AI provider integrations, `.icns` export, window lifecycle|
|`web/`|Astro 6 web app: React components + API route. Deployed to Cloudflare Workers|
|`packages/utils/`|Shared TypeScript: types, hooks, squircle math, provider config, model lists|
|`packages/ui/`|Shared React components: `MacOSIcon`, `PromptInput`, `Select`, modals, theme provider|
|`.github/workflows/`|CI/CD: `release-tauri.yml` — builds desktop on tag push `v*` (macOS ARM64/AMD64, Linux, Windows, Android)|

## Development Commands

```bash
pnpm install                          # Install all workspace deps

# Desktop development (preferred for Tauri UI work)
pnpm tauri dev                        # Starts Vite + Tauri together

# Desktop production build
pnpm tauri build

# Web development
pnpm --filter web dev                 # Astro dev server

# Web production build
pnpm --filter web build               # Astro check + CF Workers output

# TypeScript check (desktop frontend)
pnpm build                            # tsc && vite build

# Rust backend check
cargo check --manifest-path src-tauri/Cargo.toml

# Build shared packages manually (rarely needed — prebuild scripts handle this)
pnpm --filter @app-icon-maker/utils build
pnpm --filter @app-icon-maker/ui build
```

## Code Conventions & Common Patterns

### TypeScript

- **Strict mode**: `noUnusedLocals: true`, `noUnusedParameters: true`
- **Indentation**: Tabs (observed in all source files)
- **Class merging**: Always use `cn(...)` from `@app-icon-maker/utils` (wraps `clsx` + `tailwind-merge`). Never raw template literals for conditional classes.
- **Imports**: Workspace aliases — `@app-icon-maker/utils`, `@app-icon-maker/ui`. Desktop also uses `@/` for `src/`.
- **Exports**: Barrel files at package roots (`packages/utils/src/index.ts`, `packages/ui/src/index.ts`). Always re-export from barrel, never import from internal paths across packages.

### React Patterns

- **Hooks composition**: `useIconPipeline` + `useAppWorkflow` is the standard pattern. Both desktop and web `AppContent` components use identical hook signatures.
- **State lifting**: Provider/model selection lives in `AppContent`; pipeline/workflow state in hooks.
- **No context for app state**: Provider/model/pipeline state is passed as props or returned from hooks, not stored in React context. Only `ThemeProvider` uses context.

### Rust

- **Edition 2021**
- **Error handling**: Functions return `Result<T, String>` with `.map_err(|e| e.to_string())` patterns
- **State management**: `AppState` struct with `Mutex<String>` fields for each API key + `has_unsaved_icon`
- **Command naming**: snake_case matching the frontend's `invoke()` calls (e.g., `generate_icon`, `save_icon`)
- **Provider functions**: Each provider has `_generate_images` and `_edit_images` async functions making parallel `reqwest` calls

### State Management

- **localStorage keys** (desktop): `provider`, `model`, `fal_custom`, `fal_custom_model`
- **localStorage keys** (web): `web:provider`, `web:model`, `web:fal_custom`, `web:fal_custom_model`, `app-icon-maker:api-key:<provider>`
- **Rust store keys**: `openai.api_key`, `gemini.api_key`, `openrouter.api_key`, `fal.api_key` in `app-icon-maker.json`

### When Adding a New AI Provider

Must update ALL of:
1. `packages/utils/src/api-key-config.ts` — add to `Provider` union + `PROVIDER_CONFIG`
2. `packages/utils/src/model-config.ts` — add model list entry
3. `src-tauri/src/lib.rs` — add `_generate_images`/`_edit_images` functions + `generate_icon` match arm + API key management commands + store loading in `setup()`
4. `web/src/pages/api/generate.ts` — add provider case in the API route
5. `packages/ui/src/components/api-key-modals.tsx` — add provider tab/fields
6. Both `app-content.tsx` and `web-app-content.tsx` — update provider lists and localStorage keys

## Important Files

|File|Role|
|---|---|
|`packages/utils/src/transport.ts`|`Transport` interface — the contract between frontend and backend|
|`packages/utils/src/icon-pipeline.ts`|`useIconPipeline` — generation pipeline + squircle masking|
|`packages/utils/src/use-app-workflow.ts`|`useAppWorkflow` — user-facing workflow state machine|
|`packages/utils/src/squircle.ts`|Squircle math: Lamé curve paths, clip constants, border calculations|
|`packages/utils/src/api-key-config.ts`|`Provider` type + `PROVIDER_CONFIG` (labels, URL patterns)|
|`packages/utils/src/model-config.ts`|`MODEL_LIST` + `getDefaultModel` per provider|
|`src/components/app-content.tsx`|Desktop workflow UI: provider/model select, save, modals|
|`web/src/components/web-app-content.tsx`|Web workflow UI (mirrors desktop with web-specific download)|
|`src/lib/tauri-transport.ts`|Desktop Transport: `invoke()` → Tauri IPC|
|`web/src/lib/web-transport.ts`|Web Transport: `invoke()` → `fetch("/api/generate")`|
|`web/src/pages/api/generate.ts`|Astro API route: proxies AI provider requests|
|`src-tauri/src/lib.rs`|Rust backend: all commands, provider integrations, `.icns` export, window lifecycle|
|`src-tauri/tauri.conf.json`|Tauri config: window 550x520, non-resizable, dev/build commands|
|`vite.config.ts`|Vite config: React plugin, `@/` alias, Tauri dev host detection|
|`web/astro.config.mjs`|Astro config: React + Tailwind + CF Workers adapter|
|`.github/workflows/release-tauri.yml`|Release CI: 5-platform build matrix + Android APK/AAB|

## Runtime/Tooling Preferences

- **Package manager**: pnpm 10 (workspace monorepo)
- **Node.js**: 22 (specified in CI)
- **Rust**: stable toolchain, edition 2021
- **macOS**: 14+ required for `.icns` generation (uses `sips` + `iconutil`)
- **Formatting/Linting**: No ESLint or Prettier configured. TypeScript correctness is the only gate (`tsc`).
- **Styling**: Tailwind CSS v4 with `@tailwindcss/vite` plugin. No `tailwind.config.*` — config is CSS-first.
- **Font**: Inter Variable (`@fontsource-variable/inter`)

## Testing & QA

- **No test runner** is configured in the repository.
- **TypeScript verification**: `pnpm build` runs `tsc && vite build` for the desktop frontend.
- **Rust verification**: `cargo check --manifest-path src-tauri/Cargo.toml`
- **Web verification**: `pnpm --filter web build` runs Astro type-check + build.
- **Manual testing**: For Tauri UI changes, always test with `pnpm tauri dev` (not `pnpm dev`) — native dialogs, IPC, and store depend on the Tauri runtime.

## Platform Constraints

- Desktop window is **fixed at 550x520, non-resizable**.
- `.icns` export is **macOS-only** (falls back to PNG on other platforms).
- Web app can only download PNG/JPEG — no `.icns` support.
- API keys are **never stored server-side** in the web app; they're passed per-request.
- Close-confirmation uses `set_unsaved_icon_state` IPC command + `on_window_event(CloseRequested)` — both `iconDirty` state (frontend) and `has_unsaved_icon` (Rust) must be in sync.
