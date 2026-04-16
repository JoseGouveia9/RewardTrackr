import type { DirectoryEntry } from "../../types";
import { buildShareLink } from "../../api";
import "./shared-banner.css";
import { formatAge } from "@/features/export/utils/cache";

// Banner shown at the top of the DataViewer when viewing someone else's shared records.
export function SharedBanner({
  profile,
  onClose,
}: {
  profile: { alias: string; updatedAt: string };
  onClose: () => void;
}) {
  const age = formatAge(new Date(profile.updatedAt).getTime());

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
        <span>
          Viewing <strong>{profile.alias}</strong>'s records
        </span>
        <span className="sh-banner-meta">· updated {age} · read only</span>
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
  const link = buildShareLink(entry.id);

  function handleView() {
    window.location.hash = `view=${entry.id}`;
    window.location.reload();
  }

  function handleCopy() {
    navigator.clipboard.writeText(link).catch(() => {});
  }

  return (
    <tr className="sh-dir-row">
      <td className="sh-dir-alias">{entry.alias}</td>
      <td className="sh-dir-updated">{age}</td>
      <td className="sh-dir-actions">
        <button type="button" className="sh-dir-view-btn" onClick={handleView}>
          View
        </button>
        <button type="button" className="sh-dir-copy-btn" onClick={handleCopy} title="Copy link">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
