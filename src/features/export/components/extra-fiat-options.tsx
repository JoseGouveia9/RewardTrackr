import { memo } from "react";
import { FiatDropdown } from "./fiat-dropdown";
import type { ExtraFiatCurrency } from "../types";

interface ExtraFiatOptionsProps {
  includeExcelFiat: boolean;
  onToggle: (checked: boolean) => void;
  currency: ExtraFiatCurrency;
  onChangeCurrency: (v: ExtraFiatCurrency) => void;
}

/** Renders the extra fiat conversion toggle and currency selector for the Excel export. */
export const ExtraFiatOptions = memo(function ExtraFiatOptions({
  includeExcelFiat,
  onToggle,
  currency,
  onChangeCurrency,
}: ExtraFiatOptionsProps) {
  return (
    <div className="excel-options">
      <p className="options-section-title">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
        Extra Fiat Conversion
      </p>
      <div className="fiat-grid">
        <label className="wallet-option-row">
          Include extra conversion column (USD is always included)
          <input
            type="checkbox"
            className="toggle-switch"
            checked={includeExcelFiat}
            onChange={(e) => onToggle(e.target.checked)}
          />
        </label>
        {includeExcelFiat && (
          <label className="wallet-option-row wallet-currency-row">
            Currency
            <FiatDropdown value={currency} onChange={onChangeCurrency} />
          </label>
        )}
      </div>
    </div>
  );
});
