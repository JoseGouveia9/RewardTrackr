import { useEffect, useLayoutEffect, useRef } from "react";
import type React from "react";

// Structural style applied via React — top/left are never included here so
// React reconciliation can't fight with the DOM writes below.
const DROP_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "auto",
  transform: "none",
};

// Anchors a filter dropdown directly below its trigger button using
// position:fixed. The caller renders the dropdown via a portal so it is never
// clipped by an overflow:auto ancestor.
//
// • useLayoutEffect — writes initial top/left before first paint (no flash).
// • rAF loop        — updates top/left every frame via direct DOM writes.
//                     No setState → React never touches top/left → no fighting.
//                     Math.round() snaps to integer px to kill sub-pixel jitter.
export function useFilterDropdownPos(open: boolean) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  function syncPos() {
    if (!btnRef.current || !dropRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    dropRef.current.style.top = `${Math.round(r.bottom + 8)}px`;
    dropRef.current.style.left = `${Math.round(r.left)}px`;
  }

  // Set position before first paint so the dropdown never flashes at (0,0).
  useLayoutEffect(() => {
    if (!open) return;
    syncPos();
  }, [open]);

  // While open, sync position on every animation frame so the dropdown
  // follows the button with zero lag during scroll.
  useEffect(() => {
    if (!open) return;

    function tick() {
      syncPos();
      rafIdRef.current = requestAnimationFrame(tick);
    }

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [open]);

  // capturePos kept for API compatibility with callers.
  function capturePos() {}

  return { btnRef, dropRef, style: DROP_STYLE, capturePos };
}
