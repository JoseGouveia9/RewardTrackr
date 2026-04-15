import { useRef, useState } from "react";
import type React from "react";
import { useOutsideClick } from "../hooks/use-outside-click";

// Wraps column-filter content in a toggle button + absolute dropdown.
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
  useOutsideClick(ref, () => setOpen(false), open);

  return (
    <div ref={ref} className="dv-column-filter">
      <button
        type="button"
        className={`dv-column-filter-button${active ? " dv-column-filter-button--active" : ""}`}
        onClick={() => setOpen((o) => !o)}
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
      {open && <div className="dv-column-filter-dropdown">{children}</div>}
    </div>
  );
}
