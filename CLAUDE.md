# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install deps: `pnpm install`
- Build workspace packages: `pnpm --filter @app-icon-maker/utils build && pnpm --filter @app-icon-maker/ui build`
- Build all: `pnpm build` (Tauri frontend) | `pnpm --filter web build` (web)
- Tauri desktop dev: `pnpm tauri dev`
- Web dev server: `pnpm --filter web dev`
- Desktop production build: `pnpm tauri build`
- Web production build: `pnpm --filter web build`
- Rust backend compile check: `cargo check --manifest-path src-tauri/Cargo.toml`

## Testing and verification

- No test runner configured; `pnpm build` (tsc + vite) is the TypeScript correctness check.
- `pnpm --filter web build` runs Astro check + builds the CF Workers output.
- Rust: `cargo check --manifest-path src-tauri/Cargo.toml`.
- For Tauri UI changes, prefer `pnpm tauri dev` over `pnpm dev` (important behavior depends on Tauri IPC/native dialogs).

## High-level architecture

Monorepo (pnpm workspace) with three top-level consumers and two shared packages:

```
packages/utils/    — Pure TS: icon types, squircle math, utilities, Transport interface, icon-pipeline hook
packages/ui/       — Shared React components (TSX, consumers handle Tailwind compilation)
src/               — Tauri 2 desktop app (React 19 + Vite + Tailwind 4 + Rust backend)
web/               — Astro 6 + React + Tailwind 4, deployed to CF Workers via @astrojs/cloudflare
```

### Tauri app (src/)

- `src/main.tsx` boots React. `src/App.tsx` wraps `AppContent` in ThemeProvider.
- `src/components/app-content.tsx` manages icon workflow state (idle/generating/generated/refine), prompt, attachments, provider/model selection, API-key modal, unsaved state.
- `src/lib/tauri-transport.ts` implements `Transport` interface via `@tauri-apps/api/core` invoke.
- Backend (`src-tauri/src/lib.rs`): Rust, handles AI provider calls, API key persistence (tauri-plugin-store), `.icns` export via `sips`+`iconutil`.
- Backend commands: `generate_icon`, `set_unsaved_icon_state`, `save_icon`, per-provider key set/get, file/system actions.

### Web app (web/)

- Astro API routes (`src/pages/api/generate.ts`) proxy AI provider calls (no key storage server-side).
- `web/src/lib/web-transport.ts` implements `Transport` via `fetch` to `/api/generate`.
- `web/src/lib/api-key-manager.ts` stores keys in localStorage.
- `web/src/components/web-app-content.tsx` is the web-specific AppContent (browser download, no .icns).
- API keys sent from client to backend per request (no server-side storage).

### Shared behavior

- Generation returns raw square PNGs. Frontend masks previews with Canvas squircle clipping (macOS look).
- Preview masking uses both masked (preview) and unmasked (export) variants. Raw images for saving.
- `packages/utils/src/icon-pipeline.ts` uses `Transport` pattern — consumers inject their transport layer.

## Platform constraints

- Desktop: macOS 14+ for `.icns` generation. Fixed window 550x520, non-resizable.
- Web: PNG/JPEG download only (no .icns). Requires browser fetch API for AI generation.

## Files worth reading before major changes

- `packages/utils/src/icon-pipeline.ts` — shared pipeline logic + Transport interface
- `packages/utils/src/icon-types.ts` — shared type definitions
- `src/components/app-content.tsx` — desktop app workflow/state machine
- `web/src/components/web-app-content.tsx` — web app workflow/state machine (parallel to desktop version)
- `src-tauri/src/lib.rs` — Rust backend (provider integrations, save/export, lifecycle)
- `src-tauri/tauri.conf.json` — desktop shell behavior
- `web/astro.config.mjs` — Astro + CF Workers config
- `web/src/pages/api/generate.ts` — AI provider proxy
- `web/src/lib/web-transport.ts` — web Transport implementation

## Guidance

- Do not assume README is fully current. README still describes OpenAI-only in one section; code supports OpenAI, Gemini, OpenRouter, fal.
- When changing save/export behavior: preview-masked vs raw image distinction must be preserved.
- When changing close behavior: check both frontend `iconDirty` (Tauri) and backend `on_window_event` interception.
- When adding new provider: implement in Rust backend, add API route in web/src/pages/api/generate.ts, add Transport method in both tauri-transport.ts and web-transport.ts.
- Web API keys live in localStorage; desktop keys live in tauri-plugin-store (persisted to app-icon-maker.json).
- Workspace packages must be built (`tsup`) before dependent consumers. Both `pnpm build` and `pnpm --filter web build` rebuild packages automatically via prebuild scripts.
