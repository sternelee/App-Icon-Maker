import { useRef, type KeyboardEvent } from "react";
import { IconFace } from "./icon-face";
import {
  ICON_CLIP_FILTER_BASE,
  SQUICLE_PATH_100,
  appIconShapeClip,
} from "@app-icon-maker/utils";

export function VariantPicker({
  selected,
  onSelect,
  variants,
}: {
  selected: number | null;
  onSelect: (i: number) => void;
  variants: (string | null)[];
}) {
  const iconPx = 144;
  const selectionRingPx = 4;
  const cellPx = iconPx + selectionRingPx;
  const vbPad = (selectionRingPx / 2) * (100 / iconPx);
  const viewBoxVb = `${-vbPad} ${-vbPad} ${100 + 2 * vbPad} ${100 + 2 * vbPad}`;
  const ringStrokeVb = String((selectionRingPx * 100) / iconPx);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move selection like a radio group, following focus.
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (i + 1) % 3;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (i + 2) % 3;
    }
    if (next !== null) {
      e.preventDefault();
      onSelect(next);
      refs.current[next]?.focus();
    }
  };

  return (
    <div className="flex gap-8" role="radiogroup" aria-label="Generated variants">
      {[0, 1, 2].map((i) => {
        const isSelected = selected === i;
        const src = variants[i];
        return (
          <button
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="group relative flex items-center justify-center overflow-visible rounded-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`Variant ${i + 1}${src ? "" : " (empty)"}`}
            style={{
              width: cellPx,
              height: cellPx,
              filter: ICON_CLIP_FILTER_BASE,
            }}
          >
            <div
              className="relative z-0 shrink-0 overflow-hidden"
              style={{
                width: iconPx,
                height: iconPx,
                ...appIconShapeClip,
              }}
            >
              <IconFace state="generated" src={src} />
            </div>
            {!isSelected && (
              <svg
                className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                viewBox={viewBoxVb}
                preserveAspectRatio="none"
                overflow="visible"
                aria-hidden
              >
                <path
                  d={SQUICLE_PATH_100}
                  fill="none"
                  stroke="rgb(156, 163, 175)"
                  strokeWidth={ringStrokeVb}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {isSelected && (
              <svg
                className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
                viewBox={viewBoxVb}
                preserveAspectRatio="none"
                overflow="visible"
                aria-hidden
              >
                <path
                  d={SQUICLE_PATH_100}
                  fill="none"
                  stroke="white"
                  strokeWidth={ringStrokeVb}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
