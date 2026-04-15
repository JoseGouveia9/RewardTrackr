import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiatDropdown } from "./fiat-dropdown";
import type { ExtraFiatCurrency } from "../types";

const rowLayoutSpring = {
  layout: { type: "spring" as const, stiffness: 220, damping: 28 },
};

interface ExtraFiatOptionsProps {
  includeExcelFiat: boolean;
  onToggle: (checked: boolean) => void;
  currency: ExtraFiatCurrency;
  onChangeCurrency: (v: ExtraFiatCurrency) => void;
}

// Renders the extra fiat conversion toggle and currency selector for the Excel export.
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
      <motion.div className="fiat-grid" layout transition={rowLayoutSpring}>
        <motion.label className="wallet-option-row" layout="position" transition={rowLayoutSpring}>
          Include extra conversion column (USD is always included)
          <input
            type="checkbox"
            className="toggle-switch"
            checked={includeExcelFiat}
            onChange={(e) => onToggle(e.target.checked)}
          />
        </motion.label>
        <AnimatePresence mode="sync">
          {includeExcelFiat && (
            <motion.div
              key="wallet-currency-row"
              className="wallet-option-row wallet-currency-row"
              initial={{ opacity: 0, x: 24, maxWidth: 0 }}
              animate={{
                opacity: 1,
                x: 0,
                maxWidth: 240,
                transition: { duration: 0.2, ease: "easeOut" },
              }}
              exit={{
                opacity: 0,
                x: 24,
                maxWidth: 0,
                transition: { duration: 0.14, ease: "easeIn" },
              }}
            >
              Currency
              <FiatDropdown value={currency} onChange={onChangeCurrency} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
});
