import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  publishProfile,
  isWorkerConfigured,
  deleteMySharedProfile,
  buildShareLink,
} from "../../api";
import type { CacheState, RewardKey } from "@/types/rewards";
import { useExistingProfile } from "../../hooks/use-existing-profile";
import { useShareExclusions } from "../../hooks/use-share-exclusions";
import { ShareFilterModal } from "../share-filter-modal/share-filter-modal";
import "./share-modal.css";
import { ALL_REWARD_KEYS } from "@/config/reward-configs";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { AppNotice } from "@/components/app-notice/app-notice";
import {
  buildEffectiveExclusions,
  buildFilterInitialExclusions,
  buildSheetsToPublish,
  isAllExcluded,
  reconcileSelectedKeys,
} from "./utils/exclusions";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  FilterIcon,
  TrashCanIcon,
} from "@/components/icons";
import { ShareActions } from "./components/share-actions/share-actions";
import { ShareLinkRow } from "./components/share-link-row/share-link-row";
import { SheetList } from "./components/sheet-list/sheet-list";

const ShareCardModal = import.meta.env.DEV
  ? lazy(() =>
      import("../share-card-modal/share-card-modal").then((loadedModule) => ({
        default: loadedModule.ShareCardModal,
      })),
    )
  : () => null;

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -6 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22 } },
};

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
  const [deletingExisting, setDeletingExisting] = useState(false);

  const { exclusions, commitExclusions } = useShareExclusions();
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);

  const availableSheets = useMemo(
    () => ALL_REWARD_KEYS.filter((rewardKey) => !!cache[rewardKey]),
    [cache],
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<RewardKey>>(new Set(availableSheets));

  const workerReady = isWorkerConfigured();
  const {
    existingLoading,
    existingProfile,
    setExistingProfile,
    shareInCommunity,
    setShareInCommunity,
  } = useExistingProfile({
    authToken,
    workerReady,
    availableSheets,
    onPreviousSheets: (keys) => setSelectedKeys(new Set(keys)),
  });

  const effectiveExclusions = useMemo(
    () => buildEffectiveExclusions(exclusions, availableSheets, cache),
    [exclusions, availableSheets, cache],
  );

  const sheetsToShare = availableSheets.filter(
    (rewardKey) =>
      selectedKeys.has(rewardKey) && !isAllExcluded(cache, effectiveExclusions, rewardKey),
  );
  const existingShareLink = existingProfile ? buildShareLink(existingProfile.id) : "";

  const activeAlias = existingProfile ? existingProfile.alias : alias.trim();
  const aliasValid = existingProfile !== null || /^[a-zA-Z0-9_-]{1,40}$/.test(alias.trim());

  const [copiedNew, copyNew] = useCopyToClipboard();
  const [copiedExisting, copyExisting] = useCopyToClipboard();

  async function handleShare() {
    if (!aliasValid || !workerReady || !authToken || sheetsToShare.length === 0) return;
    setStatus("loading");
    setError("");
    try {
      const sheets = buildSheetsToPublish(sheetsToShare, cache, exclusions);
      const publishedProfile = await publishProfile(
        activeAlias!,
        sheets,
        authToken,
        shareInCommunity,
      );
      setExistingProfile({
        id: publishedProfile.id,
        alias: activeAlias,
        updatedAt: publishedProfile.updatedAt,
        communityVisible: shareInCommunity,
      });
      setStatus("done");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
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
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
      setStatus("error");
    } finally {
      setDeletingExisting(false);
    }
  }

  return (
    <>
      <motion.div
        className="share-modal-overlay"
        onClick={(event) => event.target === event.currentTarget && onClose()}
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
              <CloseIcon />
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
                          <ShareLinkRow
                            link={existingShareLink}
                            copied={copiedExisting}
                            onCopy={copyExisting}
                            disabled={deletingExisting}
                          />
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
                            <TrashCanIcon bars={!deletingExisting} />
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
                          onChange={(event) => setAlias(event.target.value)}
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
                    onClick={() => setShareInCommunity((previousValue) => !previousValue)}
                    disabled={status === "loading" || deletingExisting}
                    aria-pressed={shareInCommunity}
                  >
                    <span
                      className={`sheet-check-icon${shareInCommunity ? " sheet-check-icon--visible" : ""}`}
                      aria-hidden="true"
                    >
                      <CheckIcon />
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
                        <FilterIcon width={14} height={14} />
                        {t("share.filterEntries")}
                      </button>
                    </div>
                    <SheetList
                      cache={cache}
                      availableSheets={availableSheets}
                      selectedKeys={selectedKeys}
                      setSelectedKeys={setSelectedKeys}
                      exclusions={exclusions}
                      effectiveExclusions={effectiveExclusions}
                      commitExclusions={commitExclusions}
                      disabled={status === "loading"}
                    />
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
                    icon={<AlertCircleIcon className="app-notice-icon" />}
                    onDismiss={() => {
                      setError("");
                      setStatus("idle");
                    }}
                  >
                    {error}
                  </AppNotice>

                  <motion.div variants={itemVariants}>
                    <ShareActions
                      isUpdate={existingProfile !== null}
                      publishing={status === "loading"}
                      canPublish={
                        aliasValid &&
                        workerReady &&
                        !!authToken &&
                        sheetsToShare.length > 0 &&
                        status !== "loading" &&
                        !deletingExisting
                      }
                      onPublish={() => void handleShare()}
                      onGenerateImage={() => setShareCardOpen(true)}
                      onClose={onClose}
                    />
                  </motion.div>
                </motion.div>
              )}
            </>
          ) : (
            <>
              <p className="share-modal-success-msg">
                <CheckCircleIcon size={16} />
                {t("share.published")}
              </p>
              <ShareLinkRow link={existingShareLink} copied={copiedNew} onCopy={copyNew} />
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
            initialExclusions={buildFilterInitialExclusions(
              effectiveExclusions,
              availableSheets,
              selectedKeys,
              cache,
            )}
            onSave={(next) => {
              commitExclusions(next);
              setSelectedKeys((previousKeys) =>
                reconcileSelectedKeys(previousKeys, availableSheets, cache, next),
              );
              setFilterModalOpen(false);
            }}
            onClose={() => setFilterModalOpen(false)}
          />
        )}
      </AnimatePresence>

      {import.meta.env.DEV && shareCardOpen && (
        <Suspense fallback={null}>
          <ShareCardModal onClose={() => setShareCardOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
