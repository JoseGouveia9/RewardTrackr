import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { DollarIcon, WarningIcon } from "@/components/icons";

const warningWrapMotion = {
  initial: { height: 0 },
  animate: {
    height: "auto" as const,
    transition: { duration: 0.14, ease: "easeOut" as const },
  },
  exit: {
    height: 0,
    transition: { duration: 0.1, ease: "easeIn" as const },
  },
};

const warningContentMotion = {
  initial: { opacity: 0, y: -10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.14, ease: "easeOut" as const, delay: 0.05 },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.08, ease: "easeIn" as const },
  },
};

interface WalletPricingOptionsProps {
  includeWalletFiat: boolean;
  onToggle: (checked: boolean) => void;
}

export const WalletPricingOptions = memo(function WalletPricingOptions({
  includeWalletFiat,
  onToggle,
}: WalletPricingOptionsProps) {
  const { t } = useTranslation();
  return (
    <div className="wallet-options">
      <p className="options-section-title">
        <DollarIcon />
        {t("export.walletPricing")}
      </p>
      <p className="subtle wallet-note">{t("export.walletPricingDesc")}</p>
      <label className="wallet-option-row">
        {t("export.includeFiatPricing")}
        <input
          type="checkbox"
          className="toggle-switch"
          checked={includeWalletFiat}
          onChange={(event) => onToggle(event.target.checked)}
        />
      </label>
      <AnimatePresence initial={false}>
        {includeWalletFiat && (
          <motion.div
            key="wallet-warning"
            className="wallet-warning-wrap"
            initial={warningWrapMotion.initial}
            animate={warningWrapMotion.animate}
            exit={warningWrapMotion.exit}
          >
            <motion.p
              className="wallet-warning"
              initial={warningContentMotion.initial}
              animate={warningContentMotion.animate}
              exit={warningContentMotion.exit}
            >
              <WarningIcon size={14} className="warning-icon" />
              {t("export.rateLimitWarning")}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
