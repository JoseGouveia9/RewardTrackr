import { useLayoutEffect, useRef } from "react";
import type React from "react";

// Structural style applied via React — top/left are never included here so
// React reconciliation can't interfere with the DOM writes below.
const DROP_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "auto",
  transform: "none",
};

// Anchors a filter dropdown directly below its trigger button using
// position:fixed. The caller renders the dropdown via a portal so it is never
// clipped by an overflow:auto ancestor.
//
// Position is written once via useLayoutEffect before the first paint —
// the dropdown appears exactly under the button with no flash. After that,
// position:fixed keeps it stable in the viewport; it does not chase the
// button during scroll (chasing requires reading getBoundingClientRect on
// every frame, which lags on iOS because the compositor runs ahead of JS).
export function useFilterDropdownPos(open: boolean) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !dropRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    dropRef.current.style.top = `${Math.round(r.bottom + 8)}px`;
    dropRef.current.style.left = `${Math.round(r.left)}px`;
  }, [open]);

  // capturePos kept for API compatibility with callers.
  function capturePos() {}

  return { btnRef, dropRef, style: DROP_STYLE, capturePos };
}
