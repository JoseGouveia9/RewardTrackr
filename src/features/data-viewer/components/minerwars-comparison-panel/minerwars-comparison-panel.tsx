import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMinerWarsComparison } from "../../hooks/use-minerwars-comparison";
import type { Currency } from "../../types";
import { BtcIcon, GmtIcon } from "../icons/currency-icons";
import "./minerwars-comparison-panel.css";

interface MinerWarsComparisonPanelProps {
  cacheVersion?: number;
  currency?: Currency;
  onRefreshMinerwarsTable?: () => Promise<void> | void;
}

function fmtBtc(btc: number): string {
  return btc.toLocaleString("en-US", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}

function fmtGmt(gmt: number): string {
  return gmt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(pct: number): string {
  return (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
}

export function MinerWarsComparisonPanel({
  cacheVersion = 0,
  currency = "BTC",
  onRefreshMinerwarsTable,
}: MinerWarsComparisonPanelProps) {
  const { t } = useTranslation();
  const {
    cycles,
    loadingCycles,
    selectedCycleId,
    setSelectedCycleId,
    data,
    loading,
    error,
    refresh,
    isLoggedIn,
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
        <span>{t("cycleTracker.computing")}</span>
      </div>
    );
  }

  if (error && !data) return null;

  const isActual = data?.actualMinerWarsBtc != null;
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

  // Clan target (live only)
  const clanMinerWarsBtc = (data?.clanMinerWarsSats ?? 0) / 1e8;
  const clanTargetBtc = (data?.clanTargetSoloSats ?? 0) / 1e8;
  const clanProgress =
    isCycleLive && clanTargetBtc > 0 ? (clanMinerWarsBtc / clanTargetBtc) * 100 : null;
  const btcPerBlockSats = data?.btcPerBlockSats ?? null;
  const clanBlocksNeeded =
    isCycleLive && btcPerBlockSats != null && btcPerBlockSats > 0
      ? Math.ceil(
          ((data!.clanTargetSoloSats ?? 0) - (data?.clanMinerWarsSats ?? 0)) / btcPerBlockSats,
        )
      : null;
  const showNoClanAnalyticsWarning =
    data != null && !data.hasClanAnalytics && data.actualMinerWarsBtc == null;
  const showBtcFundZeroWarning =
    data != null && data.btcFundIsZero && data.actualMinerWarsBtc == null;

  const showGmt = currency === "GMT" && (data?.btcPrice ?? 0) > 0 && (data?.gmtPrice ?? 0) > 0;
  const toGmt = (btc: number) => (showGmt ? (btc * data!.btcPrice!) / data!.gmtPrice! : btc);
  const fmtVal = (btc: number) => (showGmt ? fmtGmt(toGmt(btc)) : fmtBtc(btc));
  const ValIcon = showGmt ? GmtIcon : BtcIcon;

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
              <span>{t("cycleTracker.cycle", { id: selectedCycle?.cycleId ?? "—" })}</span>
              {selectedCycle && (
                <span className={`mwcp-cycle-badge mwcp-cycle-badge--${selectedCycle.status}`}>
                  {selectedCycle.status === "in-progress"
                    ? t("cycleTracker.statusLive")
                    : selectedCycle.status === "pending"
                      ? t("cycleTracker.statusPending")
                      : t("cycleTracker.statusDone")}
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
                        ? t("cycleTracker.statusLive")
                        : c.status === "pending"
                          ? t("cycleTracker.statusPending")
                          : t("cycleTracker.statusDone")}
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
          {isLoggedIn &&
          (selectedCycle?.status === "in-progress" || selectedCycle?.status === "pending") ? (
            <button
              type="button"
              className="mwcp-refresh-btn"
              onClick={() => void refresh()}
              disabled={loading}
              title={
                selectedCycle?.status === "pending"
                  ? t("cycleTracker.refreshPending")
                  : t("cycleTracker.refreshLive")
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
          <div className={`mwcp-grid${isCycleLive && clanTargetBtc > 0 ? " mwcp-grid--3col" : ""}`}>
            {/* Section 1: Difference */}
            <div className="mwcp-section">
              <div className="mwcp-row">
                <span className="mwcp-label">
                  {isActual ? t("cycleTracker.minerWarsActual") : t("cycleTracker.minerWarsEst")}
                </span>
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
                  {fmtVal(effectiveMw)} <ValIcon />
                </span>
              </div>
              <div className="mwcp-row">
                <span className="mwcp-label">
                  {t("cycleTracker.soloEquiv")}
                  <span className="mwcp-projection-badge">
                    {t("cycleTracker.day", { count: data.targetActualDays })}
                  </span>
                </span>
                <span className="mwcp-value">
                  {fmtVal(soloEquivBtc)} <ValIcon />
                </span>
              </div>
              <div className="mwcp-divider" />
              <div className="mwcp-row">
                <span className="mwcp-label">{t("cycleTracker.difference")}</span>
                <span
                  className={`mwcp-value mwcp-value--diff ${isPositive ? "mwcp-value--pos" : "mwcp-value--neg"}`}
                >
                  {(effectiveDiff > 0 ? "+" : "") + fmtVal(effectiveDiff)} <ValIcon />
                  {effectiveDiffPct != null && (
                    <span className="mwcp-pct">{fmtPct(effectiveDiffPct)}</span>
                  )}
                </span>
              </div>
              {data.maintenanceBtc != null && (
                <>
                  <div className="mwcp-divider" />
                  <div className="mwcp-row">
                    <span className="mwcp-label mwcp-label--sub">
                      {t("cycleTracker.maintenanceEst")}
                    </span>
                    <span className="mwcp-value mwcp-value--neg">
                      {currency === "GMT" && data.maintenanceGmt != null ? (
                        <>
                          {`-${fmtGmt(data.maintenanceGmt)}`} <GmtIcon />
                        </>
                      ) : (
                        <>
                          {`-${fmtBtc(data.maintenanceBtc)}`} <BtcIcon />
                        </>
                      )}
                    </span>
                  </div>
                  {data.netBtc != null && (
                    <div className="mwcp-row">
                      <span className="mwcp-label mwcp-label--sub">{t("cycleTracker.netEst")}</span>
                      <span
                        className={`mwcp-value ${(currency === "GMT" ? (data.netGmt ?? 0) : data.netBtc) >= 0 ? "mwcp-value--pos" : "mwcp-value--neg"}`}
                      >
                        {currency === "GMT" && data.netGmt != null ? (
                          <>
                            {fmtGmt(data.netGmt)} <GmtIcon />
                          </>
                        ) : (
                          <>
                            {fmtBtc(data.netBtc)} <BtcIcon />
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Section 2: Solo target + progress */}
            <div className="mwcp-section mwcp-section--right">
              <div className="mwcp-row">
                <span className="mwcp-label">
                  {t("cycleTracker.soloTarget")}
                  {projecting && (
                    <span className="mwcp-projection-badge">
                      {t("cycleTracker.day", { count: data.targetActualDays })} +{" "}
                      {data.targetProjectedDays} {t("cycleTracker.projected")}
                    </span>
                  )}
                </span>
                <span className="mwcp-value">
                  {fmtVal(data.targetSoloSats / 1e8)} <ValIcon />
                </span>
              </div>
              <div className="mwcp-divider" />
              <div className="mwcp-row">
                <span className="mwcp-label">{t("cycleTracker.minerWarsProgress")}</span>
                <span className="mwcp-value mwcp-value--progress">
                  {fmtVal(effectiveMw)} <ValIcon />
                  {effectiveProgress != null && (
                    <span
                      className={`mwcp-pct ${effectiveProgress >= 100 ? "mwcp-value--pos" : ""}`}
                    >
                      {effectiveProgress.toFixed(1)}
                      {t("cycleTracker.ofTarget")}
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

            {/* Section 3: Clan target + progress — live cycles only */}
            {isCycleLive && clanTargetBtc > 0 && (
              <div className="mwcp-section mwcp-section--right">
                <div className="mwcp-row">
                  <span className="mwcp-label">
                    {t("cycleTracker.clanTarget")}
                    {projecting && (
                      <span className="mwcp-projection-badge">
                        {t("cycleTracker.day", { count: data.targetActualDays })} +{" "}
                        {data.targetProjectedDays} {t("cycleTracker.projected")}
                      </span>
                    )}
                  </span>
                  <span className="mwcp-value">
                    {fmtVal(clanTargetBtc)} <ValIcon />
                  </span>
                </div>
                <div className="mwcp-divider" />
                <div className="mwcp-row">
                  <span className="mwcp-label">{t("cycleTracker.clanProgress")}</span>
                  <span className="mwcp-value mwcp-value--progress">
                    {fmtVal(clanMinerWarsBtc)} <ValIcon />
                    {clanProgress != null && (
                      <span className={`mwcp-pct ${clanProgress >= 100 ? "mwcp-value--pos" : ""}`}>
                        {clanProgress.toFixed(1)}
                        {t("cycleTracker.ofTarget")}
                      </span>
                    )}
                  </span>
                </div>
                {clanProgress != null && (
                  <div className="mwcp-progress-bar">
                    <div
                      className={`mwcp-progress-fill${clanProgress >= 100 ? " mwcp-progress-fill--over" : ""}`}
                      style={{ width: `${Math.min(clanProgress, 100).toFixed(1)}%` }}
                    />
                  </div>
                )}
                {clanBlocksNeeded != null && clanBlocksNeeded > 0 && (
                  <div className="mwcp-row" style={{ marginTop: 4 }}>
                    <span className="mwcp-label">{t("cycleTracker.blocksNeeded")}</span>
                    <span className="mwcp-value" style={{ fontSize: "0.8rem" }}>
                      {t("cycleTracker.block", { count: clanBlocksNeeded })}
                      {btcPerBlockSats != null && (
                        <span className="mwcp-pct">
                          {t("cycleTracker.satsPerBlock", { sats: btcPerBlockSats.toFixed(0) })}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {showBtcFundZeroWarning && (
            <div className="mwcp-notice mwcp-notice--warn">
              ⚠ {t("cycleTracker.warnBtcFundZero")}
            </div>
          )}
          {showNoClanAnalyticsWarning && (
            <div className="mwcp-notice mwcp-notice--warn">
              ⚠{" "}
              {isCycleLive
                ? t("cycleTracker.warnNoClanAnalyticsLive")
                : t("cycleTracker.warnNoClanAnalyticsDone")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
