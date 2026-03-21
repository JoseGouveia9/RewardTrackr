import { memo } from "react";
import { TX_CHECKBOX_OPTIONS } from "../config/wallet-types";

interface TransactionFilterProps {
  selectedTxFromTypes: string[];
  onToggleTxType: (fromTypes: string[], checked: boolean) => void;
}

export const TransactionFilter = memo(function TransactionFilter({
  selectedTxFromTypes,
  onToggleTxType,
}: TransactionFilterProps) {
  return (
    <div className="wallet-options">
      <p className="wallet-options-title">Transactions Filter</p>
      {TX_CHECKBOX_OPTIONS.map((opt) => {
        const checked = opt.fromTypes.every((ft) => selectedTxFromTypes.includes(ft));
        return (
          <label key={opt.label} className="wallet-option-row">
            <input
              type="checkbox"
              className="toggle-switch"
              checked={checked}
              onChange={(e) => onToggleTxType(opt.fromTypes, e.target.checked)}
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
});
