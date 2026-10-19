import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { LOCAL_STORAGE_KEY_SYNC_ALIAS } from "@/lib/storage-keys";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { ShareFilterModal } from "../share-filter-modal/share-filter-modal";
import type { ExclusionRecord } from "../../hooks/use-share-exclusions";
import { getDateRangeFilter } from "./utils/card-data";
import { MONTH_NAMES, SHEET_LABELS } from "./utils/constants";
import { getPeriodLabel } from "./utils/format";
import { useCardCanvas } from "./hooks/use-card-canvas";
import { useCardData } from "./hooks/use-card-data";
import { useMiningStats } from "./hooks/use-mining-stats";
import { ScPicker } from "./components/sc-picker/sc-picker";
import type { Period } from "./types";
import "./share-card-modal.css";
import { CheckIcon, CloseIcon, FilterIcon } from "@/components/icons";

export function ShareCardModal({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("month");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, yearsAgo) => currentYear - yearsAgo);
  const [exclusions, setExclusions] = useState<ExclusionRecord>({});
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [fiatDisplay, setFiatDisplay] = useState<string>("USD");
  const [includeMaintenance, setIncludeMaintenance] = useState(true);

  useEscapeKey(onClose, true);

  const alias = useMemo(() => localStorage.getItem(LOCAL_STORAGE_KEY_SYNC_ALIAS) ?? "", []);

  const range = useMemo(
    () => getDateRangeFilter(period, selectedMonth, selectedYear),
    [period, selectedMonth, selectedYear],
  );

  useEffect(() => {
    setExclusions({});
  }, [period, selectedMonth, selectedYear]);

  const {
    availableFiat,
    filteredCache,
    availableSheets,
    sheetsInPeriod,
    selectedSheets,
    sheetData,
    toggleSheet,
  } = useCardData(range, exclusions);

  const hasMiningSelected = useMemo(
    () =>
      (selectedSheets.has("solo-mining") || selectedSheets.has("minerwars")) &&
      (sheetsInPeriod.has("solo-mining") || sheetsInPeriod.has("minerwars")),
    [selectedSheets, sheetsInPeriod],
  );

  const miningStats = useMiningStats(hasMiningSelected);

  const { canvasRef, previewRef, generating, handleDownload } = useCardCanvas({
    sheetData,
    periodLabel: getPeriodLabel(period, selectedMonth, selectedYear),
    alias,
    fiatDisplay,
    includeMaintenance,
    miningStats,
  });

  return (
    <div
      className="sc-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Generate shareable image"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sc-panel">
        <div className="sc-header">
          <span className="sc-title">Generate Shareable Image</span>
          <button className="sc-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="sc-body">
          <div className="sc-top-row">
            <div className="sc-section sc-period-section">
              <div className="sc-section-label-row">
                <span className="sc-section-label">Time period</span>
              </div>
              <div className="sc-period-grid">
                {(["7d", "month", "year", "all"] as Period[]).map((periodOption) => (
                  <button
                    key={periodOption}
                    type="button"
                    className={`sc-period-btn${period === periodOption ? " sc-period-btn--on" : ""}`}
                    onClick={() => setPeriod(periodOption)}
                  >
                    {periodOption === "7d"
                      ? "7 days"
                      : periodOption === "month"
                        ? "Month"
                        : periodOption === "year"
                          ? "Year"
                          : "All time"}
                  </button>
                ))}
              </div>
              <div
                className={`sc-period-sub${period !== "month" && period !== "year" ? " sc-period-sub--hidden" : ""}`}
              >
                {period !== "year" && (
                  <ScPicker
                    value={selectedMonth}
                    options={MONTH_NAMES.map((monthName, monthIndex) => ({
                      label: monthName,
                      value: monthIndex,
                    }))}
                    onChange={(value) => setSelectedMonth(Number(value))}
                    hidden={period !== "month"}
                  />
                )}
                <ScPicker
                  value={selectedYear}
                  options={yearOptions.map((year) => ({ label: String(year), value: year }))}
                  onChange={(value) => setSelectedYear(Number(value))}
                />
              </div>
            </div>

            {(availableFiat || hasMiningSelected) && (
              <div className="sc-section">
                <div className="sc-section-label-row">
                  <span className="sc-section-label">
                    {availableFiat ? "Total in" : "Maintenance"}
                  </span>
                </div>
                {availableFiat && (
                  <div className="sc-fiat-toggle">
                    {(["USD", availableFiat] as string[]).map((fiatCode) => (
                      <button
                        key={fiatCode}
                        type="button"
                        className={`sc-fiat-btn${fiatDisplay === fiatCode ? " sc-fiat-btn--on" : ""}`}
                        onClick={() => setFiatDisplay(fiatCode)}
                      >
                        {fiatCode}
                      </button>
                    ))}
                  </div>
                )}
                {hasMiningSelected && (
                  <>
                    {availableFiat && <span className="sc-section-label">Maintenance</span>}
                    <label className="sc-toggle-row">
                      <input
                        type="checkbox"
                        className="sc-toggle-switch"
                        checked={includeMaintenance}
                        onChange={(event) => setIncludeMaintenance(event.target.checked)}
                        aria-label="Include maintenance"
                      />
                    </label>
                  </>
                )}
                <div className="sc-period-sub sc-period-sub--hidden" aria-hidden="true" />
              </div>
            )}

            <div className="sc-section sc-sheets-section">
              <div className="sc-section-label-row">
                <span className="sc-section-label">Sheets</span>
                <div className="sc-sheets-actions">
                  <button
                    type="button"
                    className={`sc-period-btn${availableSheets.length === 0 ? " sc-filter-btn--disabled" : ""}`}
                    onClick={() => setFilterModalOpen(true)}
                    disabled={availableSheets.length === 0}
                    title="Filter individual records"
                  >
                    <FilterIcon width={11} height={11} />
                    Filter
                  </button>
                </div>
              </div>
              {availableSheets.length === 0 ? (
                <p className="sc-no-data">No data available. Run a build report first.</p>
              ) : (
                <div className="sc-sheet-list">
                  {availableSheets.map((tab) => {
                    const checked = selectedSheets.has(tab.key);
                    const hasData = sheetsInPeriod.has(tab.key);
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        className={`sc-sheet-row${checked ? " sc-sheet-row--checked" : ""}${!hasData ? " sc-sheet-row--empty" : ""}`}
                        onClick={() => toggleSheet(tab.key)}
                        disabled={!hasData}
                        aria-pressed={checked}
                      >
                        <span
                          className={`sc-check-icon${checked ? " sc-check-icon--visible" : ""}`}
                          aria-hidden="true"
                        >
                          <CheckIcon size={10} strokeWidth={2.8} />
                        </span>
                        <span className="sc-sheet-name">{SHEET_LABELS[tab.key] ?? tab.key}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="sc-preview" ref={previewRef}>
            <span className="sc-section-label">Preview</span>
            {sheetData.length > 0 ? (
              <canvas ref={canvasRef} className="sc-preview-canvas" />
            ) : (
              <div className="sc-preview-empty">
                {selectedSheets.size === 0
                  ? "Select at least one sheet."
                  : "No records match the selected period."}
              </div>
            )}
          </div>
        </div>

        <div className="sc-footer">
          <button type="button" className="sc-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sc-btn-download"
            onClick={handleDownload}
            disabled={sheetData.length === 0 || generating}
          >
            {generating ? "Generating…" : "Download PNG"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {filterModalOpen && (
          <ShareFilterModal
            cache={filteredCache}
            initialExclusions={exclusions}
            onSave={(next) => {
              setExclusions(next);
              setFilterModalOpen(false);
            }}
            onClose={() => setFilterModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
