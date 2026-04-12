import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { useFilterDropdownPos } from "../hooks/use-filter-dropdown-pos";

// Wraps column-filter content in a toggle button + anchored dropdown that
// closes on outside click. The dropdown is rendered via a portal to
// document.body so it is never clipped by an overflow:auto ancestor.
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
  const { btnRef, dropRef, style, capturePos } = useFilterDropdownPos(open);

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
        <div ref={dropRef} className="dv-col-filter-dropdown" style={style}>
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
