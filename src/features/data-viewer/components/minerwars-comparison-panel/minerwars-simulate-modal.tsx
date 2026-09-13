import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { CloseIcon } from "../icons";
import { PercentInput } from "./minerwars-panel-parts";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "../icons/currency-icons";

function fmtBtc(btc: number): string {
  const truncated = Math.trunc(btc * 1e8) / 1e8;
  return truncated.toLocaleString("en-US", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}

function fmtGmt(gmt: number): string {
  const truncated = Math.trunc(gmt * 100) / 100;
  return truncated.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFiat(value: number, currency: string): string {
  void currency;
  const truncated = Math.trunc(value * 100) / 100;
  try {
    return truncated.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return truncated.toFixed(2);
  }
}

function fmtPct(pct: number): string {
  return (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
}

type SimulatedResult = {
  minerWarsSats: number;
  soloEquivSats: number;
  diffSats: number;
  diffPct: number | null;
  maintenanceBtc: number | null;
  maintenanceGmt: number | null;
  maintenanceUsd: number | null;
  netBtc: number | null;
  netGmt: number | null;
  netUsd: number | null;
};

interface MinerWarsSimulateModalProps {
  open: boolean;
  simulated: SimulatedResult | null;
  activeCurrencyOptions: Array<{ key: string; icon: ReactNode; title: string }>;
  activeCurrencyOption?: { key: string; icon: ReactNode; title: string };
  handleCycleCurrency: () => void;
  renderValueIcon: () => ReactNode;
  formatBtcValue: (btc: number, histGmt: number | null, histUsd?: number | null) => string;
  showGmt: boolean;
  showUsd: boolean;
  showFiat: boolean;
  extraFiatRate: number | null;
  extraFiatCode: string | null;
  simTh: string;
  setSimTh: (value: string) => void;
  simUserEE: string;
  setSimUserEE: (value: string) => void;
  simLeagueEE: string;
  setSimLeagueEE: (value: string) => void;
  simPersonalDiscountPct: string;
  setSimPersonalDiscountPct: (value: string) => void;
  simLeagueDiscountPct: string;
  setSimLeagueDiscountPct: (value: string) => void;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function MinerWarsSimulateModal({
  open,
  simulated,
  activeCurrencyOptions,
  activeCurrencyOption,
  handleCycleCurrency,
  renderValueIcon,
  formatBtcValue,
  showGmt,
  showUsd,
  showFiat,
  extraFiatRate,
  extraFiatCode,
  simTh,
  setSimTh,
  simUserEE,
  setSimUserEE,
  simLeagueEE,
  setSimLeagueEE,
  simPersonalDiscountPct,
  setSimPersonalDiscountPct,
  simLeagueDiscountPct,
  setSimLeagueDiscountPct,
  onClose,
  containerRef,
}: MinerWarsSimulateModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return createPortal(
    <div className="minerwars-panel-simulate-overlay">
      <div className="minerwars-panel-simulate" ref={containerRef} role="dialog" aria-modal="true">
        <div className="minerwars-panel-simulate-header">
          <span className="minerwars-panel-simulate-title">
            {t("cycleTracker.simulateModalTitle", { defaultValue: "Simulate" })}
          </span>
          <button
            type="button"
            className="minerwars-panel-simulate-close"
            onClick={onClose}
            aria-label={t("cycleTracker.simulateClose")}
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>
        <div className="minerwars-panel-simulate-body">
          <div className="minerwars-panel-simulate-desc-row">
            <p className="minerwars-panel-simulate-hint">
              {t("cycleTracker.simulateModalDesc", {
                defaultValue:
                  "See how the maintenance/net numbers would change with hypothetical TH, efficiency and discount values — this doesn't affect your real data.",
              })}
            </p>
            {activeCurrencyOptions.length > 1 && activeCurrencyOption && (
              <button
                type="button"
                className="minerwars-panel-simulate-currency-btn"
                onClick={handleCycleCurrency}
                title={activeCurrencyOption.title}
                aria-label={activeCurrencyOption.title}
              >
                {activeCurrencyOption.icon}
              </button>
            )}
          </div>

          <div className="minerwars-panel-simulate-stat-row">
            <label className="minerwars-panel-simulate-stat-card minerwars-panel-simulate-stat-card--divider">
              <span className="minerwars-panel-simulate-stat-label">
                {t("cycleTracker.simulateThLabel", { defaultValue: "TH" })}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={simTh}
                onChange={(e) => setSimTh(e.target.value)}
              />
            </label>
            <label className="minerwars-panel-simulate-stat-card minerwars-panel-simulate-stat-card--divider">
              <span className="minerwars-panel-simulate-stat-label">
                {t("cycleTracker.simulateUserEELabel", { defaultValue: "EE (W/TH)" })}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={simUserEE}
                onChange={(e) => setSimUserEE(e.target.value)}
              />
            </label>
            <label className="minerwars-panel-simulate-stat-card">
              <span className="minerwars-panel-simulate-stat-label">
                {t("dataViewer.discount")}
              </span>
              <PercentInput value={simPersonalDiscountPct} onChange={setSimPersonalDiscountPct} />
            </label>
          </div>

          <div className="minerwars-panel-simulate-stat-row minerwars-panel-simulate-stat-row--second">
            <label className="minerwars-panel-simulate-stat-card minerwars-panel-simulate-stat-card--divider">
              <span className="minerwars-panel-simulate-stat-label">
                {t("cycleTracker.simulateLeagueEELabel", { defaultValue: "League EE (W/TH)" })}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={simLeagueEE}
                onChange={(e) => setSimLeagueEE(e.target.value)}
              />
            </label>
            <label className="minerwars-panel-simulate-stat-card">
              <span className="minerwars-panel-simulate-stat-label">
                {t("cycleTracker.leagueDiscountSectionLabel")}
              </span>
              <PercentInput value={simLeagueDiscountPct} onChange={setSimLeagueDiscountPct} />
            </label>
          </div>

          {simulated ? (
            <div className="minerwars-panel-simulate-results minerwars-panel-simulate-results--sheet">
              <div className="minerwars-panel-breakdown">
                <div className="minerwars-panel-row">
                  <span className="minerwars-panel-label minerwars-panel-label--sub">
                    {t("cycleTracker.minerWarsEst")}
                  </span>
                  <span className="minerwars-panel-value">
                    {renderValueIcon()} {formatBtcValue(simulated.minerWarsSats / 1e8, null, null)}
                  </span>
                </div>

                <div className="minerwars-panel-row">
                  <span className="minerwars-panel-label minerwars-panel-label--sub">
                    {t("cycleTracker.soloEquiv")}
                  </span>
                  <span className="minerwars-panel-value">
                    {renderValueIcon()} {formatBtcValue(simulated.soloEquivSats / 1e8, null, null)}
                  </span>
                </div>

                <div className="minerwars-panel-row minerwars-panel-row--tags">
                  <span className="minerwars-panel-label-col">
                    <span className="minerwars-panel-label minerwars-panel-label--sub">
                      {t("cycleTracker.difference")}
                    </span>
                  </span>
                  <span className="minerwars-panel-value-col">
                    <span
                      className={`minerwars-panel-value ${simulated.diffSats / 1e8 >= 0 ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
                    >
                      {renderValueIcon()} {simulated.diffSats / 1e8 > 0 ? "+" : ""}
                      {formatBtcValue(simulated.diffSats / 1e8, null, null)}
                    </span>
                    {simulated.diffPct != null && (
                      <span className="minerwars-panel-caption">
                        {fmtPct(simulated.diffPct)} {t("cycleTracker.vsSolo")}
                      </span>
                    )}
                  </span>
                </div>

                <div className="minerwars-panel-divider" />

                <div className="minerwars-panel-row minerwars-panel-row--tags">
                  <span className="minerwars-panel-label-col">
                    <span className="minerwars-panel-label minerwars-panel-label--sub">
                      {t("cycleTracker.maintenanceEst")}
                    </span>
                  </span>
                  <span className="minerwars-panel-value-col">
                    <span className="minerwars-panel-value minerwars-panel-value--neg">
                      {simulated.maintenanceBtc != null ? (
                        showGmt && simulated.maintenanceGmt != null ? (
                          <>
                            <GmtIcon /> {`-${fmtGmt(simulated.maintenanceGmt)}`}
                          </>
                        ) : showUsd && simulated.maintenanceUsd != null ? (
                          <>
                            <UsdIcon /> {`-${fmtFiat(simulated.maintenanceUsd, "USD")}`}
                          </>
                        ) : showFiat &&
                          simulated.maintenanceUsd != null &&
                          extraFiatRate != null &&
                          extraFiatCode ? (
                          <>
                            <FiatIcon code={extraFiatCode} />
                            {`-${fmtFiat(simulated.maintenanceUsd * extraFiatRate, extraFiatCode)}`}
                          </>
                        ) : (
                          <>
                            <BtcIcon /> {`-${fmtBtc(simulated.maintenanceBtc)}`}
                          </>
                        )
                      ) : (
                        "—"
                      )}
                    </span>
                    {simulated.maintenanceBtc != null && simulated.minerWarsSats > 0 && (
                      <span className="minerwars-panel-caption">
                        {t("cycleTracker.maintenanceShare", {
                          pct: (
                            (simulated.maintenanceBtc / (simulated.minerWarsSats / 1e8)) *
                            100
                          ).toFixed(1),
                        })}
                      </span>
                    )}
                  </span>
                </div>

                <div className="minerwars-panel-divider" />

                <div className="minerwars-panel-row">
                  <span className="minerwars-panel-label minerwars-panel-label--sub">
                    {t("cycleTracker.netEst")}
                  </span>
                  <span
                    className={`minerwars-panel-value ${(showFiat || showUsd ? (simulated.netUsd ?? 0) : showGmt ? (simulated.netGmt ?? 0) : (simulated.netBtc ?? 0)) >= 0 ? "minerwars-panel-value--pos" : "minerwars-panel-value--neg"}`}
                  >
                    {simulated.netBtc != null ? (
                      showGmt && simulated.netGmt != null ? (
                        <>
                          <GmtIcon /> {fmtGmt(simulated.netGmt)}
                        </>
                      ) : showUsd && simulated.netUsd != null ? (
                        <>
                          <UsdIcon /> {fmtFiat(simulated.netUsd, "USD")}
                        </>
                      ) : showFiat &&
                        simulated.netUsd != null &&
                        extraFiatRate != null &&
                        extraFiatCode ? (
                        <>
                          <FiatIcon code={extraFiatCode} />
                          {fmtFiat(simulated.netUsd * extraFiatRate, extraFiatCode)}
                        </>
                      ) : (
                        <>
                          <BtcIcon /> {fmtBtc(simulated.netBtc)}
                        </>
                      )
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="minerwars-panel-simulate-hint">
              {t("cycleTracker.simulateUnavailable", {
                defaultValue:
                  "Nothing to simulate yet — reopen this cycle once its data has finished loading.",
              })}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
