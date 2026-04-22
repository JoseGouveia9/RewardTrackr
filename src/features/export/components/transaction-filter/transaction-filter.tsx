import { memo } from "react";
import { TX_CHECKBOX_OPTIONS } from "../../config/wallet-types";

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
          <path d="M3 6h18" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
        </svg>
        Transactions Filter
      </p>
      <div className="transaction-filter-grid">
        {TX_CHECKBOX_OPTIONS.map((opt) => {
          const checked = opt.fromTypes.every((ft) => selectedTxFromTypes.includes(ft));
          return (
            <label key={opt.label} className="transaction-filter-item">
              <span className="transaction-filter-label">{opt.label}</span>
              <input
                type="checkbox"
                className="toggle-switch"
                checked={checked}
                onChange={(e) => onToggleTxType(opt.fromTypes, e.target.checked)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
});
