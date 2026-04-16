import { useEffect, useState } from "react";
import { fetchDirectory } from "./api";
import type { DirectoryEntry } from "./types";
import { DirectoryRow } from "./shared-banner";

// Full-page community directory listing all shared profiles.
export function CommunityPage({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDirectory()
      .then(setEntries)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load directory"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="sh-community">
      <div className="sh-community-header">
        <button type="button" className="dv-back-btn" onClick={onClose} aria-label="Back">
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
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
        <span className="dv-title">Community</span>
      </div>

      <p className="sh-community-sub">
        Shared profiles from RewardTrackr users. Click any row to view their records.
      </p>

      {loading && <p className="sh-community-loading">Loading…</p>}
      {error && <p className="sh-community-error">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p className="sh-community-empty">No shared profiles yet. Be the first!</p>
      )}

      {entries.length > 0 && (
        <div className="sh-community-table-wrap">
          <table className="sh-community-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <DirectoryRow key={e.id} entry={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
