import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { DirectoryEntry } from "../../types";
import "./shared-banner.css";
import { formatAge } from "@/features/export/utils/cache";

export function SharedBanner({
  profile,
  loading,
  onClose,
}: {
  profile?: { alias: string; updatedAt: string };
  loading?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const age = profile ? formatAge(new Date(profile.updatedAt).getTime()) : null;

  return (
    <div className="shared-banner">
      <div className="shared-banner-left">
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
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {loading ? (
          <span>{t("share.loadingProfile")}</span>
        ) : (
          <span>{t("share.viewingRecords", { alias: profile?.alias })}</span>
        )}
        {age && <span className="shared-banner-meta">{t("share.updatedAge", { age })}</span>}
      </div>
      <button
        type="button"
        className="shared-banner-close"
        onClick={onClose}
        aria-label={t("common.close")}
      >
        <svg
          width="13"
          height="13"
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
  );
}

// A row in the community directory table.
export function DirectoryRow({ entry }: { entry: DirectoryEntry }) {
  const { t } = useTranslation();
  const age = formatAge(new Date(entry.updatedAt).getTime());
  const isDev = String(entry.ownerId ?? "") === "3575344";
  const navigate = useNavigate();

  function handleView() {
    void navigate(`/view/${entry.id}`, { state: { from: "/community" } });
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleView();
    }
  }

  return (
    <tr
      className="directory-row"
      onClick={handleView}
      onKeyDown={handleRowKeyDown}
      role="button"
      tabIndex={0}
      aria-label={t("dataViewer.viewRecords", { alias: entry.alias })}
    >
      <td className="directory-row-alias">
        <span className="directory-row-alias-content">
          <span>{entry.alias}</span>
          {isDev ? <span className="directory-row-dev-badge">DEV</span> : null}
        </span>
      </td>
      <td className="directory-row-updated">{age}</td>
    </tr>
  );
}
