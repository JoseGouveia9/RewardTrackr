import { useLayoutEffect, useRef } from "react";
import type React from "react";

// Structural style applied via React — top/left are never in here so React
// reconciliation can't interfere with the DOM writes below.
const DROP_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "auto",
  transform: "none",
};

// Anchors a filter dropdown directly below its trigger button using
// position:fixed. The caller renders the dropdown via a portal so it is never
// clipped by an overflow:auto ancestor.
//
// Position is written once, synchronously before the first paint, then never
// touched again. position:fixed keeps it stable in the viewport regardless of
// any scrolling — no listeners, no polling, no shaking.
export function useFilterDropdownPos(open: boolean) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Write initial position before first paint so the dropdown appears exactly
  // below the button with no flash or jump.
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !dropRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    dropRef.current.style.top = `${r.bottom + 8}px`;
    dropRef.current.style.left = `${r.left}px`;
  }, [open]);

  // capturePos kept for API compatibility with callers.
  function capturePos() {}

  return { btnRef, dropRef, style: DROP_STYLE, capturePos };
}
