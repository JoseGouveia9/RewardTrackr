import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import "./fetch-failed-modal.css";

// Global fetch-failure alert. Any fetch flow can raise it by dispatching
// `window.dispatchEvent(new CustomEvent("rt:fetch-failed", { detail: { message } }))`.
// Mounted once at the app root so records and MinerWars share one modal.
export function FetchFailedModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message ?? null);
      setOpen(true);
    };
    window.addEventListener("rt:fetch-failed", handler);
    return () => window.removeEventListener("rt:fetch-failed", handler);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fetch-failed-overlay"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          <motion.div
            className="fetch-failed-modal"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: [0.92, 1.03, 1], y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
          >
            <div className="fetch-failed-icon" aria-hidden="true">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12" y2="17" />
              </svg>
            </div>

            <h3 className="fetch-failed-title">{t("fetchFailed.title")}</h3>
            <p className="fetch-failed-body">{message ?? t("fetchFailed.body")}</p>

            <div className="fetch-failed-actions">
              <button
                type="button"
                className="fetch-failed-btn fetch-failed-btn--primary"
                onClick={() => window.location.reload()}
              >
                {t("fetchFailed.retry")}
              </button>
              <button
                type="button"
                className="fetch-failed-btn fetch-failed-btn--ghost"
                onClick={() => setOpen(false)}
              >
                {t("fetchFailed.close")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
