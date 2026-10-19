import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { CacheState, RewardKey } from "@/types/rewards";
import { DataViewer } from "@/features/records";
import type { ExclusionRecord } from "../../hooks/use-share-exclusions";
import { CloseIcon } from "@/components/icons";
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
    setDraft((previousDraft) => {
      const current = new Set<string>(previousDraft[key] ?? []);
      const allExcluded = ids.every((id) => current.has(id));
      if (allExcluded) {
        ids.forEach((id) => current.delete(id));
      } else {
        ids.forEach((id) => current.add(id));
      }
      const next = { ...previousDraft, [key]: [...current] };
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
      onClick={(event) => event.target === event.currentTarget && onClose()}
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
            <CloseIcon />
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
