import { useState } from "react";
import { publishProfile, isWorkerConfigured } from "./api";
import type { CacheState, RewardKey } from "@/features/export/types";
import { ALL_REWARD_KEYS } from "@/features/export/config/reward-configs";
import { formatAge } from "@/features/export/utils/cache";

// Modal that lets the user publish their cached records as a shareable link.
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
  const [alias, setAlias] = useState(defaultAlias || "");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; updatedAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const availableSheets = ALL_REWARD_KEYS.filter((k) => !!cache[k]);
  const [selectedKeys, setSelectedKeys] = useState<Set<RewardKey>>(new Set(availableSheets));

  const sheetsToShare = availableSheets.filter((k) => selectedKeys.has(k));
  const shareLink = result
    ? `${window.location.origin}${window.location.pathname}#view=${result.id}`
    : "";

  const aliasValid = /^[a-zA-Z0-9_-]{1,40}$/.test(alias.trim());
  const workerReady = isWorkerConfigured();

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
      const res = await publishProfile(alias.trim(), sheets, authToken);
      setResult(res);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="sh-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sh-modal">
        <div className="sh-modal-header">
          <span className="sh-modal-title">Share Records</span>
          <button type="button" className="sh-modal-close" onClick={onClose} aria-label="Close">
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
            <p className="sh-modal-desc">
              Your records will be publicly visible. Anyone with the link can view them, read-only.
            </p>

            <label className="sh-modal-label" htmlFor="sh-alias-input">
              Display name
            </label>
            <input
              id="sh-alias-input"
              type="text"
              className="sh-modal-input"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. Moustachio"
              maxLength={40}
              disabled={status === "loading"}
              autoFocus
            />
            {alias && !aliasValid && (
              <p className="sh-modal-hint sh-modal-hint--error">
                Letters, numbers, _ and - only (1–40 chars)
              </p>
            )}

            <div className="sh-modal-sheets">
              <span className="sh-modal-sheets-label">Sheets included</span>
              <div className="sh-modal-sheet-list">
                {availableSheets.map((k) => {
                  const entry = cache[k]!;
                  const checked = selectedKeys.has(k);
                  return (
                    <label
                      key={k}
                      className={`sh-modal-sheet-row sh-modal-sheet-row--check${checked ? " sh-modal-sheet-row--checked" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="sh-modal-sheet-checkbox"
                        checked={checked}
                        onChange={() => toggleSheet(k)}
                        disabled={status === "loading"}
                      />
                      <span className="sh-modal-sheet-name">{entry.sheetName}</span>
                      <span className="sh-modal-sheet-meta">
                        {entry.records.length} records · {formatAge(entry.fetchedAt)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {!workerReady && (
              <p className="sh-modal-hint sh-modal-hint--warn">
                Sharing requires a Cloudflare Worker. See{" "}
                <a
                  href="https://github.com/JoseGouveia9/RewardTrackr#sharing-setup"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  setup guide
                </a>
                .
              </p>
            )}

            {status === "error" && <p className="sh-modal-hint sh-modal-hint--error">{error}</p>}

            <div className="sh-modal-actions">
              <button
                type="button"
                className="sh-modal-btn sh-modal-btn--primary"
                onClick={handleShare}
                disabled={
                  !aliasValid ||
                  !workerReady ||
                  !authToken ||
                  sheetsToShare.length === 0 ||
                  status === "loading"
                }
              >
                {status === "loading" ? "Publishing…" : "Share"}
              </button>
              <button
                type="button"
                className="sh-modal-btn sh-modal-btn--ghost"
                onClick={onClose}
                disabled={status === "loading"}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="sh-modal-success-msg">
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
            <div className="sh-modal-link-row">
              <input
                type="text"
                className="sh-modal-link-input"
                value={shareLink}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                className={`sh-modal-copy-btn${copied ? " sh-modal-copy-btn--done" : ""}`}
                onClick={handleCopy}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button type="button" className="sh-modal-btn sh-modal-btn--ghost" onClick={onClose}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
