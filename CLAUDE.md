# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install deps: `pnpm install`
- Frontend-only dev server: `pnpm dev`
- Full desktop app dev: `pnpm tauri dev`
- Frontend production build: `pnpm build`
- Desktop production build: `pnpm tauri build`
- Frontend preview build: `pnpm preview`
- Rust backend compile check: `cargo check --manifest-path src-tauri/Cargo.toml`

## Testing and verification

- No dedicated `test` script exists in `package.json`.
- No dedicated `lint` script exists in `package.json`.
- No single-test command is available today because there is no test runner configured.
- `pnpm build` is current TypeScript correctness check because it runs `tsc && vite build`.
- For backend-only changes, run `cargo check --manifest-path src-tauri/Cargo.toml`.
- For UI changes, prefer `pnpm tauri dev` over `pnpm dev` because important behavior depends on Tauri IPC and native dialogs.

## High-level architecture

App is Tauri 2 desktop app with React/TypeScript frontend and Rust backend.

### Frontend shape

- `src/main.tsx` boots React.
- `src/App.tsx` is thin wrapper: `ThemeProvider` around `AppContent`.
- `src/components/app-content.tsx` is primary UI state owner and workflow coordinator. It manages:
  - icon workflow state (`idle` / `generating` / `generated` / `refine`)
  - prompt text, attachments, selected variant
  - current provider/model selection
  - API-key modal visibility
  - unsaved state and save-success/error modals
  - localStorage persistence for provider/model/custom fal model
- `src/lib/icon-pipeline.ts` is frontend pipeline layer. It calls Tauri `generate_icon`, converts reference image blobs to base64, stores both raw and preview variants, and applies squircle mask only for in-app preview.

### Important UI/data-flow behavior

- Generation returns raw square PNGs from backend.
- Frontend masks previews with Canvas squircle clipping for macOS-like display.
- Frontend also keeps unmasked `rawVariants`; saving must use raw images, not masked previews. macOS applies icon masking itself, and saving pre-masked transparent-corner images causes bad `.icns` results.
- `AppContent` promotes one generated variant into `refine` mode by storing both masked preview and raw source.
- Unsaved-state handling is split across frontend/backend:
  - frontend tracks `iconDirty`
  - frontend sends it via `set_unsaved_icon_state`
  - backend blocks window close if unsaved work exists

### Backend shape

- `src-tauri/src/lib.rs` contains nearly all backend logic.
- Shared app state is `AppState`, storing API keys for all providers plus unsaved-icon flag in `Mutex` fields.
- API keys persist via `tauri-plugin-store` in `app-icon-maker.json` and are loaded during Tauri `setup()`.
- Tauri plugins in use: opener, dialog, shell, store.

### Backend command surface

Frontend/backend communication uses Tauri `invoke` commands. Important commands:

- API key management per provider:
  - `set_openai_api_key`, `get_openai_api_key_status`, `get_stored_openai_api_key`
  - `set_gemini_api_key`, `get_gemini_api_key_status`, `get_stored_gemini_api_key`
  - `set_openrouter_api_key`, `get_openrouter_api_key_status`, `get_stored_openrouter_api_key`
  - `set_fal_api_key`, `get_fal_api_key_status`, `get_stored_fal_api_key`
- Workflow/state:
  - `generate_icon`
  - `set_unsaved_icon_state`
- File/system actions:
  - `save_icon`
  - `show_path_in_finder`
  - `open_external_url`
  - `read_file_as_base64`

### Multi-provider image generation

`generate_icon` dispatches by `provider` string:

- `openai` → OpenAI Images API
- `gemini` → Google Gemini `generateContent`
- `openrouter` → OpenRouter chat completions with image modalities
- `fal` → fal.ai queue API with polling

Non-obvious provider behavior:

- Backend prepends every prompt with strong macOS icon art constraints (`SYSTEM_PREFIX`).
- Reference-image refine flow is implemented differently per provider:
  - OpenAI uses image edits endpoint
  - Gemini sends image as `inline_data`
  - OpenRouter sends multimodal message content
  - fal may switch to `/edit` endpoint and then poll queue status
- Backend chooses fallback default model from provider if frontend sends empty model.

## Platform and product constraints

- App is effectively macOS-focused. README documents macOS 14+ for proper `.icns` generation.
- `.icns` generation depends on system `sips` and `iconutil` in backend `save_icon` flow.
- On non-macOS targets, `save_icon` falls back to writing image files instead of real `.icns` generation.
- Main window is fixed size in `src-tauri/tauri.conf.json`: `550x520`, `resizable: false`.
- Tauri dev/build config uses:
  - `beforeDevCommand: pnpm dev`
  - `devUrl: http://localhost:1420`
  - `beforeBuildCommand: pnpm build`
  - `frontendDist: ../dist`

## Files worth reading before major changes

- `src/components/app-content.tsx` — main workflow/state machine
- `src/lib/icon-pipeline.ts` — preview masking and Tauri IPC boundary
- `src/components/openai-api-key-modals.tsx` — provider/API-key UX
- `src/components/prompt-input.tsx` — input, attachments, primary actions
- `src/components/macos-icon.tsx` — preview mode switching between idle/generating/generated/refine states
- `src-tauri/src/lib.rs` — provider integrations, save/export flow, app lifecycle
- `src-tauri/tauri.conf.json` — desktop shell behavior and build integration

## Repo-specific guidance

- Do not assume README is fully current. README still describes OpenAI-only limitation in one section, but code now supports OpenAI, Gemini, OpenRouter, and fal.
- When changing save/export behavior, preserve distinction between preview-masked image and raw exported image.
- When changing close behavior, check both frontend `iconDirty` updates and backend `on_window_event` close interception.
- When changing provider/model UX, check both frontend localStorage restore logic and backend provider dispatch/default-model behavior.
