import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  publishProfile,
  isWorkerConfigured,
  fetchMySharedProfile,
  fetchSharedProfile,
  deleteMySharedProfile,
  buildShareLink,
} from "../../api";
import type { CacheState, RewardKey } from "@/features/export/types";
import { useShareExclusions } from "../../hooks/use-share-exclusions";
import { ShareFilterModal } from "../share-filter-modal/share-filter-modal";

const SHEET_I18N_KEY: Record<string, string> = {
  "solo-mining": "tabs.soloMining",
  minerwars: "tabs.minerWars",
  bounty: "tabs.bounties",
  referrals: "tabs.referrals",
  ambassador: "tabs.ambassador",
  deposits: "tabs.deposits",
  withdrawals: "tabs.withdrawals",
  purchases: "export.sheetPurchases",
  upgrades: "export.sheetUpgrades",
  transactions: "tabs.transactions",
  "simple-earn": "tabs.simpleEarn",
};
import type { OwnedProfile } from "../../types";
import "./share-modal.css";
import { ALL_REWARD_KEYS } from "@/features/export/config/reward-configs";
import { formatAge } from "@/features/export/utils/cache";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { AppNotice } from "@/components/app-notice/app-notice";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -6 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22 } },
};

const SHARE_ERROR_ICON = (
  <svg
    className="app-notice-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="13" />
    <line x1="12" y1="16" x2="12" y2="16" />
  </svg>
);

