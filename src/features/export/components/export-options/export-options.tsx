import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { WalletPricingOptions } from "../wallet-pricing-options/wallet-pricing-options";
import { ExtraFiatOptions } from "../extra-fiat-options/extra-fiat-options";
import type { ExtraFiatCurrency, RewardKey } from "@/types/rewards";
import "./export-options.css";

const popVariants = {
  initial: { opacity: 0, scale: 0.95, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22 } },
  exit: { opacity: 0, scale: 0.95, y: -6, transition: { duration: 0.32 } },
};

interface ExportOptionsProps {
  selectedKeys: RewardKey[];
  walletSheetsSelected: boolean;
  liveMinerWarsEnabled: boolean;
  includeWalletFiat: boolean;
  onToggleLiveMinerWars: (checked: boolean) => void;
  onToggleWalletFiat: (checked: boolean) => void;
  includeExcelFiat: boolean;
  onToggleExcelFiat: (checked: boolean) => void;
  excelFiatCurrency: ExtraFiatCurrency;
  onChangeFiatCurrency: (v: ExtraFiatCurrency) => void;
}

export const ExportOptions = memo(function ExportOptions({
  selectedKeys,
  walletSheetsSelected,
  liveMinerWarsEnabled,
  includeWalletFiat,
  onToggleLiveMinerWars,
  onToggleWalletFiat,
  includeExcelFiat,
  onToggleExcelFiat,
  excelFiatCurrency,
  onChangeFiatCurrency,
}: ExportOptionsProps) {
  const { t } = useTranslation();

  return (
    <>
      <AnimatePresence mode="popLayout">
        {selectedKeys.includes("minerwars") && (
          <motion.section
            key="live-minerwars"
            className="panel-glass export-options-wallet-section"
            variants={popVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            layout="position"
            transition={{ layout: { type: "spring", stiffness: 220, damping: 28 } }}
          >
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
                  <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
                  <path d="M13 19l6-6" />
                  <path d="m16 16 4 4" />
                  <path d="m19 21 2-2" />
                  <path d="M9 5 5 9" />
                </svg>
                {t("export.liveMinerWars")}
              </p>
              <p className="subtle wallet-note">{t("export.liveMinerWarsDesc")}</p>
              <label className="wallet-option-row">
                {t("export.liveMinerWarsToggleLabel")}
                <input
                  type="checkbox"
                  className="toggle-switch"
                  checked={liveMinerWarsEnabled}
                  onChange={(e) => onToggleLiveMinerWars(e.target.checked)}
                />
              </label>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout">
        {walletSheetsSelected && (
          <motion.section
            key="wallet-pricing"
            className="panel-glass export-options-wallet-section"
            variants={popVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            layout="position"
            transition={{ layout: { type: "spring", stiffness: 220, damping: 28 } }}
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
