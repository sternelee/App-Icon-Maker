import { useCallback, useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** True when the message likely indicates a bad or unauthorized API key. */
export function generationErrorSuggestsApiKeyIssue(message: string): boolean {
	const m = message.toLowerCase();
	// HTTP status codes
	if (/\b401\b/.test(m) || /\b403\b/.test(m)) return true;
	// OpenAI specific
	if (m.includes("invalid_api_key")) return true;
	if (m.includes("incorrect api key")) return true;
	if (m.includes("invalid bearer")) return true;
	if (m.includes("unauthorized")) return true;
	if (m.includes("authentication") && m.includes("openai")) return true;
	// Gemini specific
	if (m.includes("api_key_invalid")) return true;
	if (m.includes("api_key_service_not_activated")) return true;
	if (m.includes("permission_denied")) return true;
	if (m.includes("not allowed to use this model")) return true;
	if (m.includes("google api key") && m.includes("invalid")) return true;
	// Generic
	if (
		m.includes("api key") &&
		(m.includes("invalid") ||
			m.includes("incorrect") ||
			m.includes("expired") ||
			m.includes("revoked") ||
			m.includes("not found"))
	)
		return true;
	return false;
}

export function ErrorModal({
	message,
	onClose,
	onUpdateApiKey,
}: {
	message: string;
	onClose: () => void;
	/** When set, shows a primary action to replace the stored OpenAI key. */
	onUpdateApiKey?: () => void;
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(message).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}, [message]);

	useEffect(() => {
		const onKey = (e: globalThis.KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className="relative w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-border bg-background shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
					<span className="text-sm font-medium text-destructive">
						Generation failed
					</span>
					<button
						onClick={onClose}
						className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="px-4 py-3">
					<pre
						className={cn(
							"text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all",
							"max-h-52 overflow-y-auto select-text",
						)}
						style={{
							scrollbarWidth: "thin",
							scrollbarColor: "rgba(255,255,255,0.15) transparent",
						}}
					>
						{message}
					</pre>
				</div>

				<div className="flex justify-end gap-2 flex-wrap px-4 pb-4">
					<button
						type="button"
						onClick={handleCopy}
						className={cn(
							"flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-150",
							copied
								? "bg-emerald-500/20 text-emerald-400"
								: "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary",
						)}
					>
						{copied ? (
							<Check className="w-3.5 h-3.5" />
						) : (
							<Copy className="w-3.5 h-3.5" />
						)}
						{copied ? "Copied" : "Copy"}
					</button>
					<button
						type="button"
						onClick={onClose}
						className={cn(
							"h-8 px-4 rounded-lg text-xs font-medium transition-colors",
							onUpdateApiKey
								? "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
								: "bg-primary text-primary-foreground hover:bg-primary/90",
						)}
					>
						Dismiss
					</button>
					{onUpdateApiKey && (
						<button
							type="button"
							onClick={onUpdateApiKey}
							className="h-8 px-4 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							Update API key
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
