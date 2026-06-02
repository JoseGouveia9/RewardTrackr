import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CycleInfo } from "../../api/minerwars-comparison";
import { useMinerWarsComparison } from "../../hooks/use-minerwars-comparison";
import { useOutsideClick } from "../../hooks/use-outside-click";
import type { Currency } from "../../types";
import { BtcIcon, GmtIcon } from "../icons/currency-icons";
import "./minerwars-comparison-panel.css";

interface CycleDropdownProps {
  cycles: CycleInfo[];
  selectedCycleId: number | null;
  onSelect: (id: number) => void;
}

function CycleDropdown({ cycles, selectedCycleId, onSelect }: CycleDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedCycle = cycles.find((c) => c.cycleId === selectedCycleId);

  useOutsideClick(ref, () => setOpen(false), open);

  function statusLabel(status: CycleInfo["status"]) {
    if (status === "in-progress") return t("cycleTracker.statusLive");
    if (status === "pending") return t("cycleTracker.statusPending");
    return t("cycleTracker.statusDone");
  }

  return (
    <div className="minerwars-panel-cycle-dropdown" ref={ref}>
      <button
        type="button"
        className="minerwars-panel-cycle-dropdown-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{t("cycleTracker.cycle", { id: selectedCycle?.cycleId ?? "\u2014" })}</span>
        {selectedCycle && (
          <span
            className={`minerwars-panel-cycle-badge minerwars-panel-cycle-badge--${selectedCycle.status}`}
          >
            {statusLabel(selectedCycle.status)}
          </span>
        )}
        <svg
          className="minerwars-panel-dropdown-chevron"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M0 0l5 6 5-6z" />
        </svg>
      </button>
      {open && (
        <ul className="minerwars-panel-cycle-dropdown-list" role="listbox">
          {cycles.map((c) => (
            <li
              key={c.cycleId}
              role="option"
              aria-selected={c.cycleId === selectedCycleId}
              className={`minerwars-panel-cycle-dropdown-item${c.cycleId === selectedCycleId ? " minerwars-panel-cycle-dropdown-item--active" : ""}`}
              onClick={() => {
                onSelect(c.cycleId);
                setOpen(false);
              }}
            >
              <span>Cycle {c.cycleId}</span>
              <span
                className={`minerwars-panel-cycle-badge minerwars-panel-cycle-badge--${c.status}`}
              >
                {statusLabel(c.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MinerWarsSkeleton() {
  return (
    <div className="minerwars-panel">
      <div className="minerwars-panel-cycle-selector-row">
        <div className="minerwars-panel-skeleton minerwars-panel-skeleton--dropdown" />
        <div className="minerwars-panel-skeleton minerwars-panel-skeleton--window" />
        <div className="minerwars-panel-skeleton minerwars-panel-skeleton--refresh" />
      </div>
      <div className="minerwars-panel-grid minerwars-panel-grid--3col">
        <div className="minerwars-panel-section">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="minerwars-panel-row">
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--value" />
            </div>
          ))}
        </div>
        <div className="minerwars-panel-section minerwars-panel-section--right">
          {[0, 1].map((i) => (
            <div key={i} className="minerwars-panel-row">
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--value" />
            </div>
          ))}
          <div className="minerwars-panel-skeleton minerwars-panel-skeleton--progress" />
        </div>
        <div className="minerwars-panel-section minerwars-panel-section--right">
          {[0, 1].map((i) => (
            <div key={i} className="minerwars-panel-row">
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--value" />
            </div>
          ))}
          <div className="minerwars-panel-skeleton minerwars-panel-skeleton--progress" />
        </div>
      </div>
    </div>
  );
}

interface MinerWarsComparisonPanelProps {
  cacheVersion?: number;
  currency?: Currency;
}

function fmtBtc(btc: number): string {
  return btc.toLocaleString("en-US", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}

function fmtGmt(gmt: number): string {
  const truncated = Math.trunc(gmt * 100) / 100;
  return truncated.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(pct: number): string {
  return (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
}

export function MinerWarsComparisonPanel({
  cacheVersion = 0,
  currency = "BTC",
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
  } = useMinerWarsComparison({ cacheVersion });

  const showSkeleton = loadingCycles || loading || (selectedCycleId !== null && !data && !error);

  if (showSkeleton) return <MinerWarsSkeleton />;

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
  // Treat "pending" cycles (ended but no actual payment yet) the same as live
  // so the panel shows the round-based estimation view rather than a zeroed-out
  // completed view. Switches to false only when actual income is confirmed.
  const isCycleLive = data != null && data.actualMinerWarsBtc == null;

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
  const toGmt = (btc: number) => (btc * data!.btcPrice!) / data!.gmtPrice!;
  const fmtVal = (btc: number) => (showGmt ? fmtGmt(toGmt(btc)) : fmtBtc(btc));
  const ValIcon = showGmt ? GmtIcon : BtcIcon;

  const selectedCycle = cycles.find((c) => c.cycleId === selectedCycleId);

  return (
    <div className="minerwars-panel">
      {cycles.length > 0 && (
        <div className="minerwars-panel-cycle-selector-row">
          <CycleDropdown
            cycles={cycles}
            selectedCycleId={selectedCycleId}
            onSelect={setSelectedCycleId}
          />
          {data && (
            <span className="minerwars-panel-window minerwars-panel-window--inline">
              {data.cycleStart} → {data.cycleEnd} UTC
            </span>
          )}
          {isLoggedIn &&
            (selectedCycle?.status === "in-progress" || selectedCycle?.status === "pending") && (
              <button
                type="button"
                className="minerwars-panel-refresh-btn"
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
                  className={loading ? "minerwars-panel-spin" : undefined}
                  aria-hidden="true"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            )}
        </div>
      )}

      {data && (
        <>
          <div
            className={`minerwars-panel-grid${isCycleLive && clanTargetBtc > 0 ? " minerwars-panel-grid--3col" : ""}`}
          >
            <div className="minerwars-panel-section">
              <div className="minerwars-panel-row">
                <span className="minerwars-panel-label">
                  {isActual ? t("cycleTracker.minerWarsActual") : t("cycleTracker.minerWarsEst")}
                </span>
                <span className="minerwars-panel-value">
                  {showBtcFundZeroWarning && (
                    <svg
                      className="minerwars-panel-warn-icon"
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
              <div className="minerwars-panel-row">
                <span className="minerwars-panel-label">
                  {t("cycleTracker.soloEquiv")}
                  <span className="minerwars-panel-projection-badge">
                    {t("cycleTracker.day", { count: data.targetActualDays })}
                  </span>
                </span>
                <span className="minerwars-panel-value">
                  {fmtVal(soloEquivBtc)} <ValIcon />
                </span>
              </div>
              <div className="minerwars-panel-divider" />
              <div className="minerwars-panel-row">
                <span className="minerwars-panel-label">{t("cycleTracker.difference")}</span>
                <span
                  className={`minerwars-panel-value minerwars-panel-value--diff ${isPositive ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
                >
                  {(effectiveDiff > 0 ? "+" : "") + fmtVal(effectiveDiff)} <ValIcon />
                  {effectiveDiffPct != null && (
                    <span className="minerwars-panel-pct">{fmtPct(effectiveDiffPct)}</span>
                  )}
                </span>
              </div>
              {data.maintenanceBtc != null && (
                <>
                  <div className="minerwars-panel-divider" />
                  <div className="minerwars-panel-row">
                    <span className="minerwars-panel-label minerwars-panel-label--sub">
                      {t("cycleTracker.maintenanceEst")}
                    </span>
                    <span className="minerwars-panel-value minerwars-panel-value--neg">
                      {showGmt && data.maintenanceGmt != null ? (
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
                    <div className="minerwars-panel-row">
                      <span className="minerwars-panel-label minerwars-panel-label--sub">
                        {t("cycleTracker.netEst")}
                      </span>
                      <span
                        className={`minerwars-panel-value ${(showGmt ? (data.netGmt ?? 0) : data.netBtc) >= 0 ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
                      >
                        {showGmt && data.netGmt != null ? (
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

            <div className="minerwars-panel-section minerwars-panel-section--right">
              <div className="minerwars-panel-row">
                <span className="minerwars-panel-label">
                  {t("cycleTracker.soloTarget")}
                  {projecting && (
                    <span className="minerwars-panel-projection-badge">
                      {t("cycleTracker.day", { count: data.targetActualDays })} +{" "}
                      {data.targetProjectedDays} {t("cycleTracker.projected")}
                    </span>
                  )}
                </span>
                <span className="minerwars-panel-value">
                  {fmtVal(data.targetSoloSats / 1e8)} <ValIcon />
                </span>
              </div>
              <div className="minerwars-panel-divider" />
              <div className="minerwars-panel-row">
                <span className="minerwars-panel-label">{t("cycleTracker.minerWarsProgress")}</span>
                <span className="minerwars-panel-value minerwars-panel-value--progress">
                  {fmtVal(effectiveMw)} <ValIcon />
                  {effectiveProgress != null && (
                    <span
                      className={`minerwars-panel-pct ${effectiveProgress >= 100 ? "minerwars-panel-value--pos" : ""}`}
                    >
                      {effectiveProgress.toFixed(1)}
                      {t("cycleTracker.ofTarget")}
                    </span>
                  )}
                </span>
              </div>
              {effectiveProgress != null && (
                <div className="minerwars-panel-progress-bar">
                  <div
                    className={`minerwars-panel-progress-fill${effectiveProgress >= 100 ? " minerwars-panel-progress-fill--over" : ""}`}
                    style={{ width: `${Math.min(effectiveProgress, 100).toFixed(1)}%` }}
                  />
                </div>
              )}
            </div>

            {isCycleLive && clanTargetBtc > 0 && (
              <div className="minerwars-panel-section minerwars-panel-section--right">
                <div className="minerwars-panel-row">
                  <span className="minerwars-panel-label">
                    {t("cycleTracker.clanTarget")}
                    {projecting && (
                      <span className="minerwars-panel-projection-badge">
                        {t("cycleTracker.day", { count: data.targetActualDays })} +{" "}
                        {data.targetProjectedDays} {t("cycleTracker.projected")}
                      </span>
                    )}
                  </span>
                  <span className="minerwars-panel-value">
                    {fmtVal(clanTargetBtc)} <ValIcon />
                  </span>
                </div>
                <div className="minerwars-panel-divider" />
                <div className="minerwars-panel-row">
                  <span className="minerwars-panel-label">{t("cycleTracker.clanProgress")}</span>
                  <span className="minerwars-panel-value minerwars-panel-value--progress">
                    {fmtVal(clanMinerWarsBtc)} <ValIcon />
                    {clanProgress != null && (
                      <span
                        className={`minerwars-panel-pct ${clanProgress >= 100 ? "minerwars-panel-value--pos" : ""}`}
                      >
                        {clanProgress.toFixed(1)}
                        {t("cycleTracker.ofTarget")}
                      </span>
                    )}
                  </span>
                </div>
                {clanProgress != null && (
                  <div className="minerwars-panel-progress-bar">
                    <div
                      className={`minerwars-panel-progress-fill${clanProgress >= 100 ? " minerwars-panel-progress-fill--over" : ""}`}
                      style={{ width: `${Math.min(clanProgress, 100).toFixed(1)}%` }}
                    />
                  </div>
                )}
                {clanBlocksNeeded != null && clanBlocksNeeded > 0 && (
                  <div className="minerwars-panel-row minerwars-panel-row--blocks-needed">
                    <span className="minerwars-panel-label">{t("cycleTracker.blocksNeeded")}</span>
                    <span className="minerwars-panel-value minerwars-panel-value--blocks">
                      {t("cycleTracker.block", { count: clanBlocksNeeded })}
                      {btcPerBlockSats != null && (
                        <span className="minerwars-panel-pct">
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
            <div className="minerwars-panel-notice minerwars-panel-notice--warn">
              ⚠ {t("cycleTracker.warnBtcFundZero")}
            </div>
          )}
          {showNoClanAnalyticsWarning && (
            <div className="minerwars-panel-notice minerwars-panel-notice--warn">
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
