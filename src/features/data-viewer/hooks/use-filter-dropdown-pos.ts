import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";

// Anchors a filter dropdown below its trigger button using position:fixed.
// • Closes the dropdown when the user scrolls (prevents "gobbling" caused by
//   updating state on every scroll event and triggering repeated re-renders).
// • After the dropdown renders, flips it above the button if it would overflow
//   the viewport at the bottom.
export function useFilterDropdownPos(open: boolean, onClose: () => void) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const flippedRef = useRef(false);
  const [style, setStyle] = useState<React.CSSProperties | undefined>(undefined);

  // Snapshot the button position when the caller is about to open the dropdown.
  function capturePos() {
    if (!btnRef.current) return;
    flippedRef.current = false;
    const rect = btnRef.current.getBoundingClientRect();
    setStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left: rect.left,
      bottom: "auto",
      transform: "none",
    });
  }

  // Close on scroll instead of chasing the button — chasing causes a state
  // update on every scroll frame, which makes the dropdown visually "gobble".
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", onClose, true);
    return () => window.removeEventListener("scroll", onClose, true);
  }, [open, onClose]);

  // After the dropdown renders, check if it overflows the viewport at the
  // bottom. If so, flip it above the button. Guard with flippedRef so we only
  // flip once per open cycle and avoid an infinite setState loop.
  useLayoutEffect(() => {
    if (!open || flippedRef.current || !dropRef.current || !btnRef.current) return;
    const btnRect = btnRef.current.getBoundingClientRect();
    const dropH = dropRef.current.getBoundingClientRect().height;
    if (btnRect.bottom + 8 + dropH > window.innerHeight) {
      flippedRef.current = true;
      setStyle({
        position: "fixed",
        top: "auto",
        bottom: window.innerHeight - btnRect.top + 8,
        left: btnRect.left,
        transform: "none",
      });
    }
  }, [open]);

  return { btnRef, dropRef, style, capturePos };
}
