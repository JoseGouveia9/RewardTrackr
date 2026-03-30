import { useEffect, useRef, useState } from "react";
import type React from "react";

/** Tracks the trigger button's position so a filter dropdown can be anchored above it via fixed positioning. */
export function useFilterDropdownPos(open: boolean) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  /** Captures the button's current bounding rect on demand (call before opening the dropdown). */
  function capturePos() {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }
  useEffect(() => {
    if (!open) return;
    function update() {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    }
    window.addEventListener("scroll", update, true);
    return () => window.removeEventListener("scroll", update, true);
  }, [open]);
  const style: React.CSSProperties | undefined = rect
    ? {
        position: "fixed",
        top: rect.top - 8,
        left: rect.left,
        bottom: "auto",
        transform: "translateY(-100%)",
      }
    : undefined;
  return { btnRef, style, capturePos };
}
