import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { MacOSIcon } from "@/components/macos-icon";
import {
  OpenAIApiKeyManageModal,
  OpenAIApiKeyStartupModal,
  type OpenAIApiKeyManageReason,
  type Provider,
} from "@/components/openai-api-key-modals";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PromptInput, type PrimaryAction } from "@/components/prompt-input";
import {
  ErrorModal,
  generationErrorSuggestsApiKeyIssue,
} from "@/components/error-modal";
import { SaveSuccessModal } from "@/components/save-success-modal";
import { SquircleClipDefs } from "@/components/squircle-clip-defs";
import { TitleBarStatus } from "@/components/title-bar-status";
import type { IconState } from "@/lib/icon-types";
import { useIconPipeline } from "@/lib/icon-pipeline";
import { cn } from "@/lib/utils";

type ResumeAfterCancel = "idle" | "generated" | "refine";

function getDefaultModel(provider: Provider): string {
  switch (provider) {
    case "gemini":
      return "gemini-2.5-flash-image";
    case "openrouter":
      return "openai/gpt-5-image";
    default:
      return "gpt-image-1";
  }
}

export function AppContent() {
  const [iconState, setIconState] = useState<IconState>("idle");
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [baseIconSrc, setBaseIconSrc] = useState<string | null>(null);
  const [rawBaseIconSrc, setRawBaseIconSrc] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<{
    folderPath: string;
    icnsPath: string;
  } | null>(null);
  const [iconDirty, setIconDirty] = useState(false);
  const [openAIApiKeyStartupOpen, setOpenAIApiKeyStartupOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("gpt-image-1");
  const [openAIApiKeyManageReason, setOpenAIApiKeyManageReason] =
    useState<OpenAIApiKeyManageReason | null>(null);
  const resumeAfterCancelRef = useRef<ResumeAfterCancel>("idle");

  const pipeline = useIconPipeline();
  const prevPipelineStatusRef = useRef(pipeline.status);

  useEffect(() => {
    // Check if any provider needs a key
    invoke<{ key_required: boolean; has_key: boolean }>(
      "get_openai_api_key_status",
    )
      .then((s) => {
        if (s.key_required === true && s.has_key !== true) {
          setOpenAIApiKeyStartupOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const url of prev) URL.revokeObjectURL(url);
      return [];
    });
  }, []);

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
  }, [pipeline.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const was = prevPipelineStatusRef.current;
    prevPipelineStatusRef.current = pipeline.status;
    if (pipeline.status !== "done") return;
    if (!pipeline.variants.some((v) => v !== null)) return;
    if (was !== "done") {
      setIconDirty(true);
    }
  }, [pipeline.status, pipeline.variants]);

  useEffect(() => {
    invoke("set_unsaved_icon_state", { unsaved: iconDirty }).catch(() => {});
  }, [iconDirty]);

  const startGeneration = () => {
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
    pipeline.generate(prompt, model, provider, referenceImage);
  };

  const stopGeneration = () => {
    pipeline.cancel();
    setIconState(resumeAfterCancelRef.current);
  };

  const confirmSelectedVariant = () => {
    if (iconState !== "generated" || selectedVariant === null) return;
    setIconDirty(true);
    setBaseIconSrc(pipeline.variants[selectedVariant]);
    setRawBaseIconSrc(pipeline.rawVariants[selectedVariant]);
    setIconState("refine");
    setSelectedVariant(null);
    setPrompt("");
    clearAttachments();
  };

  const handleSave = async () => {
    const rawSrc =
      iconState === "refine"
        ? rawBaseIconSrc
        : selectedVariant !== null
          ? pipeline.rawVariants[selectedVariant]
          : null;
    if (!rawSrc) return;

    try {
      const response = await fetch(rawSrc);
      const buffer = await response.arrayBuffer();
      const imageData = new Uint8Array(buffer);
      const saved = await invoke<{
        saved_path: string;
        canceled: boolean;
        icns_path: string;
      }>("save_icon", { imageData: Array.from(imageData) });
      if (!saved.canceled && saved.icns_path) {
        setIconDirty(false);
        setSaveSuccess({
          folderPath: saved.saved_path,
          icnsPath: saved.icns_path,
        });
      }
    } catch {
      // Silently ignore IPC errors.
    }
  };

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
        : primaryAction === "refresh" || primaryAction === "submit"
          ? prompt.trim().length > 0
          : false;

  const onPrimary = () => {
    if (primaryAction === "stop") {
      stopGeneration();
      return;
    }
    if (primaryAction === "select") {
      confirmSelectedVariant();
      return;
    }
    startGeneration();
  };

  const canSave = iconState === "refine" && rawBaseIconSrc != null;

  const showStatus =
    pipeline.status === "downloading" && pipeline.progress.label !== "";

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden select-none app-drag">
      <SquircleClipDefs />

      {errorMessage && (
        <ErrorModal
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
          onUpdateApiKey={
            generationErrorSuggestsApiKeyIssue(errorMessage)
              ? () => {
                  setErrorMessage(null);
                  setOpenAIApiKeyManageReason("authError");
                }
              : undefined
          }
        />
      )}

      {saveSuccess && (
        <SaveSuccessModal
          folderPath={saveSuccess.folderPath}
          icnsPath={saveSuccess.icnsPath}
          onClose={() => setSaveSuccess(null)}
        />
      )}

      {openAIApiKeyStartupOpen && (
        <OpenAIApiKeyStartupModal
          onSaved={(p: Provider) => {
            setProvider(p);
            setModel(getDefaultModel(p));
            setOpenAIApiKeyStartupOpen(false);
          }}
        />
      )}
      {openAIApiKeyManageReason !== null && (
        <OpenAIApiKeyManageModal
          key={openAIApiKeyManageReason}
          reason={openAIApiKeyManageReason}
          defaultProvider={provider}
          onClose={(saved: boolean, p?: Provider) => {
            setOpenAIApiKeyManageReason(null);
            if (p) {
              setProvider(p);
              setModel(getDefaultModel(p));
            }
            if (saved) setOpenAIApiKeyStartupOpen(false);
          }}
        />
      )}

      {/* Compact title-bar status: progress line + label. */}
      {showStatus && (
        <TitleBarStatus
          label={pipeline.progress.label}
          fraction={pipeline.progress.fraction}
          isError={pipeline.status === "error"}
        />
      )}

      {/* Top bar — model selector dropdown, save right. */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 app-no-drag">
        {/* Model selector — changes by provider set in settings. */}
        <Select
          value={model}
          onValueChange={(v) => v && setModel(v)}
          disabled={iconState === "generating"}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {provider === "openai" && (
              <SelectGroup>
                <SelectItem value="gpt-image-1">gpt-image-1</SelectItem>
                <SelectItem value="gpt-image-2">gpt-image-2</SelectItem>
              </SelectGroup>
            )}
            {provider === "gemini" && (
              <SelectGroup>
                <SelectItem value="gemini-2.5-flash-image">Nano Banana</SelectItem>
                <SelectItem value="gemini-3-pro-image-preview">Nano Banana Pro</SelectItem>
                <SelectItem value="gemini-3.1-flash-image-preview">Nano Banana 2</SelectItem>
              </SelectGroup>
            )}
            {provider === "openrouter" && (
              <SelectGroup>
                <SelectItem value="openai/gpt-5-image">gpt-image-1</SelectItem>
                <SelectItem value="openai/gpt-5.4-image-2">gpt-image-2</SelectItem>
                <SelectItem value="openai/gpt-5-image-mini">gpt-image-1-mini</SelectItem>
                <SelectItem value="google/gemini-2.5-flash-image">Nano Banana</SelectItem>
                <SelectItem value="google/gemini-3-pro-image-preview">Nano Banana Pro</SelectItem>
                <SelectItem value="google/gemini-3.1-flash-image-preview">Nano Banana 2</SelectItem>
              </SelectGroup>
            )}
          </SelectContent>
        </Select>

        <button
          disabled={!canSave}
          onClick={handleSave}
          className={cn(
            "flex items-center gap-2 px-4 h-8 rounded-lg text-sm font-medium transition-all duration-200",
            canSave
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] shadow-md"
              : "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed",
          )}
        >
          <Download className="w-3.5 h-3.5" />
          Save
        </button>
      </div>

      {/* Middle area — vertically centered. */}
      <div className="flex-1 flex flex-col items-center justify-center px-10">
        {/* Icon preview. */}
        <MacOSIcon
          state={iconState}
          selected={selectedVariant}
          onSelect={setSelectedVariant}
          variants={pipeline.variants}
          baseIconSrc={baseIconSrc}
        />
      </div>

      {/* Bottom area — input at the bottom. */}
      <div className="flex flex-col items-center px-4 pb-4 app-no-drag">
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          primaryAction={primaryAction}
          onPrimary={onPrimary}
          primaryEnabled={primaryEnabled}
          onRegenerate={
            primaryAction === "select" ? startGeneration : undefined
          }
          regenerateEnabled={prompt.trim().length > 0}
          inputDisabled={iconState === "generating"}
          placeholder={inputPlaceholder}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onOpenApiKeySettings={() => setOpenAIApiKeyManageReason("settings")}
        />
      </div>
    </div>
  );
}
