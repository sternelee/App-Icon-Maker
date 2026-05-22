import { useCallback, useEffect, useRef, useState } from "react";
import type { IconPipeline } from "./icon-pipeline";
import type { IconState } from "./icon-types";

export type ResumeAfterCancel = "idle" | "generated" | "refine";

export type PrimaryAction = "submit" | "stop" | "select" | "refresh";

export interface AppWorkflow {
  iconState: IconState;
  setIconState: React.Dispatch<React.SetStateAction<IconState>>;
  prompt: string;
  setPrompt: (v: string) => void;
  attachments: string[];
  setAttachments: React.Dispatch<React.SetStateAction<string[]>>;
  selectedVariant: number | null;
  setSelectedVariant: (v: number | null) => void;
  baseIconSrc: string | null;
  setBaseIconSrc: (v: string | null) => void;
  rawBaseIconSrc: string | null;
  setRawBaseIconSrc: (v: string | null) => void;
  errorMessage: string | null;
  setErrorMessage: (v: string | null) => void;
  startGeneration: () => void;
  stopGeneration: () => void;
  confirmSelectedVariant: () => void;
  clearAttachments: () => void;
  primaryAction: PrimaryAction;
  primaryEnabled: boolean;
  onPrimary: () => void;
  canSave: boolean;
  inputPlaceholder: string;
  pipeline: IconPipeline;
  resumeAfterCancelRef: React.MutableRefObject<ResumeAfterCancel>;
}

export function useAppWorkflow(
  pipeline: IconPipeline,
  model: string,
  provider: string,
): AppWorkflow {
  const [iconState, setIconState] = useState<IconState>("idle");
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [baseIconSrc, setBaseIconSrc] = useState<string | null>(null);
  const [rawBaseIconSrc, setRawBaseIconSrc] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resumeAfterCancelRef = useRef<ResumeAfterCancel>("idle");

  const modelRef = useRef(model);
  const providerRef = useRef(provider);
  modelRef.current = model;
  providerRef.current = provider;

  // Sync iconState with pipeline status changes.
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

  const startGeneration = useCallback(() => {
    if (!prompt.trim() || iconState === "generating") return;
    resumeAfterCancelRef.current =
      iconState === "refine"
        ? "refine"
        : iconState === "generated"
          ? "generated"
          : "idle";
    setSelectedVariant(null);
    setIconState("generating");
    const referenceImage =
      iconState === "refine" ? (baseIconSrc ?? attachments[0]) : attachments[0];
    pipeline.generate(
      prompt,
      modelRef.current,
      providerRef.current,
      referenceImage,
    );
  }, [prompt, iconState, baseIconSrc, attachments, pipeline]);

  const stopGeneration = useCallback(() => {
    pipeline.cancel();
    setIconState(resumeAfterCancelRef.current);
  }, [pipeline]);

  const confirmSelectedVariant = useCallback(() => {
    if (iconState !== "generated" || selectedVariant === null) return;
    setBaseIconSrc(pipeline.variants[selectedVariant]);
    setRawBaseIconSrc(pipeline.rawVariants[selectedVariant]);
    setIconState("refine");
    setSelectedVariant(null);
    setPrompt("");
    clearAttachments();
  }, [iconState, selectedVariant, pipeline, clearAttachments]);

  const inputPlaceholder =
    iconState === "refine"
      ? "Make changes to the icon or describe a new idea…"
      : "Describe your app icon…";

  const primaryAction: PrimaryAction =
    iconState === "generating"
      ? "stop"
      : iconState === "generated" && selectedVariant !== null
        ? "select"
        : iconState === "generated" && selectedVariant === null
          ? "refresh"
          : "submit";

  const primaryEnabled =
    iconState === "generating"
      ? true
      : primaryAction === "select"
        ? selectedVariant !== null
        : prompt.trim().length > 0;

  const onPrimary = useCallback(() => {
    if (primaryAction === "stop") {
      stopGeneration();
      return;
    }
    if (primaryAction === "select") {
      confirmSelectedVariant();
      return;
    }
    startGeneration();
  }, [primaryAction, stopGeneration, confirmSelectedVariant, startGeneration]);

  const canSave = iconState === "refine" && rawBaseIconSrc != null;

  return {
    iconState,
    setIconState,
    prompt,
    setPrompt,
    attachments,
    setAttachments,
    selectedVariant,
    setSelectedVariant,
    baseIconSrc,
    setBaseIconSrc,
    rawBaseIconSrc,
    setRawBaseIconSrc,
    errorMessage,
    setErrorMessage,
    startGeneration,
    stopGeneration,
    confirmSelectedVariant,
    clearAttachments,
    primaryAction,
    primaryEnabled,
    onPrimary,
    canSave,
    inputPlaceholder,
    pipeline,
    resumeAfterCancelRef,
  };
}
