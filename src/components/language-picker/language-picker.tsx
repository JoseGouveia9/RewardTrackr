import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { LANGUAGES, applyDocumentDir } from "@/i18n";
import "./language-picker.css";

interface LanguagePickerProps {
  open: boolean;
  onClose: () => void;
}

export function LanguagePicker({ open, onClose }: LanguagePickerProps) {
  const { i18n, t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleSelect(code: string) {
    void i18n.changeLanguage(code);
    applyDocumentDir(code);
    onClose();
  }

  const currentLang = i18n.language;

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
          onMouseDown={(e) => {
            if (e.target === overlayRef.current) onClose();
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="lang-grid">
              {LANGUAGES.map((lang) => {
                const isSelected =
                  currentLang === lang.code ||
                  currentLang.startsWith(lang.code + "-") ||
                  (lang.code.includes("-") && currentLang === lang.code.split("-")[0]);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    className={`lang-option${isSelected ? " lang-option--active" : ""}`}
                    onClick={() => handleSelect(lang.code)}
                  >
                    <span className="lang-option-native">{lang.nativeName}</span>
                    <span className="lang-option-english">{lang.englishName}</span>
                    {isSelected && (
                      <span className="lang-option-check" aria-hidden="true">
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
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
