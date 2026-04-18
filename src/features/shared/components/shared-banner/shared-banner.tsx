import type { KeyboardEvent } from "react";
import type { DirectoryEntry } from "../../types";
import "./shared-banner.css";
import { formatAge } from "@/features/export/utils/cache";

// Banner shown at the top of the DataViewer when viewing someone else's shared records.
export function SharedBanner({
  profile,
  loading,
  onClose,
}: {
  profile?: { alias: string; updatedAt: string };
  loading?: boolean;
  onClose: () => void;
}) {
  const age = profile ? formatAge(new Date(profile.updatedAt).getTime()) : null;

  return (
    <div className="sh-banner">
      <div className="sh-banner-left">
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
          <span>Loading profile...</span>
        ) : (
          <span>
            Viewing <strong>{profile?.alias}</strong>'s records
          </span>
        )}
        {age && <span className="sh-banner-meta">· Updated {age} · Read only</span>}
      </div>
      <button type="button" className="sh-banner-close" onClick={onClose} aria-label="Close">
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
  const age = formatAge(new Date(entry.updatedAt).getTime());
  const isDev = String(entry.ownerId ?? "") === "3575344";

  function handleView() {
    window.location.hash = `view=${entry.id}`;
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleView();
    }
  }

  return (
    <tr
      className="sh-dir-row"
      onClick={handleView}
      onKeyDown={handleRowKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View ${entry.alias} records`}
    >
      <td className="sh-dir-alias">
        <span className="sh-dir-alias-content">
          <span>{entry.alias}</span>
          {isDev ? <span className="sh-dir-dev-badge">DEV</span> : null}
        </span>
      </td>
      <td className="sh-dir-updated">{age}</td>
    </tr>
  );
}
