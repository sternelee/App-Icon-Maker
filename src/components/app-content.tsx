import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import {
  MacOSIcon,
  PromptInput,
  ErrorModal,
  SaveSuccessModal,
  generationErrorSuggestsApiKeyIssue,
  SquircleClipDefs,
  TitleBarStatus,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectSeparator,
  SelectValue,
} from "@app-icon-maker/ui";
import {
  type Provider,
  useIconPipeline,
  cn,
  MODEL_LIST,
  getDefaultModel,
  useAppWorkflow,
} from "@app-icon-maker/utils";
import { tauriTransport } from "@/lib/tauri-transport";
import {
  OpenAIApiKeyManageModal,
  OpenAIApiKeyStartupModal,
  type OpenAIApiKeyManageReason,
} from "@/components/openai-api-key-modals";

import { invoke } from "@tauri-apps/api/core";

export function AppContent() {
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("gpt-image-1");
  const pipeline = useIconPipeline(tauriTransport);
  const wf = useAppWorkflow(pipeline, model, provider);

  const [iconDirty, setIconDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{
    folderPath: string;
    icnsPath: string;
  } | null>(null);
  const [openAIApiKeyStartupOpen, setOpenAIApiKeyStartupOpen] = useState(false);
  const [falCustom, setFalCustom] = useState(false);
  const [falInput, setFalInput] = useState("");
  const [openAIApiKeyManageReason, setOpenAIApiKeyManageReason] =
    useState<OpenAIApiKeyManageReason | null>(null);
  const prevPipelineStatusRef = useRef(pipeline.status);

  // Check all providers for API keys on mount.
  useEffect(() => {
    const providers = [
      { cmd: "get_openai_api_key_status" },
      { cmd: "get_gemini_api_key_status" },
      { cmd: "get_openrouter_api_key_status" },
      { cmd: "get_fal_api_key_status" },
      { cmd: "get_stepfun_api_key_status" },
    ];
    Promise.all(
      providers.map((p) =>
        invoke<{ key_required: boolean; has_key: boolean }>(p.cmd),
      ),
    )
      .then((results) => {
        if (results.every((s) => s.has_key !== true)) {
          setOpenAIApiKeyStartupOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  // Persist provider/model/fal_custom.
  useEffect(() => {
    localStorage.setItem("provider", provider);
  }, [provider]);
  useEffect(() => {
    localStorage.setItem("model", model);
  }, [model]);
  useEffect(() => {
    localStorage.setItem("fal_custom", String(falCustom));
  }, [falCustom]);

  // Track iconDirty when pipeline finishes with variants.
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

  const handleSave = async (format: string) => {
    const rawSrc =
      wf.iconState === "refine"
        ? wf.rawBaseIconSrc
        : wf.selectedVariant !== null
          ? pipeline.rawVariants[wf.selectedVariant]
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
      }>("save_icon", { imageData: Array.from(imageData), format });
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

  const onConfirmVariant = useCallback(() => {
    wf.confirmSelectedVariant();
    setIconDirty(true);
  }, [wf]);

  const onPrimary = useCallback(() => {
    if (wf.primaryAction === "stop") {
      wf.stopGeneration();
      return;
    }
    if (wf.primaryAction === "select") {
      onConfirmVariant();
      return;
    }
    wf.startGeneration();
  }, [wf, onConfirmVariant]);

  const showStatus =
    pipeline.status === "downloading" && pipeline.progress.label !== "";

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden select-none app-drag">
      <SquircleClipDefs />

      {wf.errorMessage && (
        <ErrorModal
          message={wf.errorMessage}
          onClose={() => wf.setErrorMessage(null)}
          onUpdateApiKey={
            generationErrorSuggestsApiKeyIssue(wf.errorMessage)
              ? () => {
                  wf.setErrorMessage(null);
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

      {showStatus && (
        <TitleBarStatus
          label={pipeline.progress.label}
          fraction={pipeline.progress.fraction}
          isError={pipeline.status === "error"}
        />
      )}

      <div className="flex items-center px-4 pt-safe app-no-drag">
        {provider === "fal" && falCustom ? (
          <div className="flex items-center">
            <input
              type="text"
              value={falInput}
              onChange={(e) => {
                setFalInput(e.target.value);
                setModel(e.target.value);
                localStorage.setItem("fal_custom_model", e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && falInput.trim()) {
                  const trimmed = falInput.trim();
                  localStorage.setItem("fal_custom_model", trimmed);
                  setFalCustom(false);
                }
              }}
              disabled={wf.iconState === "generating"}
              placeholder="fal-ai/your-model/edit"
              className="flex h-8 w-[260px] rounded-md border border-input bg-background px-3 py-1 text-xs font-mono ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        ) : (
          <Select
            value={model}
            onValueChange={(v) => {
              if (!v) return;
              if (provider === "fal" && v === "__custom__") {
                setFalCustom(true);
                const saved = localStorage.getItem("fal_custom_model") || "";
                setFalInput(saved);
                if (saved) setModel(saved);
              } else {
                setFalCustom(false);
                setModel(v);
              }
            }}
            disabled={wf.iconState === "generating"}
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
                    const saved = localStorage.getItem("fal_custom_model");
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
          onClick={() => handleSave("icns")}
          className={cn(
            "flex ml-auto items-center gap-2 px-4 h-8 rounded-l-lg text-sm font-medium transition-all duration-200",
            wf.canSave
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] shadow-md"
              : "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed",
          )}
        >
          <Download className="w-3.5 h-3.5" />
          Save
        </button>
        <Select
          value=""
          onValueChange={(v) => v && handleSave(v)}
          disabled={!wf.canSave}
        >
          <SelectTrigger
            className={cn(
              "h-8 w-8 px-0 rounded-l-none rounded-r-lg border-none justify-center!",
              wf.canSave
                ? "bg-primary! text-primary-foreground hover:bg-primary/90"
                : "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed",
            )}
          ></SelectTrigger>
          <SelectContent>
            <SelectItem value="icns">Save as .icns</SelectItem>
            <SelectItem value="png">Save as .png</SelectItem>
            <SelectItem value="jpeg">Save as .jpeg</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-10">
        <MacOSIcon
          state={wf.iconState}
          selected={wf.selectedVariant}
          onSelect={wf.setSelectedVariant}
          variants={pipeline.variants}
          baseIconSrc={wf.baseIconSrc}
        />
      </div>

      <div className="flex flex-col items-center px-4 pb-safe app-no-drag">
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
          onOpenApiKeySettings={() => setOpenAIApiKeyManageReason("settings")}
        />
      </div>
    </div>
  );
}
