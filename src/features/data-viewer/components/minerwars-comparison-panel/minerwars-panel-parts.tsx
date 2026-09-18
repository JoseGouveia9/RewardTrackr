import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CycleInfo } from "@/lib/minerwars/comparison";
import { useOutsideClick } from "../../hooks/use-outside-click";
import { BtcIcon, GmtIcon } from "../icons/currency-icons";
import { ChevronDownIcon } from "../icons";

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

export function TargetRing({ pct }: { pct: number | null }) {
  const { t } = useTranslation();
  const size = 92;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePct = pct != null ? Math.max(0, Math.min(100, pct)) : 0;
  const dash = (safePct / 100) * circumference;
  const overflowPct = pct != null ? Math.max(0, Math.min(100, pct - 100)) : 0;
  const overflowDash = (overflowPct / 100) * circumference;
  const valueLabel = pct != null ? `${pct.toFixed(1)}%` : "\u2014";

  return (
    <div className="minerwars-panel-ring-wrap">
      <svg
        width={size}
        height={size}
        className="minerwars-panel-ring-svg"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(148,163,184,0.24)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#f7931a"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${Math.max(0, circumference - dash)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {overflowPct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#22c55e"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${overflowDash} ${Math.max(0, circumference - overflowDash)}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="minerwars-panel-ring-center">
        <span className="minerwars-panel-ring-pct">{valueLabel}</span>
        <span className="minerwars-panel-ring-label">{t("cycleTracker.target")}</span>
      </div>
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
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="minerwars-panel-simulate-input-suffix">%</span>
    </span>
  );
}

// Skeleton bodies reuse the real individual/clan container classes so their layout
// (grid, dividers, spacing) matches the loaded view exactly.
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
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`minerwars-panel-personal-col${i < 2 ? " minerwars-panel-personal-col--divided" : ""}`}
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
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                {i > 0 && <div className="minerwars-panel-divider" />}
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
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`clan-view-mini-card${i < 2 ? " clan-view-mini-card--divided" : ""}`}
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
