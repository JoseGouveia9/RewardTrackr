import { useEffect, useLayoutEffect, useRef } from "react";
import type React from "react";

// Structural style applied via React — top/left are never included here so
// React reconciliation can never fight with our DOM writes.
const DROP_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "auto",
  transform: "none",
};

// Anchors a filter dropdown directly below its trigger button using
// position:fixed. The caller renders the dropdown via a portal so it is never
// clipped by an overflow:auto ancestor.
//
// Position strategy:
//  • useLayoutEffect: writes initial top/left before first paint (no flash).
//  • scroll/resize listeners: rAF-throttled DOM write on actual movement only.
//    No continuous polling → no forced layout every frame → no shaking.
export function useFilterDropdownPos(open: boolean) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  function syncPos() {
    if (!btnRef.current || !dropRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    dropRef.current.style.top = `${r.bottom + 8}px`;
    dropRef.current.style.left = `${r.left}px`;
  }

  // Set position before first paint so the dropdown never flashes at (0,0).
  useLayoutEffect(() => {
    if (!open) return;
    syncPos();
  }, [open]);

  // While open, re-sync on any scroll or resize. rAF throttle ensures at most
  // one DOM write per frame regardless of how many events fire.
  useEffect(() => {
    if (!open) return;

    function schedule() {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        syncPos();
      });
    }

    // capture:true catches scroll on any inner scrollable element (e.g. the
    // horizontally-scrolling table wrapper) not just window scroll.
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [open]);

  // capturePos kept for API compatibility — position is now handled by effects.
  function capturePos() {}

  return { btnRef, dropRef, style: DROP_STYLE, capturePos };
}
