import { useRef, useState } from "react";
import type React from "react";
import { useOutsideClick } from "../../hooks/use-outside-click";
import { FilterIcon } from "../icons";

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
        <FilterIcon />
        {label}
      </button>
      {open && <div className="dv-column-filter-dropdown">{children}</div>}
    </div>
  );
}
