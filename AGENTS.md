# AGENTS.md

> This file provides context for AI coding agents working on this repository. The reader is assumed to know nothing about the project.

## Project Overview

App Icon Maker is an AI-powered icon generator that produces macOS-style app icons. It exists as both a **Tauri 2 desktop application** (primary) and an **Astro web application** (secondary).

- **Desktop app**: Fixed-size (550×520) non-resizable window. Generates `.icns` and `.iconset` exports on macOS using system tools (`sips` + `iconutil`).
- **Web app**: Astro 6 + React, deployed to Cloudflare Workers. Generates PNG/JPEG downloads only (no `.icns`).

Both frontends share the same icon generation pipeline and UI components through workspace packages.

## Technology Stack

- **Package manager**: pnpm (workspace monorepo)
- **Desktop shell**: Tauri 2 (Rust backend)
- **Frontend frameworks**: React 19 + TypeScript 5.8
- **Build tools**: Vite 7 (desktop), Astro 6 (web), tsup (shared packages)
- **Styling**: Tailwind CSS v4 + CSS custom properties (light/dark themes)
- **Backend**: Rust (tauri, reqwest, tokio, serde, base64)
- **Web deployment**: Cloudflare Workers via `@astrojs/cloudflare`
- **AI providers**: OpenAI, Google Gemini, OpenRouter, fal.ai

## Monorepo Structure

```
packages/utils/    — Shared TypeScript: icon types, squircle math, cn() utility,
                     Transport interface, useIconPipeline hook
packages/ui/       — Shared React components (TSX). Built with tsup.
                     Consumers compile their own Tailwind CSS.
src/               — Tauri desktop app (React + Vite + Tailwind 4)
src-tauri/         — Rust backend (Tauri commands, AI provider integrations,
                     .icns export, API key persistence)
web/               — Astro 6 web app (React + Tailwind 4 + CF Workers adapter)
```

### Workspace packages

Both `packages/utils` and `packages/ui` are private workspace packages built with `tsup`. They must be built before dependent consumers can use them. The root `package.json` and `web/package.json` prebuild scripts handle this automatically.

## Build and Development Commands

```bash
# Install all dependencies
pnpm install

# Build shared workspace packages
pnpm --filter @app-icon-maker/utils build
pnpm --filter @app-icon-maker/ui build

# Desktop development (use this for Tauri UI changes; not just pnpm dev)
pnpm tauri dev

# Desktop production build
pnpm tauri build

# Web development
pnpm --filter web dev

# Web production build (Astro check + CF Workers output)
pnpm --filter web build

# TypeScript correctness check (desktop frontend)
pnpm build          # runs tsc && vite build

# Rust backend compile check
cargo check --manifest-path src-tauri/Cargo.toml
```

## Architecture

### Transport Pattern

The frontend uses a `Transport` interface to abstract IPC vs HTTP:

- **Desktop**: `src/lib/tauri-transport.ts` implements `Transport` via `@tauri-apps/api/core` `invoke()`.
- **Web**: `web/src/lib/web-transport.ts` implements `Transport` via `fetch()` to `/api/generate`.

Shared generation logic lives in `packages/utils/src/icon-pipeline.ts` and accepts a `Transport` instance.

### State Machine

The desktop and web apps each have their own `AppContent` component that manages the icon workflow state:

- `idle` → `generating` → `generated` → `refine` (or back to `idle`)

Key files:
- `src/components/app-content.tsx` — desktop workflow
- `web/src/components/web-app-content.tsx` — web workflow

### AI Provider Integration

Each provider has both a **Rust backend implementation** (`src-tauri/src/lib.rs`) and a **web API route** (`web/src/pages/api/generate.ts`). When adding a new provider, both must be updated, plus both Transport implementations.

Supported providers and their key models:
- `openai`: `gpt-image-1`, `gpt-image-2`
- `gemini`: `gemini-2.5-flash-image`, `gemini-3-pro-image-preview`, etc.
- `openrouter`: `openai/gpt-5-image`, `google/gemini-2.5-flash-image`, etc.
- `fal`: `fal-ai/nano-banana-2/edit`, `fal-ai/flux-2-pro/edit`, etc.

### Icon Pipeline

`packages/utils/src/icon-pipeline.ts` (`useIconPipeline` hook):
1. Calls `transport.invoke("generate_icon", ...)`
2. Receives 3 base64 PNGs from the provider
3. Applies a Canvas squircle mask (Lamé superellipse) for **preview only**
4. Keeps raw unmasked images for **export/saving**

