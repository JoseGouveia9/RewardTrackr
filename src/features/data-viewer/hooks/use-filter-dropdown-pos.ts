import { useEffect, useLayoutEffect, useRef } from "react";
import type React from "react";

// Base style applied via React — only structural props, never top/left.
// top/left are owned exclusively by the rAF loop and useLayoutEffect so
// React reconciliation can never override them and cause a 1-frame flicker.
const DROP_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "auto",
  transform: "none",
};

// Returns refs and a stable style for anchoring a filter dropdown directly
// below its trigger button. The caller renders the dropdown via a portal so
// it is never clipped by an overflow:auto ancestor.
//
// Initial position is written via useLayoutEffect (sync, before first paint).
// Ongoing position is tracked by a requestAnimationFrame loop that writes
// directly to the DOM — no React state updates, so no re-renders, no shaking.
export function useFilterDropdownPos(open: boolean) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Sync position before first paint so the dropdown never appears at (0,0).
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !dropRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    dropRef.current.style.top = `${r.bottom + 8}px`;
    dropRef.current.style.left = `${r.left}px`;
  }, [open]);

  // While open, keep position in sync via rAF direct DOM writes.
  // No setState → no React re-renders → no shaking.
  useEffect(() => {
    if (!open) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    function tick() {
      if (btnRef.current && dropRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        dropRef.current.style.top = `${r.bottom + 8}px`;
        dropRef.current.style.left = `${r.left}px`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [open]);

  // capturePos kept for API compatibility — position is now handled by effects.
  function capturePos() {}

  return { btnRef, dropRef, style: DROP_STYLE, capturePos };
}
