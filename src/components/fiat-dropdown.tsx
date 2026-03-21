import { useEffect, useRef, useState } from "react";
import { FIAT_OPTIONS } from "@/core/currencies";
import type { ExtraFiatCurrency } from "@/core/types";

interface FiatDropdownProps {
  value: ExtraFiatCurrency;
  onChange: (currency: ExtraFiatCurrency) => void;
}

export function FiatDropdown({ value, onChange }: FiatDropdownProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (!ref.current) return;
      if (ref.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <span className="fiat-dropdown-wrap" ref={ref}>
      <button
        type="button"
        className="fiat-dropdown-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{value}</span>
        <span className={`fiat-dropdown-caret ${open ? "open" : ""}`}>⌃</span>
      </button>

      {open && (
        <div className="fiat-dropdown-menu" role="listbox" aria-label="Extra fiat currency">
          <input
            className="fiat-dropdown-search"
            type="text"
            placeholder="Search currency..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          {FIAT_OPTIONS.filter(({ currency, label }) => {
            const q = filter.toLowerCase();
            return !q || currency.toLowerCase().includes(q) || label.toLowerCase().includes(q);
          }).map(({ currency, label }) => (
            <button
              key={currency}
              type="button"
              className={`fiat-dropdown-option ${value === currency ? "selected" : ""}`}
              onClick={() => {
                onChange(currency as ExtraFiatCurrency);
                setOpen(false);
                setFilter("");
              }}
            >
              <span className="fiat-option-title">{currency}</span>
              <span className="fiat-option-sub">{label}</span>
              {value === currency && <span className="fiat-option-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
