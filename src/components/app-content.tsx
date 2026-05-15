import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { MacOSIcon } from "@/components/macos-icon";
import {
	OpenAIApiKeyManageModal,
	OpenAIApiKeyStartupModal,
	type OpenAIApiKeyManageReason,
} from "@/components/openai-api-key-modals";
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
	const [model, setModel] = useState("gpt-image-1");
	const [openAIApiKeyManageReason, setOpenAIApiKeyManageReason] =
		useState<OpenAIApiKeyManageReason | null>(null);
	const resumeAfterCancelRef = useRef<ResumeAfterCancel>("idle");

	const pipeline = useIconPipeline();
	const prevPipelineStatusRef = useRef(pipeline.status);

	useEffect(() => {
		invoke<{ openai_key_required: boolean; has_openai_key: boolean }>(
			"get_openai_api_key_status",
		)
			.then((s) => {
				if (s.openai_key_required === true && s.has_openai_key !== true) {
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
		pipeline.generate(prompt, model, referenceImage);
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
					onSaved={() => setOpenAIApiKeyStartupOpen(false)}
				/>
			)}
			{openAIApiKeyManageReason !== null && (
				<OpenAIApiKeyManageModal
					key={openAIApiKeyManageReason}
					reason={openAIApiKeyManageReason}
					onClose={(saved) => {
						setOpenAIApiKeyManageReason(null);
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

			{/* Save button — top right corner. */}
			<div className="absolute top-3 right-3 z-50 app-no-drag">
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
			<div className="flex-1 flex flex-col items-center justify-center gap-6 px-10">
				{/* Model selector — above icon preview. */}
				<div className="flex justify-center app-no-drag">
					<div className="flex items-center gap-1 rounded-full border border-border bg-secondary/30 p-0.5">
						<button
							onClick={() => setModel("gpt-image-1")}
							disabled={iconState === "generating"}
							className={cn(
								"px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
								model === "gpt-image-1"
									? "bg-primary text-primary-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
								iconState === "generating" && "opacity-50 cursor-not-allowed",
							)}
						>
							gpt-image-1
						</button>
						<button
							onClick={() => setModel("gpt-image-2")}
							disabled={iconState === "generating"}
							className={cn(
								"px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
								model === "gpt-image-2"
									? "bg-primary text-primary-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
								iconState === "generating" && "opacity-50 cursor-not-allowed",
							)}
						>
							gpt-image-2
						</button>
					</div>
				</div>

				{/* Icon preview — centered. */}
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
