import { useEffect } from "react";
import type { IconState } from "./icon-types";
import type { IconPipeline } from "./icon-pipeline";
import { applySquircleMask } from "./icon-pipeline";
import type { AppWorkflow } from "./use-app-workflow";

const SESSION_KEY = "app-icon-maker:session";
const SESSION_VERSION = 1;

export interface SessionSnapshot {
  version: number;
  prompt: string;
  iconState: IconState;
  selectedVariant: number | null;
  baseIconSrc: string | null;
  rawBaseIconSrc: string | null;
  /** Raw (unmasked) variants only — squircle masks are recomputed on restore. */
  rawVariants: (string | null)[];
}

/** Best-effort persistence of the in-progress session; quota errors are
 *  swallowed (images can be large) and degrade to a smaller snapshot. */
export function saveSession(snap: Omit<SessionSnapshot, "version">): void {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...snap, version: SESSION_VERSION }),
    );
  } catch {
    try {
      // Retry without the raw variants (keep the chosen base icon).
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...snap,
          rawVariants: [],
          baseIconSrc: null,
          version: SESSION_VERSION,
        }),
      );
    } catch {
      // Give up — persistence is best-effort.
    }
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Returns a sanitized snapshot, or null when there is nothing to restore. */
export function loadSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as SessionSnapshot;
    if (snap?.version !== SESSION_VERSION) return null;
    if (!Array.isArray(snap.rawVariants)) snap.rawVariants = [];
    // A generation in flight does not survive a reload.
    if (snap.iconState === "generating") {
      snap.iconState = snap.rawVariants.some((v) => v) ? "generated" : "idle";
    }
    if (
      snap.selectedVariant !== null &&
      (snap.selectedVariant < 0 || snap.selectedVariant > 2)
    ) {
      snap.selectedVariant = null;
    }
    const empty =
      !snap.prompt &&
      snap.iconState === "idle" &&
      !snap.baseIconSrc &&
      !snap.rawBaseIconSrc &&
      !snap.rawVariants.some((v) => v);
    return empty ? null : snap;
  } catch {
    return null;
  }
}

/** Restore a snapshot into the live pipeline + workflow state. */
export async function restoreSession(
  snap: SessionSnapshot,
  pipeline: IconPipeline,
  wf: Pick<
    AppWorkflow,
    | "setPrompt"
    | "setSelectedVariant"
    | "setBaseIconSrc"
    | "setRawBaseIconSrc"
    | "setIconState"
    | "skipStatusSyncRef"
  >,
): Promise<void> {
  wf.setPrompt(snap.prompt || "");
  wf.setSelectedVariant(snap.selectedVariant ?? null);
  const hasVariants = snap.rawVariants.some((v) => v);

  if (snap.iconState === "refine" && snap.rawBaseIconSrc) {
    // Keep the restored refine state: pipeline.restore's "done" status must
    // not be synced back to "generated".
    wf.skipStatusSyncRef.current = true;
    if (hasVariants) await pipeline.restore(snap.rawVariants);
    wf.setRawBaseIconSrc(snap.rawBaseIconSrc);
    let masked = snap.baseIconSrc;
    if (!masked) {
      try {
        masked = await applySquircleMask(snap.rawBaseIconSrc);
      } catch {
        masked = snap.rawBaseIconSrc;
      }
    }
    wf.setBaseIconSrc(masked);
    wf.setIconState("refine");
  } else if (hasVariants) {
    // Status sync turns pipeline "done" into iconState "generated".
    await pipeline.restore(snap.rawVariants);
  }
}

/** Persist the current session on every meaningful state change (debounced). */
export function useSessionAutosave(
  wf: Pick<
    AppWorkflow,
    | "prompt"
    | "iconState"
    | "selectedVariant"
    | "baseIconSrc"
    | "rawBaseIconSrc"
  >,
  pipeline: Pick<IconPipeline, "rawVariants">,
): void {
  const { prompt, iconState, selectedVariant, baseIconSrc, rawBaseIconSrc } =
    wf;
  const rawVariants = pipeline.rawVariants;

  useEffect(() => {
    const t = setTimeout(() => {
      const nothing =
        !prompt &&
        iconState === "idle" &&
        selectedVariant === null &&
        !baseIconSrc &&
        !rawBaseIconSrc &&
        !rawVariants.some((v) => v);
      if (nothing) {
        clearSession();
        return;
      }
      saveSession({
        prompt,
        iconState,
        selectedVariant,
        baseIconSrc,
        rawBaseIconSrc,
        rawVariants,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [prompt, iconState, selectedVariant, baseIconSrc, rawBaseIconSrc, rawVariants]);
}
