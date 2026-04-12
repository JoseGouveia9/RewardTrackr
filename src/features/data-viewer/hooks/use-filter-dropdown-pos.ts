import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";

// Positions a filter dropdown below (or above) its trigger button via
// position:fixed. The dropdown is rendered via a React portal to document.body
// so it is never clipped by an overflow:auto ancestor (which causes
// position:fixed children to be cut on iOS Safari).
//
// Scroll tracking is throttled with requestAnimationFrame so the dropdown
// follows the button smoothly without causing render "gobbling".
export function useFilterDropdownPos(open: boolean) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const flippedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [style, setStyle] = useState<React.CSSProperties | undefined>(undefined);

  function makeStyle(r: DOMRect, above: boolean): React.CSSProperties {
    return above
      ? { position: "fixed", top: "auto", bottom: window.innerHeight - r.top + 8, left: r.left, transform: "none" }
      : { position: "fixed", top: r.bottom + 8, left: r.left, bottom: "auto", transform: "none" };
  }

  // Snapshot button position when called; flip is corrected in useLayoutEffect.
  function capturePos() {
    if (!btnRef.current) return;
    flippedRef.current = false;
    const r = btnRef.current.getBoundingClientRect();
    setStyle(makeStyle(r, false));
  }

  // Track button position on scroll, throttled to one update per animation
  // frame so the dropdown follows the button smoothly (no gobbling).
  useEffect(() => {
    if (!open) return;
    function onScroll() {
      if (rafRef.current !== null) return; // already scheduled this frame
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!btnRef.current) return;
        const r = btnRef.current.getBoundingClientRect();
        const dropH = dropRef.current?.getBoundingClientRect().height ?? 0;
        const above = r.bottom + 8 + dropH > window.innerHeight;
        flippedRef.current = above;
        setStyle(makeStyle(r, above));
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [open]);

  // After the dropdown renders, flip it above the button when there isn't
  // enough space below. Guard with flippedRef to avoid an infinite setState loop.
  useLayoutEffect(() => {
    if (!open || flippedRef.current || !dropRef.current || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const dropH = dropRef.current.getBoundingClientRect().height;
    if (r.bottom + 8 + dropH > window.innerHeight) {
      flippedRef.current = true;
      setStyle(makeStyle(r, true));
    }
  }, [open]);

  return { btnRef, dropRef, style, capturePos };
}
