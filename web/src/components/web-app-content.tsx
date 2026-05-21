import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
	MacOSIcon,
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
	generationErrorSuggestsApiKeyIssue,
} from "@app-icon-maker/ui";
import {
	type Provider,
	useIconPipeline,
	MODEL_LIST,
	getDefaultModel,
	useAppWorkflow,
} from "@app-icon-maker/utils";
import { createWebTransport } from "../lib/web-transport";
import { hasApiKey } from "../lib/api-key-manager";
import { WebApiKeyModal } from "./web-api-key-modals";

const transport = createWebTransport((provider) => {
	// Inline simple getApiKey to avoid circular import issues with api-key-manager
	const keys: Record<string, string> = {
		openai: "app-icon-maker:api-key:openai",
		gemini: "app-icon-maker:api-key:gemini",
		openrouter: "app-icon-maker:api-key:openrouter",
		fal: "app-icon-maker:api-key:fal",
	};
	return localStorage.getItem(keys[provider] || "") || null;
});

export function WebAppContent() {
	const [provider, setProvider] = useState<Provider>(() => {
		return (localStorage.getItem("web:provider") as Provider) || "openai";
	});
	const [model, setModel] = useState(() => {
		return localStorage.getItem("web:model") || "gpt-image-1";
	});
	const pipeline = useIconPipeline(transport);
	const wf = useAppWorkflow(pipeline, model, provider);

	const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
	const [showApiKeyModal, setShowApiKeyModal] = useState(false);
	const [falCustom, setFalCustom] = useState(false);
	const [falInput, setFalInput] = useState("");

	useEffect(() => {
		const providers: Provider[] = ["openai", "gemini", "openrouter", "fal"];
		if (!providers.some((p) => hasApiKey(p))) {
			setShowApiKeyModal(true);
		}
	}, []);

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

		const response = await fetch(rawSrc);
		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `app-icon.${format === "jpeg" ? "jpg" : format}`;
		a.click();
		URL.revokeObjectURL(url);
		setSaveSuccess(true);
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
				/>
			)}

			{saveSuccess && (
				<SaveSuccessModal
					folderPath="Downloads"
					icnsPath=""
					onClose={() => setSaveSuccess(false)}
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

			<div className="flex items-center px-4 pt-3">
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

			<div className="flex-1 flex flex-col items-center justify-center px-10">
				<MacOSIcon
					state={wf.iconState}
					selected={wf.selectedVariant}
					onSelect={wf.setSelectedVariant}
					variants={pipeline.variants}
					baseIconSrc={wf.baseIconSrc}
				/>
			</div>

			<div className="flex flex-col items-center px-4 pb-6">
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
				/>
			</div>
		</div>
	);
}
