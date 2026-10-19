import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isDevOwner } from "@/config/app-config";
import { fetchDirectory } from "../../api";
import type { DirectoryEntry } from "../../types";
import { DirectoryRow } from "../shared-banner/shared-banner";
import "./community-page.css";
import { BackIcon } from "@/components/icons";

export function CommunityPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const visibleEntries = entries
    .filter((entry) => entry.communityVisible !== false)
    .sort(
      (first, second) => (isDevOwner(second.ownerId) ? 1 : 0) - (isDevOwner(first.ownerId) ? 1 : 0),
    );

  useEffect(() => {
    fetchDirectory()
      .then(setEntries)
      .catch((caughtError: unknown) =>
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load directory"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="community">
      <div className="community-header">
        <button type="button" className="dv-back-button" onClick={onClose} aria-label="Back">
          <BackIcon />
          <span>{t("common.back")}</span>
        </button>
        <span className="dv-title">{t("share.communityTitle")}</span>
      </div>

      <p className="community-sub">{t("share.communitySubtitle")}</p>

      {error && <p className="community-error">{error}</p>}

      {loading && (
        <div className="community-loading">
          <span className="community-loading-inline">
            <span className="community-spinner" aria-hidden="true" />
            <span>{t("share.fetchingProfiles")}</span>
          </span>
        </div>
      )}

      {!loading && !error && visibleEntries.length === 0 && (
        <p className="community-empty">{t("share.noProfiles")}</p>
      )}

      {!loading && visibleEntries.length > 0 && (
        <div className="community-table-wrap">
          <table className="community-table">
            <thead>
              <tr>
                <th>{t("common.user")}</th>
                <th>{t("common.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry) => (
                <DirectoryRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
