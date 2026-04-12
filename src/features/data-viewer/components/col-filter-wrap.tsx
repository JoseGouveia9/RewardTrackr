import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { useTheme } from "@/app/theme-context";
import { useFilterDropdownPos } from "../hooks/use-filter-dropdown-pos";

// Wraps column-filter content in a toggle button + anchored dropdown that
// closes on outside click. The dropdown is rendered via a portal to
// document.body so it is never clipped by an overflow:auto ancestor (which
// causes position:fixed children to be cut on iOS Safari).
export function ColFilterWrap({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { btnRef, dropRef, style, capturePos } = useFilterDropdownPos();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        ref.current && !ref.current.contains(target) &&
        dropRef.current && !dropRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="dv-col-filter">
      <button
        ref={btnRef}
        type="button"
        className={`dv-col-filter-btn${active ? " dv-col-filter-btn--active" : ""}`}
        onClick={() => {
          if (!open) capturePos();
          setOpen((o) => !o);
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {label}
      </button>
      {open && createPortal(
        // display:contents erases the wrapper's own box so it takes no space,
        // but the page/theme-dark classes are still visible to CSS selectors,
        // giving portal children the same dark-mode styles as in-page elements.
        <div
          className={`page ${theme === "dark" ? "theme-dark" : "theme-light"}`}
          style={{ display: "contents" }}
        >
          <div ref={dropRef} className="dv-col-filter-dropdown" style={style}>
            {children}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
