import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  publishProfile,
  isWorkerConfigured,
  fetchMySharedProfile,
  fetchSharedProfile,
  deleteMySharedProfile,
  buildShareLink,
} from "../../api";
import type { CacheState, RewardKey } from "@/features/export/types";
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

  const [alias, setAlias] = useState(defaultAlias || "");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [existingLoading, setExistingLoading] = useState(false);
  const [existingProfile, setExistingProfile] = useState<OwnedProfile | null>(null);
  const [deletingExisting, setDeletingExisting] = useState(false);
  const [shareInCommunity, setShareInCommunity] = useState(true);
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);

  const availableSheets = useMemo(() => ALL_REWARD_KEYS.filter((k) => !!cache[k]), [cache]);
  const [selectedKeys, setSelectedKeys] = useState<Set<RewardKey>>(new Set(availableSheets));

  const sheetsToShare = availableSheets.filter((k) => selectedKeys.has(k));
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

  function toggleSheet(k: RewardKey) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function handleShare() {
    if (!aliasValid || !workerReady || !authToken || sheetsToShare.length === 0) return;
    setStatus("loading");
    setError("");
    try {
      const sheets: Partial<CacheState> = {};
      for (const k of sheetsToShare) sheets[k] = cache[k];
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
          <span className="share-modal-title">Share Records</span>
          <button type="button" className="share-modal-close" onClick={onClose} aria-label="Close">
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
              Your records will be publicly visible. Anyone with the link can view them, read-only.
            </motion.p>

            {existingLoading ? (
              <p className="share-modal-hint share-modal-loading-inline" aria-live="polite">
                <span className="share-modal-spinner" aria-hidden="true" />
                <span>Checking your current shared link...</span>
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
                      <p className="share-modal-existing-title">Current shared link</p>
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
                            aria-label={copiedExisting ? "Copied" : "Copy link"}
                            title={copiedExisting ? "Copied" : "Copy link"}
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
                          aria-label={deletingExisting ? "Deleting" : "Delete link"}
                          title={deletingExisting ? "Deleting" : "Delete link"}
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
                        Display name
                      </label>
                      <input
                        id="sh-alias-input"
                        type="text"
                        className="share-modal-input"
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        placeholder="e.g. Moustachio"
                        maxLength={40}
                        disabled={status === "loading"}
                        autoFocus
                      />
                      {alias && !aliasValid && (
                        <p className="share-modal-hint share-modal-hint--error">
                          Letters, numbers, _ and - only (1–40 chars)
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
                    Show in Community tab
                    <small>
                      {shareInCommunity
                        ? "Your profile will appear in the public community list."
                        : "Your profile stays accessible only by direct link."}
                    </small>
                  </span>
                </motion.button>

                <motion.div variants={itemVariants} className="share-modal-sheets">
                  <span className="share-modal-sheets-label">Sheets included</span>
                  <div className="share-modal-sheet-list">
                    {availableSheets.map((k) => {
                      const entry = cache[k]!;
                      const checked = selectedKeys.has(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          className={`share-modal-sheet-row share-modal-sheet-row--check${checked ? " share-modal-sheet-row--checked" : ""}`}
                          onClick={() => toggleSheet(k)}
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
                          <span className="share-modal-sheet-name">{entry.sheetName}</span>
                          <span className="share-modal-sheet-meta">
                            {entry.records.length} records · {formatAge(entry.fetchedAt)}
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
                    Sharing requires a Cloudflare Worker. See{" "}
                    <a
                      href="https://github.com/JoseGouveia9/RewardTrackr#sharing-setup"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      setup guide
                    </a>
                    .
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
                      <span>
                        This will update the data of your shared link with the currently selected
                        options.
                      </span>
                      <div className="share-modal-update-warning-actions">
                        <button
                          type="button"
                          className="share-modal-button share-modal-button--primary"
                          onClick={() => {
                            setConfirmingUpdate(false);
                            void handleShare();
                          }}
                        >
                          Confirm Update
                        </button>
                        <button
                          type="button"
                          className="share-modal-button share-modal-button--ghost"
                          onClick={() => setConfirmingUpdate(false)}
                        >
                          Cancel
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
                          ? "Publishing…"
                          : existingProfile
                            ? "Update Data"
                            : "Share"}
                      </button>
                      <button
                        type="button"
                        className="share-modal-button share-modal-button--ghost"
                        onClick={onClose}
                        disabled={status === "loading"}
                      >
                        Cancel
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
              Published! Share this link:
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
                aria-label={copiedNew ? "Copied" : "Copy link"}
                title={copiedNew ? "Copied" : "Copy link"}
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
              Close
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
