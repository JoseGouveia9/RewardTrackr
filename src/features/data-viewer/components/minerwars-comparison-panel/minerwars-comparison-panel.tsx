import { useEffect, useRef, useState } from "react";
import { useMinerWarsComparison } from "../../hooks/use-minerwars-comparison";
import { BtcIcon } from "../icons/currency-icons";
import "./minerwars-comparison-panel.css";

interface MinerWarsComparisonPanelProps {
  cacheVersion?: number;
  onRefreshMinerwarsTable?: () => Promise<void> | void;
}

function fmtBtc(btc: number): string {
  return btc.toLocaleString("en-US", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}

function fmtPct(pct: number): string {
  return (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
}

export function MinerWarsComparisonPanel({
  cacheVersion = 0,
  onRefreshMinerwarsTable,
}: MinerWarsComparisonPanelProps) {
  const {
    cycles,
    loadingCycles,
    selectedCycleId,
    setSelectedCycleId,
    data,
    loading,
    error,
    refresh,
  } = useMinerWarsComparison({ cacheVersion, onRefreshMinerwarsTable });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [dropdownOpen]);

  const showSkeleton = loadingCycles || (loading && !data);

  if (showSkeleton) {
    return (
      <div className="mwcp mwcp--loading">
        <span className="mwcp-spinner" aria-hidden="true" />
        <span>Computing cycle comparison…</span>
      </div>
    );
  }

  if (error && !data) return null;

  const isActual = data?.actualMinerWarsBtc != null;
  const clanMinerWarsBtc = (data?.clanMinerWarsSats ?? 0) / 1e8;
  const btcFundBtc = data?.btcFundBtc ?? 0;
  const soloEquivBtc = (data?.soloEquivSats ?? 0) / 1e8;
  const effectiveMw = data != null ? (data.actualMinerWarsBtc ?? data.minerWarsSats / 1e8) : 0;
  const effectiveDiff = effectiveMw - soloEquivBtc;
  const effectiveDiffPct = soloEquivBtc > 0 ? (effectiveDiff / soloEquivBtc) * 100 : null;
  const effectiveProgress =
    data != null && data.targetSoloSats > 0
      ? (effectiveMw / (data.targetSoloSats / 1e8)) * 100
      : null;
  const isPositive = effectiveDiff >= 0;
  const projecting = (data?.targetProjectedDays ?? 0) > 0;
  const isCycleLive = data != null && data.today <= data.cycleEnd;
  const showNoClanAnalyticsWarning =
    data != null && !data.hasClanAnalytics && data.actualMinerWarsBtc == null;
  const showBtcFundZeroWarning =
    data != null && data.btcFundIsZero && data.actualMinerWarsBtc == null;

  const selectedCycle = cycles.find((c) => c.cycleId === selectedCycleId);

  return (
    <div className="mwcp">
      {/* Cycle dropdown */}
      {cycles.length > 0 && (
        <div className="mwcp-cycle-selector-row">
          <div className="mwcp-cycle-dropdown" ref={dropdownRef}>
            <button
              type="button"
              className="mwcp-cycle-dropdown-btn"
              onClick={() => setDropdownOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
            >
              <span>Cycle {selectedCycle?.cycleId ?? "—"}</span>
              {selectedCycle && (
                <span className={`mwcp-cycle-badge mwcp-cycle-badge--${selectedCycle.status}`}>
                  {selectedCycle.status === "in-progress"
                    ? "Live"
                    : selectedCycle.status === "pending"
                      ? "Pending"
                      : "Done"}
                </span>
              )}
              <svg
                className="mwcp-dropdown-chevron"
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M0 0l5 6 5-6z" />
              </svg>
            </button>
            {dropdownOpen && (
              <ul className="mwcp-cycle-dropdown-list" role="listbox">
                {cycles.map((c) => (
                  <li
                    key={c.cycleId}
                    role="option"
                    aria-selected={c.cycleId === selectedCycleId}
                    className={`mwcp-cycle-dropdown-item${c.cycleId === selectedCycleId ? " mwcp-cycle-dropdown-item--active" : ""}`}
                    onClick={() => {
                      setSelectedCycleId(c.cycleId);
                      setDropdownOpen(false);
                    }}
                  >
                    <span>Cycle {c.cycleId}</span>
                    <span className={`mwcp-cycle-badge mwcp-cycle-badge--${c.status}`}>
                      {c.status === "in-progress"
                        ? "Live"
                        : c.status === "pending"
                          ? "Pending"
                          : "Done"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {data && (
            <span className="mwcp-window mwcp-window--inline">
              {data.cycleStart} → {data.cycleEnd}
            </span>
          )}
          {selectedCycle?.status === "in-progress" || selectedCycle?.status === "pending" ? (
            <button
              type="button"
              className="mwcp-refresh-btn"
              onClick={() => void refresh()}
              disabled={loading}
              title={
                selectedCycle?.status === "pending" ? "Refresh pending cycle" : "Refresh live cycle"
              }
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
                className={loading ? "mwcp-spin" : undefined}
                aria-hidden="true"
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          ) : (
            loading && data && <span className="mwcp-spinner mwcp-spinner--sm" aria-hidden="true" />
          )}
        </div>
      )}

      {data && (
        <>
          <div className="mwcp-grid">
            {/* Left: elapsed comparison */}
            <div className="mwcp-section">
              <div className="mwcp-row">
                <span className="mwcp-label">MinerWars{isActual ? "" : " (est.)"}</span>
                <span className="mwcp-value">
                  {showBtcFundZeroWarning && (
                    <svg
                      className="mwcp-warn-icon"
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
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  )}
                  {fmtBtc(effectiveMw)} <BtcIcon />
                </span>
              </div>
              <div className="mwcp-row">
                <span className="mwcp-label">Clan MinerWars (est.)</span>
                <span className="mwcp-value">
                  {fmtBtc(clanMinerWarsBtc)} <BtcIcon />
                </span>
              </div>
              <div className="mwcp-row">
                <span className="mwcp-label">
                  BTC fund (current)
                  <span className="mwcp-projection-badge">
                    {data.targetActualDays}{" "}
                    {data.targetActualDays === 1 ? "funded day" : "funded days"}
                  </span>
                </span>
                <span className="mwcp-value">
                  {fmtBtc(btcFundBtc)} <BtcIcon />
                </span>
              </div>
              <div className="mwcp-row">
                <span className="mwcp-label">
                  Solo equiv (est.)
                  <span className="mwcp-projection-badge">
                    {data.targetActualDays}{" "}
                    {data.targetActualDays === 1 ? "funded day" : "funded days"}
                  </span>
                </span>
                <span className="mwcp-value">
                  {fmtBtc(soloEquivBtc)} <BtcIcon />
                </span>
              </div>
              <div className="mwcp-divider" />
              <div className="mwcp-row">
                <span className="mwcp-label">Difference</span>
                <span
                  className={`mwcp-value mwcp-value--diff ${isPositive ? "mwcp-value--pos" : "mwcp-value--neg"}`}
                >
                  {(effectiveDiff > 0 ? "+" : "") + fmtBtc(effectiveDiff)} <BtcIcon />
                  {effectiveDiffPct != null && (
                    <span className="mwcp-pct">{fmtPct(effectiveDiffPct)}</span>
                  )}
                </span>
              </div>
            </div>

            {/* Right: target + progress */}
            <div className="mwcp-section mwcp-section--target">
              <div className="mwcp-row">
                <span className="mwcp-label">
                  Solo target
                  <span className="mwcp-projection-badge">
                    {projecting
                      ? `${data.targetActualDays} ${data.targetActualDays === 1 ? "funded day" : "funded days"} + ${data.targetProjectedDays} projected`
                      : `${data.targetActualDays} ${data.targetActualDays === 1 ? "funded day" : "funded days"}`}
                  </span>
                </span>
                <span className="mwcp-value">
                  {fmtBtc(data.targetSoloSats / 1e8)} <BtcIcon />
                </span>
              </div>
              <div className="mwcp-divider" />
              <div className="mwcp-row">
                <span className="mwcp-label">MinerWars progress</span>
                <span className="mwcp-value mwcp-value--progress">
                  {fmtBtc(effectiveMw)} <BtcIcon />
                  {effectiveProgress != null && (
                    <span
                      className={`mwcp-pct ${effectiveProgress >= 100 ? "mwcp-value--pos" : ""}`}
                    >
                      {effectiveProgress.toFixed(1)}% of target
                    </span>
                  )}
                </span>
              </div>
              {effectiveProgress != null && (
                <div className="mwcp-progress-bar">
                  <div
                    className={`mwcp-progress-fill${effectiveProgress >= 100 ? " mwcp-progress-fill--over" : ""}`}
                    style={{ width: `${Math.min(effectiveProgress, 100).toFixed(1)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {showBtcFundZeroWarning && (
            <div className="mwcp-notice mwcp-notice--warn">
              ⚠ Your league BTC fund is currently 0. MinerWars estimate will show 0 until the fund
              start being filled.
            </div>
          )}
          {showNoClanAnalyticsWarning && (
            <div className="mwcp-notice mwcp-notice--warn">
              ⚠ No clan analytics (clan may be &lt;30 days old) — using{" "}
              {isCycleLive ? "current clan power" : "clan power at cycle end"} for all rounds.
              Estimation may be over/under-inflated.
            </div>
          )}
        </>
      )}
    </div>
  );
}
