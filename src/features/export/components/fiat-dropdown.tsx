import { memo, useEffect, useRef, useState } from "react";
import { FIAT_OPTIONS } from "../config/currencies";
import type { ExtraFiatCurrency } from "../types";

interface FiatDropdownProps {
  value: ExtraFiatCurrency;
  onChange: (currency: ExtraFiatCurrency) => void;
}

export const FiatDropdown = memo(function FiatDropdown({ value, onChange }: FiatDropdownProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = FIAT_OPTIONS.filter(({ currency, label }) => {
    const q = filter.toLowerCase();
    return !q || currency.toLowerCase().includes(q) || label.toLowerCase().includes(q);
  });

  useEffect(() => {
    setFocusedIndex(-1);
  }, [filter, open]);

  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>("[role='option']");
    items[focusedIndex]?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent): void => {
      if (!wrapRef.current || wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function close(): void {
    setOpen(false);
    setFilter("");
  }

  function selectOption(currency: string): void {
    onChange(currency as ExtraFiatCurrency);
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, -1));
      return;
    }
    if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      const item = filtered[focusedIndex];
      if (item) selectOption(item.currency);
    }
  }

  return (
    <span className="fiat-dropdown-wrap" ref={wrapRef}>
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
        <div
          className="fiat-dropdown-menu"
          role="listbox"
          aria-label="Extra fiat currency"
          ref={listRef}
        >
          <input
            className="fiat-dropdown-search"
            type="text"
            placeholder="Search currency..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            aria-label="Search currencies"
          />
          {filtered.map(({ currency, label }, idx) => (
            <div
              key={currency}
              role="option"
              aria-selected={value === currency}
              className={`fiat-dropdown-option ${value === currency ? "selected" : ""} ${focusedIndex === idx ? "focused" : ""}`}
              onClick={() => selectOption(currency)}
              onMouseEnter={() => setFocusedIndex(idx)}
            >
              <span className="fiat-option-title">{currency}</span>
              <span className="fiat-option-sub">{label}</span>
              {value === currency && <span className="fiat-option-check">✓</span>}
            </div>
          ))}
        </div>
      )}
    </span>
  );
});
