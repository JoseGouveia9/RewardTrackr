import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { WalletPricingOptions } from "./components/wallet-pricing-options/wallet-pricing-options";
import { ExtraFiatOptions } from "./components/extra-fiat-options/extra-fiat-options";
import type { ExportConfig } from "../../hooks/use-export-config";
import "./export-options.css";
import { SwordIcon } from "@/components/icons";

const popVariants = {
  initial: { opacity: 0, scale: 0.95, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22 } },
  exit: { opacity: 0, scale: 0.95, y: -6, transition: { duration: 0.32 } },
};

interface ExportOptionsProps {
  config: ExportConfig;
  liveMinerWars: { enabled: boolean; onToggle: (enabled: boolean) => void };
}

export function ExportOptions({ config, liveMinerWars }: ExportOptionsProps) {
  const {
    selectedKeys,
    walletSheetsSelected,
    includeWalletFiat,
    setIncludeWalletFiat,
    includeExcelFiat,
    setIncludeExcelFiat,
    excelFiatCurrency,
    setFiatCurrency,
  } = config;
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
                <SwordIcon />
                {t("export.liveMinerWars")}
              </p>
              <p className="subtle wallet-note">{t("export.liveMinerWarsDesc")}</p>
              <label className="wallet-option-row">
                {t("export.liveMinerWarsToggleLabel")}
                <input
                  type="checkbox"
                  className="toggle-switch"
                  checked={liveMinerWars.enabled}
                  onChange={(event) => liveMinerWars.onToggle(event.target.checked)}
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
              onToggle={setIncludeWalletFiat}
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
          onToggle={setIncludeExcelFiat}
          currency={excelFiatCurrency}
          onChangeCurrency={setFiatCurrency}
        />
      </motion.section>
    </>
  );
}
