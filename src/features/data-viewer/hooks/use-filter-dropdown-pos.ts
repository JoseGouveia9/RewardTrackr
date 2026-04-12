import { useRef, useState } from "react";
import type React from "react";

// Returns refs and a style for anchoring a filter dropdown directly below its
// trigger button using position:fixed. The caller renders the dropdown via a
// portal to document.body so it is never clipped by an overflow:auto ancestor.
//
// Position is captured once when the dropdown opens. No scroll tracking is
// applied so the dropdown stays perfectly stable while the page scrolls
// (no shaking). The dropdown always appears below the button.
export function useFilterDropdownPos() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties | undefined>(undefined);

  function capturePos() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setStyle({
      position: "fixed",
      top: r.bottom + 8,
      left: r.left,
      bottom: "auto",
      transform: "none",
    });
  }

  return { btnRef, dropRef, style, capturePos };
}
