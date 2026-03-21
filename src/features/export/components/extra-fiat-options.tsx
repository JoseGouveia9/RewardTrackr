import { memo } from "react";
import { FiatDropdown } from "./fiat-dropdown";
import type { ExtraFiatCurrency } from "../types";

interface ExtraFiatOptionsProps {
  includeExcelFiat: boolean;
  onToggle: (checked: boolean) => void;
  currency: ExtraFiatCurrency;
  onChangeCurrency: (v: ExtraFiatCurrency) => void;
}

export const ExtraFiatOptions = memo(function ExtraFiatOptions({
  includeExcelFiat,
  onToggle,
  currency,
  onChangeCurrency,
}: ExtraFiatOptionsProps) {
  return (
    <div className="excel-options">
      <p className="wallet-options-title">Extra Fiat Conversion</p>
      <label className="wallet-option-row">
        <input
          type="checkbox"
          className="toggle-switch"
          checked={includeExcelFiat}
          onChange={(e) => onToggle(e.target.checked)}
        />
        Include extra conversion column (USD is always included)
      </label>
      {includeExcelFiat && (
        <label className="wallet-option-row wallet-currency-row">
          Currency
          <FiatDropdown value={currency} onChange={onChangeCurrency} />
        </label>
      )}
    </div>
  );
});
