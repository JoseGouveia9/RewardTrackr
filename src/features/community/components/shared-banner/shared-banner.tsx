import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { DirectoryEntry } from "../../types";
import "./shared-banner.css";
import { formatAge } from "@/lib/reward-cache";
import { isDevOwner } from "@/config/app-config";
import { EyeIcon } from "@/components/icons";

export function SharedBanner({
  profile,
  loading,
}: {
  profile?: { alias: string; updatedAt: string };
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const age = profile ? formatAge(new Date(profile.updatedAt).getTime()) : null;

  return (
    <div className="shared-banner">
      <div className="shared-banner-left">
        <EyeIcon />
        {loading ? (
          <span>{t("share.loadingProfile")}</span>
        ) : (
          <span>{t("share.viewingRecords", { alias: profile?.alias })}</span>
        )}
        {age && <span className="shared-banner-meta">{t("share.updatedAge", { age })}</span>}
      </div>
    </div>
  );
}

export function DirectoryRow({ entry }: { entry: DirectoryEntry }) {
  const { t } = useTranslation();
  const age = formatAge(new Date(entry.updatedAt).getTime());
  const isDev = isDevOwner(entry.ownerId);
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
