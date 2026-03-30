import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TransactionFilter } from "./transaction-filter";
import { WalletPricingOptions } from "./wallet-pricing-options";
import { ExtraFiatOptions } from "./extra-fiat-options";
import type { ExtraFiatCurrency, RewardKey } from "../types";
import "./export-options.css";

const popVariants = {
  initial: { opacity: 0, scale: 0.95, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.18 } },
  exit: { opacity: 0, scale: 0.95, y: -6, transition: { duration: 0.14 } },
};

interface ExportOptionsProps {
  selectedKeys: RewardKey[];
  walletSheetsSelected: boolean;
  selectedTxFromTypes: string[];
  onToggleTxType: (fromTypes: string[], checked: boolean) => void;
  includeWalletFiat: boolean;
  onToggleWalletFiat: (checked: boolean) => void;
  includeExcelFiat: boolean;
  onToggleExcelFiat: (checked: boolean) => void;
  excelFiatCurrency: ExtraFiatCurrency;
  onChangeFiatCurrency: (v: ExtraFiatCurrency) => void;
}

/** Renders the animated export options panels (transaction filter, wallet pricing, extra fiat). */
export const ExportOptions = memo(function ExportOptions({
  selectedKeys,
  walletSheetsSelected,
  selectedTxFromTypes,
  onToggleTxType,
  includeWalletFiat,
  onToggleWalletFiat,
  includeExcelFiat,
  onToggleExcelFiat,
  excelFiatCurrency,
  onChangeFiatCurrency,
}: ExportOptionsProps) {
  return (
    <>
      <AnimatePresence>
        {selectedKeys.includes("transactions") && (
          <motion.section
            key="tx-filter"
            className="panel-glass"
            variants={popVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <TransactionFilter
              selectedTxFromTypes={selectedTxFromTypes}
              onToggleTxType={onToggleTxType}
            />
          </motion.section>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {walletSheetsSelected && (
          <motion.section
            key="wallet-pricing"
            className="panel-glass"
            variants={popVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <WalletPricingOptions
              includeWalletFiat={includeWalletFiat}
              onToggle={onToggleWalletFiat}
            />
          </motion.section>
        )}
      </AnimatePresence>
      <section className="panel-glass">
        <ExtraFiatOptions
          includeExcelFiat={includeExcelFiat}
          onToggle={onToggleExcelFiat}
          currency={excelFiatCurrency}
          onChangeCurrency={onChangeFiatCurrency}
        />
      </section>
    </>
  );
});
