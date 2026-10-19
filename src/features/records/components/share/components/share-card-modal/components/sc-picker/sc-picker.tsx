import { useEffect, useRef, useState } from "react";

export function ScPicker({
  value,
  options,
  onChange,
  hidden = false,
}: {
  value: string | number;
  options: Array<{ label: string; value: string | number }>;
  onChange: (value: string | number) => void;
  hidden?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className={`sc-picker${hidden ? " sc-picker--hidden" : ""}`}>
      <button
        type="button"
        className="sc-picker-trigger"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label ?? "—"}</span>
        <span className={`sc-picker-caret${open ? " sc-picker-caret--open" : ""}`}>▾</span>
      </button>
      {open && (
        <ul className="sc-picker-menu" role="listbox">
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`sc-picker-option${option.value === value ? " sc-picker-option--selected" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
