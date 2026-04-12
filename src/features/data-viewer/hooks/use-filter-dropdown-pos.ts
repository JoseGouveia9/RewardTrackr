import { useEffect, useRef, useState } from "react";
import type React from "react";

// Returns refs and a style for anchoring a filter dropdown directly below its
// trigger button using position:fixed. The caller renders the dropdown via a
// portal to document.body so it is never clipped by an overflow:auto ancestor.
//
// Position is captured via React state on open (for the first render), then
// kept in sync via a requestAnimationFrame loop that writes directly to the
// DOM — no React state updates on each frame, so no shaking or re-renders.
export function useFilterDropdownPos(open: boolean) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties | undefined>(undefined);
  const rafRef = useRef<number | null>(null);

  // Snapshot position below button via React state (used for the first render).
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

  // While open, keep the dropdown anchored under the button via direct DOM
  // writes on every animation frame. This bypasses React re-renders entirely,
  // so the dropdown tracks the button smoothly as the page or table scrolls.
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

  return { btnRef, dropRef, style, capturePos };
}
