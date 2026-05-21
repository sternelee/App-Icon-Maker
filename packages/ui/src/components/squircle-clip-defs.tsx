import { SQUICLE_PATH_01 } from "@app-icon-maker/utils";

export function SquircleClipDefs() {
  return (
    <svg width="0" height="0" className="absolute overflow-hidden" aria-hidden>
      <defs>
        <clipPath
          id="iconmaker-squircle-clip"
          clipPathUnits="objectBoundingBox"
        >
          <path d={SQUICLE_PATH_01} />
        </clipPath>
      </defs>
    </svg>
  );
}
