import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pagination } from "../pagination/pagination";
import type { ClanPerformance, ClanMemberPerformance } from "@/lib/minerwars/clan-performance";
import { useOutsideClick } from "../../hooks/use-outside-click";
import type { Currency } from "../../types";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "../icons/currency-icons";
import { ChevronDownIcon, PerformanceIcon } from "../icons";
import "./clan-performance-view.css";

type ClanSortKey = "gmt" | "boost" | "share";

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

function fmtPctPlain(pct: number): string {
  return pct.toFixed(1) + "%";
}

function fmtTh(th: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(th) + " TH";
}

interface SortDropdownProps {
  value: ClanSortKey;
  onChange: (value: ClanSortKey) => void;
}

function SortDropdown({ value, onChange }: SortDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClick(ref, () => setOpen(false), open);

  const options: Array<{ value: ClanSortKey; label: string }> = [
    { value: "gmt", label: t("cycleTracker.sortGmt") },
    { value: "boost", label: t("cycleTracker.sortBoost") },
    { value: "share", label: t("cycleTracker.sortShare") },
  ];
  const current = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="clan-view-sort" ref={ref}>
      <button
        type="button"
        className="clan-view-sort-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="clan-view-sort-btn-label">{current.label}</span>
        <ChevronDownIcon className="clan-view-sort-chevron" />
      </button>
      {open && (
        <ul className="clan-view-sort-list" role="listbox">
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={`clan-view-sort-item${option.value === value ? " clan-view-sort-item--active" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClanTargetRing({ pct }: { pct: number | null }) {
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
    <div className="clan-view-ring-wrap">
      <svg
        width={size}
        height={size}
        className="clan-view-ring-svg"
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
      <div className="clan-view-ring-center">
        <span className="clan-view-ring-pct">{valueLabel}</span>
        <span className="clan-view-ring-label">{t("cycleTracker.target")}</span>
      </div>
    </div>
  );
}

interface ClanPerformanceViewProps {
  data: ClanPerformance;
  clanTargetBtc: number;
  clanMinerWarsBtc: number;
  btcPerBlockSats: number | null;
  targetActualDays: number;
  targetProjectedDays: number;
  currency: Currency;
  fiatCode: string | null;
  extraFiatRate: number | null;
  btcPrice: number | null;
  gmtPrice: number | null;
}

export function ClanPerformanceView({
  data,
  clanTargetBtc,
  clanMinerWarsBtc,
  btcPerBlockSats,
  targetActualDays,
  targetProjectedDays,
  currency,
  fiatCode,
  extraFiatRate,
  btcPrice,
  gmtPrice,
}: ClanPerformanceViewProps) {
  const { t } = useTranslation();
  const showGmt = currency === "GMT" && (btcPrice ?? 0) > 0 && (gmtPrice ?? 0) > 0;
  const showUsd = currency === "USD" && (btcPrice ?? 0) > 0;
  const showFiat =
    currency === "FIAT" && fiatCode != null && extraFiatRate != null && (btcPrice ?? 0) > 0;

  const renderBtcValue = (btc: number): { text: string; icon: React.ReactNode } => {
    if (showGmt && btcPrice != null && gmtPrice != null && gmtPrice > 0) {
      return { text: fmtGmt((btc * btcPrice) / gmtPrice), icon: <GmtIcon /> };
    }
    if (showUsd && btcPrice != null) {
      return { text: fmtFiat(btc * btcPrice, "USD"), icon: <UsdIcon /> };
    }
    if (showFiat && btcPrice != null && extraFiatRate != null && fiatCode) {
      return {
        text: fmtFiat(btc * btcPrice * extraFiatRate, fiatCode),
        icon: <FiatIcon code={fiatCode} />,
      };
    }
    return { text: fmtBtc(btc), icon: <BtcIcon /> };
  };

  const renderGmtValue = (
    gmt: number,
    negative = false,
  ): { text: string; icon: React.ReactNode } => {
    const signedGmt = negative ? -Math.abs(gmt) : gmt;
    if (showUsd && gmtPrice != null) {
      return { text: fmtFiat(signedGmt * gmtPrice, "USD"), icon: <UsdIcon /> };
    }
    if (showFiat && gmtPrice != null && extraFiatRate != null && fiatCode) {
      return {
        text: fmtFiat(signedGmt * gmtPrice * extraFiatRate, fiatCode),
        icon: <FiatIcon code={fiatCode} />,
      };
    }
    return { text: fmtGmt(signedGmt), icon: <GmtIcon /> };
  };

  const activeMembers = useMemo(() => data.members.filter((m) => !m.hasLeftClan), [data.members]);
  const membersBlocksMined = activeMembers.reduce((s, m) => s + m.blocksMined, 0);
  const boardBlocksMined = data.header.boardBlocksMined ?? 0;
  const blocksMined = boardBlocksMined > 0 ? boardBlocksMined : membersBlocksMined;
  const derivedBtcFromBlocks =
    btcPerBlockSats != null && btcPerBlockSats > 0 ? (blocksMined * btcPerBlockSats) / 1e8 : 0;
  const boardBtcMined =
    (data.header.boardBtcMined ?? 0) > 0
      ? (data.header.boardBtcMined ?? 0)
      : (clanMinerWarsBtc ?? 0) > 0
        ? (clanMinerWarsBtc ?? 0)
        : derivedBtcFromBlocks;
  const clanProgressPct = clanTargetBtc > 0 ? (boardBtcMined / clanTargetBtc) * 100 : null;
  const isBreakEven = clanProgressPct != null && clanProgressPct >= 100;
  const clanTargetBlocksTotal =
    btcPerBlockSats != null && btcPerBlockSats > 0
      ? Math.max(0, Math.ceil((clanTargetBtc * 1e8) / btcPerBlockSats))
      : null;
  const neededBlocks =
    clanTargetBlocksTotal != null ? Math.max(0, clanTargetBlocksTotal - blocksMined) : null;
  const blocksNeededText = isBreakEven
    ? t("cycleTracker.breakEvenReached")
    : neededBlocks != null
      ? t("cycleTracker.blocksNeededCount", { count: neededBlocks })
      : "\u2014";
  const projLabel =
    targetProjectedDays > 0
      ? `${t("cycleTracker.day", { count: targetActualDays })} + ${targetProjectedDays} ${t("cycleTracker.projected")}`
      : t("cycleTracker.day", { count: targetActualDays });

  const weightedEePerTh = useMemo(() => {
    const values = activeMembers
      .map((m) => m.ee)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (values.length === 0) return null;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [activeMembers]);

  const [sortKey, setSortKey] = useState<ClanSortKey>("gmt");
  const sortedMembers = useMemo(() => {
    const list = [...activeMembers];
    if (sortKey === "boost")
      return list.sort((a, b) => (b.boostCostGmt ?? -Infinity) - (a.boostCostGmt ?? -Infinity));
    if (sortKey === "share")
      return list.sort((a, b) => (b.powerSharePct ?? -1) - (a.powerSharePct ?? -1));
    return list.sort((a, b) => b.gmtRewards - a.gmtRewards);
  }, [activeMembers, sortKey]);

  const pageSize = 10;
  const [page, setPage] = useState(0);
  const pagedMembers = sortedMembers.slice(page * pageSize, (page + 1) * pageSize);

  function renderMemberValue(m: ClanMemberPerformance, kind: "reward" | "personal" | "boost") {
    if (kind === "reward") {
      const btc = m.minerWarsRewardEstBtc ?? 0;
      const value = renderBtcValue(btc);
      return (
        <>
          {value.icon} {value.text}
        </>
      );
    }
    if (kind === "personal") {
      const value = renderGmtValue(m.gmtRewards);
      return (
        <>
          {value.icon} {value.text}
        </>
      );
    }
    if (m.boostCostGmt == null) return t("cycleTracker.unknown");
    const value = renderGmtValue(m.boostCostGmt, true);
    return (
      <>
        {value.icon} {value.text}
      </>
    );
  }

  const minedValue = renderBtcValue(boardBtcMined);
  const targetValue = renderBtcValue(clanTargetBtc);

  return (
    <div className="clan-view">
      <div className="clan-view-card">
        <div className="clan-view-hero-grid">
          <div className="clan-view-hero-col-left">
            <div className="clan-view-hero-top">
              <ClanTargetRing pct={clanProgressPct} />
              <div className="clan-view-hero-content">
                <div className="clan-view-hero-meta">
                  <span className="clan-view-rank-tag">
                    {data.header.position != null
                      ? t("cycleTracker.rankNumber", { position: data.header.position })
                      : t("cycleTracker.rankUnknown")}
                  </span>
                  <span className="clan-view-members-count">
                    {t("cycleTracker.member", { count: sortedMembers.length })}
                  </span>
                </div>
                <div className="clan-view-mini-label">{t("cycleTracker.minedThisCycle")}</div>
                <div className="clan-view-mined-value">
                  {minedValue.icon} {minedValue.text}
                  <span className="minerwars-panel-projection-badge">
                    {t("cycleTracker.block", { count: blocksMined })}
                  </span>
                </div>
              </div>
            </div>

            <div className="clan-view-mini-row">
              <div className="clan-view-mini-card clan-view-mini-card--divided">
                <span className="clan-view-mini-label">{t("cycleTracker.clanTh")}</span>
                <span className="clan-view-mini-value">{fmtTh(data.totalClanTh)}</span>
              </div>
              <div className="clan-view-mini-card clan-view-mini-card--divided">
                <span className="clan-view-mini-label">W/TH</span>
                <span className="clan-view-mini-value">
                  {weightedEePerTh != null ? weightedEePerTh.toFixed(2) : "\u2014"}
                </span>
              </div>
              <div className="clan-view-mini-card">
                <span className="clan-view-mini-label">{t("cycleTracker.clanPps")}</span>
                <span className="clan-view-mini-value">
                  {data.totalClanPps != null ? data.totalClanPps.toFixed(0) : "\u2014"}
                </span>
              </div>
            </div>
          </div>

          <div className="clan-view-hero-divider" />

          <div className="clan-view-hero-col-right">
            <div className="clan-view-target-block">
              <div className="minerwars-panel-row">
                <span className="minerwars-panel-label">
                  {t("cycleTracker.cycleTarget")}
                  <span className="minerwars-panel-projection-badge">{projLabel}</span>
                </span>
              </div>
              <div className="clan-view-target-value-row">
                {targetValue.icon}
                <span className="clan-view-target-value">{targetValue.text}</span>
              </div>
              <div className="minerwars-panel-progress-bar">
                <div
                  className={`minerwars-panel-progress-fill${isBreakEven ? " minerwars-panel-progress-fill--over" : ""}`}
                  style={{
                    width: `${Math.max(0, Math.min(100, clanProgressPct ?? 0)).toFixed(1)}%`,
                  }}
                />
              </div>
              <div className="clan-view-target-footer">{blocksNeededText}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="clan-view-perf">
        <div className="clan-view-perf-header">
          <div className="clan-view-perf-heading">
            <div className="clan-view-perf-title-wrap">
              <PerformanceIcon className="clan-view-perf-title-icon" />
              <span className="clan-view-perf-title">{t("cycleTracker.performance")}</span>
            </div>
          </div>
          <SortDropdown
            value={sortKey}
            onChange={(value) => {
              setSortKey(value);
              setPage(0);
            }}
          />
        </div>

        <div className="clan-view-member-table-header" aria-hidden="true">
          <div className="clan-view-member-header-cell clan-view-member-col-name">Member</div>
          <div className="clan-view-member-header-cell clan-view-member-col-share">
            {t("cycleTracker.sharePct")}
          </div>
          <div className="clan-view-member-header-cell clan-view-member-col-reward">
            {t("cycleTracker.reward")}
          </div>
          <div className="clan-view-member-header-cell clan-view-member-col-personal">
            {t("cycleTracker.personalGmt")}
          </div>
          <div className="clan-view-member-header-cell clan-view-member-col-boost">
            {t("cycleTracker.boostCost")}
          </div>
        </div>

        <div className="clan-view-member-list">
          {pagedMembers.map((m) => {
            const sharePct = m.powerSharePct ?? 0;
            return (
              <div key={m.userId} className="clan-view-member-card">
                <div className="clan-view-member-cell clan-view-member-col-name">
                  <div className="clan-view-member-head">
                    {m.avatarUrl ? (
                      <img className="clan-view-member-avatar" src={m.avatarUrl} alt="" />
                    ) : (
                      <div className="clan-view-member-avatar clan-view-member-avatar--fallback" />
                    )}
                    <div className="clan-view-member-identity">
                      <span className="clan-view-member-alias">{m.alias}</span>
                      <span className="clan-view-member-meta">
                        {m.th != null ? fmtTh(m.th) : "\u2014"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="clan-view-member-cell clan-view-member-col-share">
                  <div className="clan-view-share-block">
                    <div className="clan-view-share-value">{fmtPctPlain(sharePct)}</div>
                    <div className="minerwars-panel-progress-bar clan-view-share-bar">
                      <div
                        className="minerwars-panel-progress-fill"
                        style={{ width: `${Math.max(0, Math.min(100, sharePct)).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="clan-view-member-cell clan-view-member-col-reward">
                  <span className="clan-view-member-metric-value">
                    {renderMemberValue(m, "reward")}
                  </span>
                </div>

                <div className="clan-view-member-cell clan-view-member-col-personal">
                  <div className="clan-view-member-metric-wrap">
                    <span className="clan-view-member-metric-value">
                      {renderMemberValue(m, "personal")}
                    </span>
                    <span className="clan-view-member-metric-sub clan-view-member-meta">
                      {t("cycleTracker.block", { count: m.blocksMined })}
                    </span>
                  </div>
                </div>

                <div className="clan-view-member-cell clan-view-member-col-boost">
                  <div className="clan-view-member-metric-wrap">
                    <span className="clan-view-member-metric-value minerwars-panel-value--neg">
                      {renderMemberValue(m, "boost")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Pagination
          page={page}
          total={sortedMembers.length}
          onChange={setPage}
          pageSize={pageSize}
        />
      </div>
    </div>
  );
}
