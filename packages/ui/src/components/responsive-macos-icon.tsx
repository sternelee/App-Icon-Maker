import { useLayoutEffect, useRef, useState } from "react";
import type { IconState } from "@app-icon-maker/utils";
import { MacOSIcon } from "./macos-icon";

// Intrinsic (unscaled) bounding box for each icon shape.
// These match the fixed pixel sizes used by IconStack / VariantPicker /
// SingleRefineIcon in their root containers, so scaling from this base
// keeps the existing visual proportions (squircle radii, scan band, etc.).
const BASE_SIZE: Record<IconState, { w: number; h: number }> = {
  idle: { w: 252, h: 150 },       // IconStack
  generating: { w: 252, h: 150 }, // IconStack (with scan-line blueprint face)
  generated: { w: 508, h: 148 },  // VariantPicker: 3 × (144+4) + 2 × 32
  refine: { w: 144, h: 144 },     // SingleRefineIcon
};

/**
 * MacOSIcon that fits its parent width.
 *
 * The icon area (icon variants + blueprint status face) is rendered at a
 * fixed pixel size by MacOSIcon, which overflows narrow phone screens and
 * gets clipped. This wrapper measures the available content width and
 * uniformly scales the icon down with CSS `transform: scale()` so the whole
 * composition (variants and the generating-state scan chart) fits and stays
 * interactive.
 */
export function ResponsiveMacOSIcon({
  state,
  selected,
  onSelect,
  variants,
  baseIconSrc,
}: {
  state: IconState;
  selected: number | null;
  onSelect: (i: number) => void;
  variants: (string | null)[];
  baseIconSrc?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Synchronous measurement so the first paint already uses the correct scale
    // (no flash of an over-sized icon).
    setContainerW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => {
      setContainerW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = BASE_SIZE[state];
  // Fit-to-width with a 2px safety margin; never upscale beyond 1×.
  const scale = containerW > 0 ? Math.min(1, (containerW - 2) / base.w) : 1;
  const visualW = base.w * scale;
  const visualH = base.h * scale;

  return (
    <div ref={ref} className="w-full flex items-center justify-center">
      {containerW > 0 && (
        <div
          style={{
            width: visualW,
            height: visualH,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: base.w,
              height: base.h,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <MacOSIcon
              state={state}
              selected={selected}
              onSelect={onSelect}
              variants={variants}
              baseIconSrc={baseIconSrc}
            />
          </div>
        </div>
      )}
    </div>
  );
}
