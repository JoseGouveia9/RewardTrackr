import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { CacheState, RewardKey } from "@/types/rewards";
import { DataViewer } from "@/features/data-viewer";
import type { ExclusionRecord } from "../../hooks/use-share-exclusions";
import "./share-filter-modal.css";

export function ShareFilterModal({
  cache,
  initialExclusions,
  onSave,
  onClose,
}: {
  cache: CacheState;
  initialExclusions: ExclusionRecord;
  onSave: (exclusions: ExclusionRecord) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const [draft, setDraft] = useState<ExclusionRecord>(() => ({ ...initialExclusions }));

  const onToggle = useCallback((key: RewardKey, ids: string[]) => {
    setDraft((prev) => {
      const current = new Set<string>(prev[key] ?? []);
      const allExcluded = ids.every((id) => current.has(id));
      if (allExcluded) {
        ids.forEach((id) => current.delete(id));
      } else {
        ids.forEach((id) => current.add(id));
      }
      const next = { ...prev, [key]: [...current] };
      if (next[key]?.length === 0) delete next[key];
      return next;
    });
  }, []);

  function handleSave() {
    onSave(draft);
  }

  return (
    <motion.div
      className="sfm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      <motion.div
        className="sfm-modal"
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: [0.92, 1.03, 1], y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.24, ease: "easeInOut" }}
      >
        <div className="sfm-header">
          <span className="sfm-title">{t("share.filterEntries")}</span>
          <button
            type="button"
            className="share-modal-close"
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

        <div className="sfm-content">
          <DataViewer
            onClose={onClose}
            sharedData={cache}
            pageSize={10}
            rowSelection={{ exclusions: draft, onToggle }}
          />
        </div>

        <div className="sfm-footer">
          <button
            type="button"
            className="share-modal-button share-modal-button--primary"
            onClick={handleSave}
          >
            {t("share.filterSave")}
          </button>
          <button
            type="button"
            className="share-modal-button share-modal-button--ghost"
            onClick={onClose}
          >
            {t("share.filterDiscard")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
