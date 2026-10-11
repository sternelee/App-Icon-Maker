import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  ResponsiveMacOSIcon,
  PromptInput,
  ErrorModal,
  SaveSuccessModal,
  SquircleClipDefs,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectSeparator,
  SelectValue,
  ProviderSelect,
  isQuotaOrRateLimitError,
  generationErrorSuggestsApiKeyIssue,
} from "@app-icon-maker/ui";
import {
  type Provider,
  useIconPipeline,
  MODEL_LIST,
  getDefaultModel,
  useAppWorkflow,
  loadSession,
  restoreSession,
  useSessionAutosave,
  clearSession,
} from "@app-icon-maker/utils";
import { createWebTransport } from "../lib/web-transport";
import { getApiKey, hasApiKey, WEB_PROVIDERS } from "../lib/api-key-manager";
import { WebApiKeyModal } from "./web-api-key-modals";

const transport = createWebTransport((provider) => getApiKey(provider));

export function WebAppContent() {
  const [provider, setProvider] = useState<Provider>(() => {
    return (localStorage.getItem("web:provider") as Provider) || "openai";
  });
  const [model, setModel] = useState(() => {
    return localStorage.getItem("web:model") || "gpt-image-1";
  });
  const pipeline = useIconPipeline(transport);
  const wf = useAppWorkflow(pipeline, model, provider);

  // Restore the last session so a refresh doesn't lose work.
  useEffect(() => {
    const snap = loadSession();
    if (snap) void restoreSession(snap, pipeline, wf);
  }, []);
  useSessionAutosave(wf, pipeline);

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [falCustom, setFalCustom] = useState<boolean>(() => {
    return localStorage.getItem("web:fal_custom") === "true";
  });
  const [falInput, setFalInput] = useState<string>(() => {
    return localStorage.getItem("web:fal_custom_model") || "";
  });

  useEffect(() => {
    if (
      !WEB_PROVIDERS.some((p) => hasApiKey(p)) &&
      localStorage.getItem("web:api-key-modal-dismissed") !== "1"
    ) {
      setShowApiKeyModal(true);
    }
  }, []);

  // Warn before leaving with unsaved work (variants, refine progress, prompt).
  const hasUnsavedWork =
    wf.iconState === "generating" ||
    wf.iconState === "generated" ||
    wf.iconState === "refine" ||
    wf.prompt.trim().length > 0;
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedWork]);

  useEffect(() => {
    localStorage.setItem("web:provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("web:model", model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem("web:fal_custom", String(falCustom));
  }, [falCustom]);

  const handleDownload = async (format: string) => {
    const rawSrc =
      wf.iconState === "refine"
        ? wf.rawBaseIconSrc
        : wf.selectedVariant !== null
          ? pipeline.rawVariants[wf.selectedVariant]
          : null;
    if (!rawSrc) return;

    try {
      const response = await fetch(rawSrc);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileName = `app-icon.${format === "jpeg" ? "jpg" : format}`;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      clearSession();
      setSaveSuccess(fileName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      wf.setErrorMessage(`The icon could not be downloaded:\n${msg}`);
    }
  };

  const onPrimary = useCallback(() => {
    if (wf.primaryAction === "stop") {
      wf.stopGeneration();
      return;
    }
    if (wf.primaryAction === "select") {
      wf.confirmSelectedVariant();
      return;
    }
    wf.startGeneration();
  }, [wf]);

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden select-none">
      <SquircleClipDefs />

      {wf.errorMessage && (
        <ErrorModal
          message={wf.errorMessage}
          onClose={() => wf.setErrorMessage(null)}
          onUpdateApiKey={
            generationErrorSuggestsApiKeyIssue(wf.errorMessage)
              ? () => {
                  wf.setErrorMessage(null);
                  setShowApiKeyModal(true);
                }
              : undefined
          }
          actionLabel={
            isQuotaOrRateLimitError(wf.errorMessage)
              ? "Check key & billing"
              : "Update API key"
          }
        />
      )}

      {saveSuccess && (
        <SaveSuccessModal
          fileName={saveSuccess}
          folderPath="Downloads"
          onClose={() => setSaveSuccess(null)}
        />
      )}

      {showApiKeyModal && (
        <WebApiKeyModal
          defaultProvider={provider}
          onClose={(p?: Provider) => {
            setShowApiKeyModal(false);
            if (p) {
              setProvider(p);
              setModel(getDefaultModel(p));
            }
          }}
        />
      )}

      <div className="flex items-center px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <ProviderSelect
          provider={provider}
          onChange={(p) => {
            setProvider(p);
            setModel(getDefaultModel(p));
            setFalCustom(false);
          }}
          disabled={wf.iconState === "generating"}
          className="h-8 text-xs w-[104px] shrink-0 min-[480px]:w-[128px]"
        />
        {provider === "fal" && falCustom ? (
          <div className="flex items-center">
            <input
              type="text"
              value={falInput}
              onChange={(e) => {
                setFalInput(e.target.value);
                setModel(e.target.value);
                localStorage.setItem("web:fal_custom_model", e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && falInput.trim()) {
                  const trimmed = falInput.trim();
                  localStorage.setItem("web:fal_custom_model", trimmed);
                  setFalCustom(false);
                }
              }}
              disabled={wf.iconState === "generating"}
              placeholder="fal-ai/your-model/edit"
              className="flex h-8 min-w-0 flex-1 min-[480px]:flex-none min-[480px]:w-[260px] rounded-md border border-input bg-background px-3 py-1 text-xs font-mono ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        ) : (
          <Select
            value={model}
            onValueChange={(v) => {
              if (!v) return;
              if (provider === "fal" && v === "__custom__") {
                setFalCustom(true);
                const saved =
                  localStorage.getItem("web:fal_custom_model") || "";
                setFalInput(saved);
                if (saved) setModel(saved);
              } else {
                setFalCustom(false);
                setModel(v);
              }
            }}
            disabled={wf.iconState === "generating"}
          >
            <SelectTrigger className="h-8 text-xs min-w-0 max-w-full flex-1 min-[480px]:flex-none min-[480px]:min-w-[260px]">
              <SelectValue placeholder="Select model">
                {(() => {
                  const items = MODEL_LIST[provider] || [];
                  const found = items.find((m) => m.value === model);
                  return found ? found.label : model;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {provider !== "fal" && MODEL_LIST[provider] && (
                <SelectGroup>
                  {MODEL_LIST[provider].map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {provider === "fal" && !falCustom && (
                <SelectGroup>
                  {MODEL_LIST.fal.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                  {(() => {
                    const saved = localStorage.getItem("web:fal_custom_model");
                    return saved ? (
                      <>
                        <SelectSeparator />
                        <SelectItem value={saved}>{saved}</SelectItem>
                      </>
                    ) : null;
                  })()}
                  <SelectSeparator />
                  <SelectItem value="__custom__">Custom…</SelectItem>
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        )}

        <button
          disabled={!wf.canSave}
          onClick={() => handleDownload("png")}
          className={`flex ml-auto items-center gap-2 px-4 h-8 rounded-l-lg text-sm font-medium transition-all duration-200 ${
            wf.canSave
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
          disabled={!wf.canSave}
        >
          <SelectTrigger
            className={`h-8 w-8 px-0 rounded-l-none rounded-r-lg border-none justify-center! ${
              wf.canSave
                ? "bg-primary! text-primary-foreground hover:bg-primary/90"
                : "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed"
            }`}
          />
          <SelectContent>
            <SelectItem value="png">Save as .png</SelectItem>
            <SelectItem value="jpeg">Save as .jpeg</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 min-[480px]:px-10">
        <ResponsiveMacOSIcon
          state={wf.iconState}
          selected={wf.selectedVariant}
          onSelect={wf.setSelectedVariant}
          variants={pipeline.variants}
          baseIconSrc={wf.baseIconSrc}
        />
      </div>

      <div className="flex flex-col items-center px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {wf.iconState === "generating" && (
          <p className="text-xs text-muted-foreground mb-2 animate-pulse">
            Generating three variants…
            {(provider === "fal" || provider === "replicate") &&
              " This can take up to a minute."}
          </p>
        )}
        <PromptInput
          value={wf.prompt}
          onChange={wf.setPrompt}
          primaryAction={wf.primaryAction}
          onPrimary={onPrimary}
          primaryEnabled={wf.primaryEnabled}
          onRegenerate={
            wf.primaryAction === "select" ? wf.startGeneration : undefined
          }
          regenerateEnabled={wf.prompt.trim().length > 0}
          inputDisabled={wf.iconState === "generating"}
          placeholder={wf.inputPlaceholder}
          attachments={wf.attachments}
          onAttachmentsChange={wf.setAttachments}
          onOpenApiKeySettings={() => setShowApiKeyModal(true)}
          attachmentsDisabled={wf.iconState === "refine"}
        />
      </div>
    </div>
  );
}
