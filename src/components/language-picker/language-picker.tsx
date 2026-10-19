import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { LANGUAGES, applyDocumentDirection } from "@/i18n";
import { useEscapeKey } from "@/hooks/use-escape-key";
import "./language-picker.css";
import { CheckIcon, CloseIcon } from "@/components/icons";

interface LanguagePickerProps {
  open: boolean;
  onClose: () => void;
}

export function LanguagePicker({ open, onClose }: LanguagePickerProps) {
  const { i18n, t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, open);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleSelect(code: string) {
    void i18n.changeLanguage(code);
    applyDocumentDirection(code);
    onClose();
  }

  const currentLanguage = i18n.language;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="lang-overlay"
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(event) => {
            if (event.target === overlayRef.current) onClose();
          }}
        >
          <motion.div
            className="lang-modal"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="lang-modal-header">
              <span className="lang-modal-title">{t("language.selectLanguage")}</span>
              <button
                type="button"
                className="lang-modal-close"
                onClick={onClose}
                aria-label={t("common.close")}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="lang-grid">
              {LANGUAGES.map((language) => {
                const isSelected =
                  currentLanguage === language.code ||
                  currentLanguage.startsWith(language.code + "-") ||
                  (language.code.includes("-") && currentLanguage === language.code.split("-")[0]);
                return (
                  <button
                    key={language.code}
                    type="button"
                    className={`lang-option${isSelected ? " lang-option--active" : ""}`}
                    onClick={() => handleSelect(language.code)}
                  >
                    <span className="lang-option-native">{language.nativeName}</span>
                    <span className="lang-option-english">{language.englishName}</span>
                    {isSelected && (
                      <span className="lang-option-check" aria-hidden="true">
                        <CheckIcon size={13} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
