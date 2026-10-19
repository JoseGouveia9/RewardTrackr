import { memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useEscapeKey } from "@/hooks/use-escape-key";
import "./referral-button.css";
import { CloseIcon, UserPlusIcon } from "@/components/icons";

interface ReferralButtonProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const ReferralButton = memo(function ReferralButton({
  open,
  onOpen,
  onClose,
}: ReferralButtonProps) {
  const { t } = useTranslation();
  useEscapeKey(onClose, open);

  useEffect(() => {
    if (open) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" className="referral-button" onClick={onOpen}>
        <UserPlusIcon className="referral-button-icon" />
        <span>{t("referral.noAccount")}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="referral-overlay"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <motion.div
              className="referral-modal"
              onClick={(event) => event.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: [0.92, 1.03, 1], y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.24, ease: "easeInOut" }}
            >
              <div className="referral-modal-header">
                <span className="referral-modal-title">{t("referral.signUpTitle")}</span>
                <button
                  type="button"
                  className="referral-modal-close"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </div>

              <p className="referral-modal-intro">{t("referral.signUpIntro")}</p>

              <ul className="referral-modal-perks">
                <li>
                  <span className="referral-perk-title">{t("referral.bonus1Title")}</span>
                  <span className="referral-perk-condition">{t("referral.bonus1Sub")}</span>
                </li>
                <li>
                  <span className="referral-perk-title">{t("referral.bonus2Title")}</span>
                  <span className="referral-perk-condition">{t("referral.bonus2Sub")}</span>
                </li>
                <li>
                  <span className="referral-perk-title">{t("referral.bonus3Title")}</span>
                  <span className="referral-perk-condition">{t("referral.bonus3Sub")}</span>
                </li>
              </ul>

              <a
                className="referral-modal-cta"
                href="https://gomining.com/?ref=9GFJB2X"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("referral.signUp")}
              </a>

              <p className="referral-modal-code">{t("referral.useCode")}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
