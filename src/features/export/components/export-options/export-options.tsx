import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TransactionFilter } from "../transaction-filter/transaction-filter";
import { WalletPricingOptions } from "../wallet-pricing-options/wallet-pricing-options";
import { ExtraFiatOptions } from "../extra-fiat-options/extra-fiat-options";
import type { ExtraFiatCurrency, RewardKey } from "../../types";
import "./export-options.css";

const popVariants = {
  initial: { opacity: 0, scale: 0.95, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22 } },
  exit: { opacity: 0, scale: 0.95, y: -6, transition: { duration: 0.32 } },
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
      <AnimatePresence mode="popLayout">
        {selectedKeys.includes("transactions") && (
          <motion.section
            key="tx-filter"
            className="panel-glass"
            variants={popVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            layout
            transition={{ layout: { type: "spring", stiffness: 220, damping: 28 } }}
            style={{ overflow: "clip", isolation: "isolate" }}
          >
            <TransactionFilter
              selectedTxFromTypes={selectedTxFromTypes}
              onToggleTxType={onToggleTxType}
            />
          </motion.section>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {walletSheetsSelected && (
          <motion.section
            key="wallet-pricing"
            className="panel-glass"
            variants={popVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            layout="position"
            transition={{ layout: { type: "spring", stiffness: 220, damping: 28 } }}
            style={{ overflow: "clip" }}
          >
            <WalletPricingOptions
              includeWalletFiat={includeWalletFiat}
              onToggle={onToggleWalletFiat}
            />
          </motion.section>
        )}
      </AnimatePresence>
      <motion.section
        className="panel-glass"
        layout
        transition={{ layout: { type: "spring", stiffness: 220, damping: 28 } }}
      >
        <ExtraFiatOptions
          includeExcelFiat={includeExcelFiat}
          onToggle={onToggleExcelFiat}
          currency={excelFiatCurrency}
          onChangeCurrency={onChangeFiatCurrency}
        />
      </motion.section>
    </>
  );
});