The squircle math lives in `packages/utils/src/squircle.ts`.

### Backend Commands (Tauri)

| Command | Purpose |
|---------|---------|
| `generate_icon` | AI image generation (text-to-image / image-to-image) |
| `save_icon` | Save dialog + `.icns` export (macOS) or PNG/JPEG fallback |
| `show_path_in_finder` | Reveal saved file in Finder |
| `open_external_url` | Open external URL via system handler |
| `set_*_api_key` / `get_*_api_key_status` / `get_stored_*_api_key` | Per-provider API key management |
| `set_unsaved_icon_state` | Controls close-confirmation behavior |
| `read_file_as_base64` | Read a file from disk as base64 |

## Code Style Guidelines

- **TypeScript**: Strict mode enabled. `noUnusedLocals` and `noUnusedParameters` are on.
- **Indentation**: Tabs (observed in source files).
- **Class merging**: Use `cn(...)` from `@app-icon-maker/utils` (wraps `clsx` + `tailwind-merge`).
- **Imports**: Use workspace aliases `@app-icon-maker/utils` and `@app-icon-maker/ui`. Desktop also uses `@/` alias for `src/`.
- **No test runner** is currently configured. TypeScript correctness is verified via `tsc`.
- **No ESLint/Prettier** configuration files exist in the repository.

## Testing and Verification

- Run `pnpm build` to verify TypeScript correctness for the desktop frontend.
- Run `cargo check --manifest-path src-tauri/Cargo.toml` to verify Rust compilation.
- Run `pnpm --filter web build` to verify Astro + web frontend correctness.
- For any Tauri UI change, test with `pnpm tauri dev` rather than `pnpm dev` — important behaviors (native dialogs, IPC, store) depend on the Tauri runtime.

## Security Considerations

- **API keys are never stored server-side**. The web API route (`web/src/pages/api/generate.ts`) proxies requests using the client-provided key per request.
- **Desktop**: API keys are persisted via `tauri-plugin-store` to `app-icon-maker.json` in the app's data directory.
- **Web**: API keys are stored in `localStorage` with keys like `app-icon-maker:api-key:openai`.
- The Tauri app has a `capabilities/default.json` permission file restricting shell, dialog, opener, and store access.
- `.icns` export uses temp directories and spawns system commands (`sips`, `iconutil`) on macOS.

## Platform Constraints

- **macOS 14+** is required for `.icns` generation (depends on `sips` and `iconutil`).
- The desktop window is **fixed at 550×520 and non-resizable**.
- The web app can only download PNG/JPEG — no `.icns` support.

## Deployment

- **Desktop**: GitHub Actions workflow `.github/workflows/release-tauri.yml` triggers on `v*` tags. It builds for:
  - macOS ARM64 (`aarch64-apple-darwin`)
  - macOS AMD64 (`x86_64-apple-darwin`)
  - Linux (Ubuntu 22.04)
  - Windows
  - Android (APK + AAB, conditional on signing secrets)
  The workflow uses `tauri-apps/tauri-action` to create draft releases.
- **Web**: Deployed to Cloudflare Workers via `@astrojs/cloudflare` adapter.

## Key Conventions

1. **Preview vs Export distinction is critical**: The squircle-masked versions are for UI preview only. Raw unmasked square images must be used for saving/export.
2. **When adding a new AI provider**: Update Rust backend (`src-tauri/src/lib.rs`), web API route (`web/src/pages/api/generate.ts`), add Transport methods, and update frontend model lists in both `app-content.tsx` and `web-app-content.tsx`.
3. **When changing close behavior**: Check both frontend `iconDirty` state and backend `on_window_event` close interception in `src-tauri/src/lib.rs`.
4. **Workspace packages must be built** before consumers. Both `pnpm build` and `pnpm --filter web build` rebuild packages automatically via prebuild scripts.
5. **Do not assume README is fully current** — the README still describes an older OpenAI-only architecture, while the code supports multiple providers.

## Files Worth Reading Before Major Changes

- `packages/utils/src/icon-pipeline.ts` — shared generation logic + Transport interface
- `packages/utils/src/icon-types.ts` — shared type definitions (`IconState`)
- `src/components/app-content.tsx` — desktop workflow state machine
- `web/src/components/web-app-content.tsx` — web workflow state machine
- `src-tauri/src/lib.rs` — Rust backend (provider APIs, save/export, lifecycle)
- `src-tauri/tauri.conf.json` — desktop shell configuration
- `web/astro.config.mjs` — Astro + CF Workers configuration
- `web/src/pages/api/generate.ts` — web AI provider proxy
