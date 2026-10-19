import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import "./fetch-failed-modal.css";
import { AlertTriangleIcon } from "@/components/icons";

/** Raised by dispatching a `rt:fetch-failed` CustomEvent with `detail: { message }`. */
export function FetchFailedModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
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
          onClick={(event) => event.target === event.currentTarget && setOpen(false)}
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
              <AlertTriangleIcon width={26} height={26} />
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
