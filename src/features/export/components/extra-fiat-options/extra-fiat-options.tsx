import { memo, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FiatDropdown } from "../fiat-dropdown/fiat-dropdown";
import type { ExtraFiatCurrency } from "../../types";

const rowLayoutSpring = {
  layout: { type: "spring" as const, stiffness: 220, damping: 28 },
};

const desktopWrapMotion = {
  initial: { opacity: 0, x: 24, maxWidth: 0 },
  animate: {
    opacity: 1,
    x: 0,
    maxWidth: 240,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    x: 24,
    maxWidth: 0,
    transition: { duration: 0.14, ease: "easeIn" as const },
  },
};

const mobileWrapMotion = {
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

const mobileContentMotion = {
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
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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
        {t("export.extraFiatConversion")}
      </p>
      <motion.div className="fiat-grid" layout transition={rowLayoutSpring}>
        <motion.label className="wallet-option-row" layout="position" transition={rowLayoutSpring}>
          {t("export.includeExtraConversion")}
          <input
            type="checkbox"
            className="toggle-switch"
            checked={includeExcelFiat}
            onChange={(e) => onToggle(e.target.checked)}
          />
        </motion.label>
        <AnimatePresence mode="sync">
          {includeExcelFiat &&
            (isMobile ? (
              <motion.div
                key="wallet-currency-row-mobile"
                className="wallet-currency-wrap-mobile"
                initial={mobileWrapMotion.initial}
                animate={mobileWrapMotion.animate}
                exit={mobileWrapMotion.exit}
              >
                <motion.div
                  className="wallet-option-row wallet-currency-row"
                  initial={mobileContentMotion.initial}
                  animate={mobileContentMotion.animate}
                  exit={mobileContentMotion.exit}
                >
                  {t("export.currency")}
                  <FiatDropdown value={currency} onChange={onChangeCurrency} />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="wallet-currency-row"
                className="wallet-option-row wallet-currency-row"
                initial={desktopWrapMotion.initial}
                animate={desktopWrapMotion.animate}
                exit={desktopWrapMotion.exit}
              >
                {t("export.currency")}
                <FiatDropdown value={currency} onChange={onChangeCurrency} />
              </motion.div>
            ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
});
