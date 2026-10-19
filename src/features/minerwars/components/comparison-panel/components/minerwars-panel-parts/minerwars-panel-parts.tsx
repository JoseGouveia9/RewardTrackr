import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CycleInfo } from "@/features/minerwars/utils/comparison";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { BtcIcon, GmtIcon } from "@/components/icons/currency-icons";
import { ChevronDownIcon } from "@/components/icons";

interface CycleDropdownProps {
  cycles: CycleInfo[];
  selectedCycleId: number | null;
  dateRange?: string;
  onSelect: (id: number) => void;
}

export function CycleDropdown({
  cycles,
  selectedCycleId,
  dateRange,
  onSelect,
}: CycleDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedCycle = cycles.find((cycle) => cycle.cycleId === selectedCycleId);

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
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="minerwars-panel-cycle-dropdown-btn-left">
          <span className="minerwars-panel-cycle-dropdown-top">
            <span className="minerwars-panel-cycle-dropdown-label">
              {t("cycleTracker.cycle", { id: selectedCycle?.cycleId ?? "\u2014" })}
            </span>
            {selectedCycle && (
              <span
                className={`minerwars-panel-cycle-badge minerwars-panel-cycle-badge--${selectedCycle.status}`}
              >
                {statusLabel(selectedCycle.status)}
              </span>
            )}
          </span>
          {dateRange ? (
            <span className="minerwars-panel-cycle-dropdown-date">{dateRange}</span>
          ) : null}
        </span>
        <ChevronDownIcon className="minerwars-panel-dropdown-chevron" />
      </button>
      {open && (
        <ul className="minerwars-panel-cycle-dropdown-list" role="listbox">
          {cycles.map((cycle) => (
            <li
              key={cycle.cycleId}
              role="option"
              aria-selected={cycle.cycleId === selectedCycleId}
              className={`minerwars-panel-cycle-dropdown-item${cycle.cycleId === selectedCycleId ? " minerwars-panel-cycle-dropdown-item--active" : ""}`}
              onClick={() => {
                onSelect(cycle.cycleId);
                setOpen(false);
              }}
            >
              <span>Cycle {cycle.cycleId}</span>
              <span
                className={`minerwars-panel-cycle-badge minerwars-panel-cycle-badge--${cycle.status}`}
              >
                {statusLabel(cycle.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DualCurrencyIcon() {
  return (
    <span className="minerwars-panel-dual-currency-icon" aria-hidden="true">
      <span className="minerwars-panel-dual-currency-icon-front">
        <BtcIcon />
      </span>
      <span className="minerwars-panel-dual-currency-icon-back">
        <GmtIcon />
      </span>
    </span>
  );
}

export function PercentInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <span className="minerwars-panel-simulate-input-group">
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="minerwars-panel-simulate-input-suffix">%</span>
    </span>
  );
}

export function IndividualSkeletonBody() {
  return (
    <div className="minerwars-panel-hero-card">
      <div className="minerwars-panel-hero-grid">
        <div className="minerwars-panel-hero-col-left">
          <div className="minerwars-panel-hero-row">
            <div className="minerwars-panel-skeleton minerwars-panel-skeleton--ring" />
            <div className="minerwars-panel-hero-main">
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--hero-value" />
            </div>
          </div>

          <div className="minerwars-panel-target-block">
            <div className="minerwars-panel-row">
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
            </div>
            <div className="minerwars-panel-skeleton minerwars-panel-skeleton--hero-value" />
            <div className="minerwars-panel-skeleton minerwars-panel-skeleton--progress" />
          </div>

          <div className="minerwars-panel-personal-row">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className={`minerwars-panel-personal-col${index < 2 ? " minerwars-panel-personal-col--divided" : ""}`}
              >
                <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
                <div className="minerwars-panel-skeleton minerwars-panel-skeleton--value" />
              </div>
            ))}
          </div>
        </div>

        <div className="minerwars-panel-hero-divider" />

        <div className="minerwars-panel-hero-col-right">
          <div className="minerwars-panel-breakdown">
            {[0, 1, 2, 3].map((index) => (
              <div key={index}>
                {index > 0 && <div className="minerwars-panel-divider" />}
                <div className="minerwars-panel-row">
                  <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
                  <div className="minerwars-panel-skeleton minerwars-panel-skeleton--value" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClanSkeletonBody() {
  return (
    <div className="clan-view">
      <div className="clan-view-card">
        <div className="clan-view-hero-grid">
          <div className="clan-view-hero-col-left">
            <div className="clan-view-hero-top">
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--ring" />
              <div className="clan-view-hero-content">
                <div className="clan-view-hero-meta">
                  <div className="minerwars-panel-skeleton minerwars-panel-skeleton--badge" />
                  <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
                </div>
                <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
                <div className="minerwars-panel-skeleton minerwars-panel-skeleton--mined-value" />
              </div>
            </div>

            <div className="clan-view-mini-row">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className={`clan-view-mini-card${index < 2 ? " clan-view-mini-card--divided" : ""}`}
                >
                  <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
                  <div className="minerwars-panel-skeleton minerwars-panel-skeleton--value" />
                </div>
              ))}
            </div>
          </div>

          <div className="clan-view-hero-divider" />

          <div className="clan-view-hero-col-right">
            <div className="clan-view-target-block">
              <div className="minerwars-panel-row">
                <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
              </div>
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--mined-value" />
              <div className="minerwars-panel-skeleton minerwars-panel-skeleton--progress" />
              <div className="clan-view-target-footer">
                <div className="minerwars-panel-skeleton minerwars-panel-skeleton--label" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
