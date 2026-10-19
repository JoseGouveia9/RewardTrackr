import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { FIAT_OPTIONS } from "@/config/currencies";
import "./fiat-dropdown.css";
import type { ExtraFiatCurrency } from "@/types/rewards";

interface FiatDropdownProps {
  value: ExtraFiatCurrency;
  onChange: (currency: ExtraFiatCurrency) => void;
}

export const FiatDropdown = memo(function FiatDropdown({ value, onChange }: FiatDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [menuThemeClass, setMenuThemeClass] = useState<"theme-light" | "theme-dark">("theme-light");
  const [menuAnchor, setMenuAnchor] = useState<{ left: number; top: number; width: number } | null>(
    null,
  );
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuAnchor = useCallback(() => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setMenuAnchor({ left: rect.left, top: rect.top - 8, width: rect.width });
  }, []);

  const updateMenuThemeClass = useCallback(() => {
    const pageElement = wrapRef.current?.closest(".page");
    setMenuThemeClass(pageElement?.classList.contains("theme-dark") ? "theme-dark" : "theme-light");
  }, []);

  const filtered = FIAT_OPTIONS.filter(({ currency, label }) => {
    const query = filter.toLowerCase();
    return !query || currency.toLowerCase().includes(query) || label.toLowerCase().includes(query);
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
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    updateMenuAnchor();
    updateMenuThemeClass();

    const handleViewportChange = () => updateMenuAnchor();

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updateMenuAnchor, updateMenuThemeClass]);

  function close(): void {
    setOpen(false);
    setFilter("");
  }

  function selectOption(currency: string): void {
    onChange(currency as ExtraFiatCurrency);
    close();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((previous) => Math.min(previous + 1, filtered.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((previous) => Math.max(previous - 1, -1));
      return;
    }
    if (event.key === "Enter" && focusedIndex >= 0) {
      event.preventDefault();
      const item = filtered[focusedIndex];
      if (item) selectOption(item.currency);
    }
  }

  const menu =
    open && menuAnchor
      ? createPortal(
          <div
            className={`fiat-dropdown-menu fiat-dropdown-menu-portal ${menuThemeClass}`}
            role="listbox"
            aria-label={t("export.extraFiatCurrency")}
            ref={(element) => {
              listRef.current = element;
              menuRef.current = element;
            }}
            style={{
              left: menuAnchor.left,
              top: menuAnchor.top,
              minWidth: Math.max(300, menuAnchor.width),
            }}
          >
            <input
              className="fiat-dropdown-search"
              type="text"
              placeholder={t("export.searchCurrency")}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              aria-label={t("export.searchCurrencies")}
            />
            {filtered.map(({ currency, label }, index) => (
              <div
                key={currency}
                role="option"
                aria-selected={value === currency}
                className={`fiat-dropdown-option${focusedIndex === index ? " fiat-dropdown-option--focused" : ""}`}
                onClick={() => selectOption(currency)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <span className="fiat-option-title">{currency}</span>
                <span className="fiat-option-subtitle">{label}</span>
                {value === currency && (
                  <span className="fiat-option-check">
                    <CheckIcon size={13} />
                  </span>
                )}
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="fiat-dropdown-wrap" ref={wrapRef}>
      <button
        type="button"
        className="fiat-dropdown-trigger"
        onClick={() => {
          setOpen((wasOpen) => {
            const next = !wasOpen;
            if (next) {
              requestAnimationFrame(updateMenuAnchor);
              requestAnimationFrame(updateMenuThemeClass);
            }
            return next;
          });
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{value}</span>
        <ChevronDownIcon
          width={9}
          className={`fiat-dropdown-caret${open ? " fiat-dropdown-caret--open" : ""}`}
        />
      </button>
      {menu}
    </span>
  );
});