export function ShareModal({
  cache,
  defaultAlias,
  authToken,
  onClose,
}: {
  cache: CacheState;
  defaultAlias: string;
  authToken: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, []);

  const { t } = useTranslation();
  const [alias, setAlias] = useState(defaultAlias || "");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [existingLoading, setExistingLoading] = useState(false);
  const [existingProfile, setExistingProfile] = useState<OwnedProfile | null>(null);
  const [deletingExisting, setDeletingExisting] = useState(false);
  const [shareInCommunity, setShareInCommunity] = useState(true);
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);

  const { exclusions, commitExclusions } = useShareExclusions();
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const availableSheets = useMemo(() => ALL_REWARD_KEYS.filter((k) => !!cache[k]), [cache]);
  const [selectedKeys, setSelectedKeys] = useState<Set<RewardKey>>(new Set(availableSheets));

  function isAllExcluded(key: RewardKey): boolean {
    const records = cache[key]?.records;
    if (!records || records.length === 0) return false;
    const tabKey = key === "upgrades" ? "purchases" : key;
    const excluded = new Set(exclusions[tabKey] ?? []);
    return records.every((r, i) => excluded.has(`${key}::${String(r.createdAt ?? "")}::${i}`));
  }

  const sheetsToShare = availableSheets.filter((k) => selectedKeys.has(k) && !isAllExcluded(k));
  const existingShareLink = existingProfile ? buildShareLink(existingProfile.id) : "";

  const activeAlias = existingProfile ? existingProfile.alias : alias.trim();
  const aliasValid = existingProfile !== null || /^[a-zA-Z0-9_-]{1,40}$/.test(alias.trim());
  const workerReady = isWorkerConfigured();

  const [copiedNew, copyNew] = useCopyToClipboard();
  const [copiedExisting, copyExisting] = useCopyToClipboard();

  useEffect(() => {
    if (!workerReady || !authToken) return;
    let alive = true;
    setExistingLoading(true);
    fetchMySharedProfile(authToken)
      .then(async (data) => {
        if (!alive) return;
        if (data.exists && data.id) {
          const isVisible = data.communityVisible !== false;
          setExistingProfile({
            id: data.id,
            alias: data.alias,
            updatedAt: data.updatedAt,
            communityVisible: isVisible,
          });
          setShareInCommunity(isVisible);
          try {
            const full = await fetchSharedProfile(data.id);
            if (!alive) return;
            const prevKeys = availableSheets.filter((k) => k in full.sheets);
            if (prevKeys.length > 0) setSelectedKeys(new Set(prevKeys));
            // eslint-disable-next-line no-empty
          } catch {}
        } else {
          setExistingProfile(null);
          setShareInCommunity(true);
        }
      })
      .catch(() => {
        if (!alive) return;
        setExistingProfile(null);
      })
      .finally(() => {
        if (!alive) return;
        setExistingLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [authToken, workerReady]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleShare() {
    if (!aliasValid || !workerReady || !authToken || sheetsToShare.length === 0) return;
    setStatus("loading");
    setError("");
    try {
      const sheets: Partial<CacheState> = {};
      for (const k of sheetsToShare) {
        const entry = cache[k];
        if (!entry) continue;
        const tabKey = (k === "upgrades" ? "purchases" : k) as RewardKey;
        const excluded = new Set(exclusions[tabKey] ?? []);
        const filtered = entry.records.filter(
          (r, i) => !excluded.has(`${k}::${String(r.createdAt ?? "")}::${i}`),
        );
        sheets[k] =
          filtered.length === entry.records.length
            ? entry
            : { ...entry, records: filtered, totalCount: filtered.length };
      }
      const res = await publishProfile(activeAlias!, sheets, authToken, shareInCommunity);
      setExistingProfile({
        id: res.id,
        alias: activeAlias,
        updatedAt: res.updatedAt,
        communityVisible: shareInCommunity,
      });
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }

  async function handleDeleteExisting() {
    if (!authToken || !existingProfile) return;
    if (!window.confirm("Delete your current shared profile link?")) return;

    setDeletingExisting(true);
    setError("");
    try {
      await deleteMySharedProfile(authToken);
      setExistingProfile(null);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    } finally {
      setDeletingExisting(false);
    }
  }

  return (
    <>
      <motion.div
        className="share-modal-overlay"
        onClick={(e) => e.target === e.currentTarget && onClose()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <motion.div
          className="share-modal"
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: [0.92, 1.03, 1], y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.24, ease: "easeInOut" }}
        >
          <div className="share-modal-header">
            <span className="share-modal-title">{t("share.shareRecords")}</span>
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

          {status !== "done" ? (
            <>
              <motion.p
                className="share-modal-desc"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
              >
                {t("share.publiclyVisible")}
              </motion.p>

              {existingLoading ? (
                <p className="share-modal-hint share-modal-loading-inline" aria-live="polite">
                  <span className="share-modal-spinner" aria-hidden="true" />
                  <span>{t("share.checkingSharedLink")}</span>
                </p>
              ) : (
                <motion.div
                  className="share-modal-body"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div variants={itemVariants}>
                    {existingProfile ? (
                      <div className="share-modal-existing">
                        <p className="share-modal-existing-title">{t("share.currentSharedLink")}</p>
                        <div className="share-modal-link-actions">
                          <div className="share-modal-link-row">
                            <input
                              type="text"
                              className="share-modal-link-input"
                              value={existingShareLink}
                              readOnly
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button
                              type="button"
                              className={`share-modal-icon-button${copiedExisting ? " share-modal-icon-button--done" : ""}`}
                              onClick={() => copyExisting(existingShareLink)}
                              disabled={deletingExisting}
                              aria-label={copiedExisting ? t("common.copied") : t("share.copyLink")}
                              title={copiedExisting ? t("common.copied") : t("share.copyLink")}
                            >
                              {copiedExisting ? (
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
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              )}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="share-modal-icon-button share-modal-icon-button--danger"
                            onClick={handleDeleteExisting}
                            disabled={deletingExisting || status === "loading"}
                            aria-label={
                              deletingExisting ? t("share.deleting") : t("share.deleteLink")
                            }
                            title={deletingExisting ? t("share.deleting") : t("share.deleteLink")}
                          >
                            {deletingExisting ? (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                              </svg>
                            ) : (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <label className="share-modal-label" htmlFor="sh-alias-input">
                          {t("share.displayName")}
                        </label>
                        <input
                          id="sh-alias-input"
                          type="text"
                          className="share-modal-input"
                          value={alias}
                          onChange={(e) => setAlias(e.target.value)}
                          placeholder={t("share.displayNamePlaceholder")}
                          maxLength={40}
                          disabled={status === "loading"}
                          autoFocus
                        />
                        {alias && !aliasValid && (
                          <p className="share-modal-hint share-modal-hint--error">
                            {t("share.displayNameError")}
                          </p>
                        )}
                      </>
                    )}
                  </motion.div>

                  <motion.button
                    variants={itemVariants}
                    type="button"
                    className={`share-modal-visibility-row${shareInCommunity ? " share-modal-visibility-row--checked" : ""}`}
                    onClick={() => setShareInCommunity((prev) => !prev)}
                    disabled={status === "loading" || deletingExisting}
                    aria-pressed={shareInCommunity}
                  >
                    <span
                      className={`sheet-check-icon${shareInCommunity ? " sheet-check-icon--visible" : ""}`}
                      aria-hidden="true"
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
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span>
                      {t("share.showInCommunity")}
                      <small>
                        {shareInCommunity
                          ? t("share.communityPublic")
                          : t("share.communityPrivate")}
                      </small>
                    </span>
                  </motion.button>

                  <motion.div variants={itemVariants} className="share-modal-sheets">
                    <div className="share-modal-sheets-header">
                      <span className="share-modal-sheets-label">{t("share.sheetsIncluded")}</span>
                      <button
                        type="button"
                        className="share-modal-filter-btn"
                        onClick={() => setFilterModalOpen(true)}
                        disabled={status === "loading"}
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
                          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                        {t("share.filterEntries")}
                      </button>
                    </div>
                    <div className="share-modal-sheet-list">
                      {availableSheets
                        .filter((k) => !(k === "upgrades" && availableSheets.includes("purchases")))
                        .map((k) => {
                          const isCombo = k === "purchases" && availableSheets.includes("upgrades");
                          const comboKeys: RewardKey[] = isCombo ? ["purchases", "upgrades"] : [k];
                          const allExcluded = comboKeys.every((ck) => isAllExcluded(ck));
                          const checked =
                            comboKeys.some((ck) => selectedKeys.has(ck)) && !allExcluded;
                          const totalRecords = comboKeys.reduce(
                            (sum, ck) => sum + (cache[ck]?.records.length ?? 0),
                            0,
                          );
                          const excludedCount = comboKeys.reduce((sum, ck) => {
                            const tabKey = (ck === "upgrades" ? "purchases" : ck) as RewardKey;
                            const excSet = new Set(exclusions[tabKey] ?? []);
                            return (
                              sum +
                              (cache[ck]?.records ?? []).filter((r, i) =>
                                excSet.has(`${ck}::${String(r.createdAt ?? "")}::${i}`),
                              ).length
                            );
                          }, 0);
                          const visibleCount = totalRecords - excludedCount;
                          const label = isCombo
                            ? t("tabs.purchasesUpgrades")
                            : t(SHEET_I18N_KEY[k] ?? "", { defaultValue: cache[k]!.sheetName });
                          const fetchedAt = cache[k]?.fetchedAt ?? 0;
                          return (
                            <button
                              key={k}
                              type="button"
                              className={`share-modal-sheet-row share-modal-sheet-row--check${checked ? " share-modal-sheet-row--checked" : ""}`}
                              onClick={() => {
                                if (allExcluded) {
                                  const next = { ...exclusions };
                                  for (const ck of comboKeys) {
                                    const tabKey = (
                                      ck === "upgrades" ? "purchases" : ck
                                    ) as RewardKey;
                                    const remaining = (next[tabKey] ?? []).filter(
                                      (id) => !id.startsWith(`${ck}::`),
                                    );
                                    if (remaining.length === 0) delete next[tabKey];
                                    else next[tabKey] = remaining;
                                  }
                                  commitExclusions(next);
                                  setSelectedKeys((prev) => {
                                    const s = new Set(prev);
                                    comboKeys.forEach((ck) => s.add(ck));
                                    return s;
                                  });
                                } else {
                                  setSelectedKeys((prev) => {
                                    const s = new Set(prev);
                                    const willDeselect = comboKeys.some((ck) => s.has(ck));
                                    if (willDeselect) comboKeys.forEach((ck) => s.delete(ck));
                                    else comboKeys.forEach((ck) => s.add(ck));
                                    return s;
                                  });
                                }
                              }}
                              disabled={status === "loading"}
                              aria-pressed={checked}
                            >
                              <span
                                className={`sheet-check-icon${checked ? " sheet-check-icon--visible" : ""}`}
                                aria-hidden="true"
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
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </span>
                              <span className="share-modal-sheet-name">{label}</span>
                              <span className="share-modal-sheet-meta">
                                {checked
                                  ? `${visibleCount}/${totalRecords} ${t("common.records").toLowerCase()}`
                                  : `0/${totalRecords} ${t("common.records").toLowerCase()}`}{" "}
                                · {formatAge(fetchedAt)}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </motion.div>

                  {!workerReady && (
                    <motion.p
                      variants={itemVariants}
                      className="share-modal-hint share-modal-hint--warn"
                    >
                      {t("share.workerRequired", { link: t("share.setupGuide") })}
                    </motion.p>
                  )}

                  <AppNotice
                    visible={status === "error" && !!error}
                    icon={SHARE_ERROR_ICON}
                    onDismiss={() => {
                      setError("");
                      setStatus("idle");
                    }}
                  >
                    {error}
                  </AppNotice>

                  <motion.div variants={itemVariants}>
                    {confirmingUpdate ? (
                      <div className="share-modal-update-warning">
                        <span>{t("share.updateWarning")}</span>
                        <div className="share-modal-update-warning-actions">
                          <button
                            type="button"
                            className="share-modal-button share-modal-button--primary"
                            onClick={() => {
                              setConfirmingUpdate(false);
                              void handleShare();
                            }}
                          >
                            {t("share.confirmUpdate")}
                          </button>
                          <button
                            type="button"
                            className="share-modal-button share-modal-button--ghost"
                            onClick={() => setConfirmingUpdate(false)}
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="share-modal-actions">
                        <button
                          type="button"
                          className="share-modal-button share-modal-button--primary"
                          onClick={existingProfile ? () => setConfirmingUpdate(true) : handleShare}
                          disabled={
                            !aliasValid ||
                            !workerReady ||
                            !authToken ||
                            sheetsToShare.length === 0 ||
                            status === "loading" ||
                            deletingExisting
                          }
                        >
                          {status === "loading"
                            ? t("share.publishing")
                            : existingProfile
                              ? t("share.updateData")
                              : t("common.share")}
                        </button>
                        <button
                          type="button"
                          className="share-modal-button share-modal-button--ghost"
                          onClick={onClose}
                          disabled={status === "loading"}
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </>
          ) : (
            <>
              <p className="share-modal-success-msg">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                {t("share.published")}
              </p>
              <div className="share-modal-link-row">
                <input
                  type="text"
                  className="share-modal-link-input"
                  value={existingShareLink}
                  readOnly
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  className={`share-modal-icon-button${copiedNew ? " share-modal-icon-button--done" : ""}`}
                  onClick={() => copyNew(existingShareLink)}
                  aria-label={copiedNew ? t("common.copied") : t("share.copyLink")}
                  title={copiedNew ? t("common.copied") : t("share.copyLink")}
                >
                  {copiedNew ? (
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
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <button
                type="button"
                className="share-modal-button share-modal-button--ghost"
                onClick={onClose}
              >
                {t("common.close")}
              </button>
            </>
          )}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {filterModalOpen && (
          <ShareFilterModal
            cache={cache}
            initialExclusions={(() => {
              const result = { ...exclusions };
              for (const k of availableSheets) {
                if (selectedKeys.has(k)) continue;
                // "upgrades" is rendered inside the "purchases" DataViewer tab,
                // so its exclusion IDs must live under "purchases"
                const tabKey = k === "upgrades" ? "purchases" : k;
                const ids = (cache[k]?.records ?? []).map(
                  (r, i) => `${k}::${String(r.createdAt ?? "")}::${i}`,
                );
                const existing = new Set(result[tabKey] ?? []);
                ids.forEach((id) => existing.add(id));
                result[tabKey] = [...existing];
              }
              return result;
            })()}
            onSave={(next) => {
              commitExclusions(next);
              setSelectedKeys((prev) => {
                const updated = new Set(prev);
                for (const k of availableSheets) {
                  const records = cache[k]?.records ?? [];
                  if (!records.length) continue;
                  const tabKey = (k === "upgrades" ? "purchases" : k) as RewardKey;
                  const excluded = new Set(next[tabKey] ?? []);
                  const allExcluded = records.every((r, i) =>
                    excluded.has(`${k}::${String(r.createdAt ?? "")}::${i}`),
                  );
                  if (!allExcluded) updated.add(k);
                }
                return updated;
              });
              setFilterModalOpen(false);
            }}
            onClose={() => setFilterModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
