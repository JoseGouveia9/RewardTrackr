import { useLayoutEffect, useRef } from "react";
import type React from "react";

const DROP_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "auto",
  transform: "none",
};

// Anchors a filter dropdown directly below its trigger button.
// Position is written synchronously via useLayoutEffect before the first paint
// so the dropdown appears immediately with no flash or delay.
// The table header is sticky, so the button stays visible during scroll and
// the dropdown always opens near the top of the viewport — no tracking needed.
export function useFilterDropdownPos(open: boolean) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !dropRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    dropRef.current.style.top = `${Math.round(r.bottom + 8)}px`;
    dropRef.current.style.left = `${Math.round(r.left)}px`;
  }, [open]);

  function capturePos() {}

  return { btnRef, dropRef, floatingRef: dropRef, style: DROP_STYLE, capturePos };
}
