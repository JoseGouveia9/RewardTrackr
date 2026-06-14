import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { loadCacheEntry } from "@/lib/reward-cache";
import { LS_KEY_SYNC_ALIAS, LS_KEY_SYNC_TOKEN } from "@/lib/storage-keys";
import { buildApiHeaders } from "@/lib/http";
import { getMyNftStats, getBonusMinerStats } from "@/lib/minerwars/api";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { ALL_TABS } from "@/features/data-viewer";
import type { CacheState, RewardKey } from "@/types/rewards";
import { ALL_REWARD_KEYS } from "@/config/reward-configs";
import { ShareFilterModal } from "../share-filter-modal/share-filter-modal";
import type { ExclusionRecord } from "../../hooks/use-share-exclusions";
import "./share-card-modal.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "7d" | "month" | "year" | "all";

interface SheetEntry {
  key: string;
  label: string;
  rewards: Array<{ currency: string; total: number; totalUSD: number; totalFiat: number }>;
  mining?: {
    poolReward: number;
    maintenance: number;
    reward: number;
    poolRewardInUSD: number;
    poolRewardInFiat: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getPeriodLabel(period: Period, month: number, year: number): string {
  if (period === "7d") return "Last 7 days";
  if (period === "month") return `${MONTH_NAMES[month]} ${year}`;
  if (period === "year") return String(year);
  return "All time";
}

const SHEET_LABELS: Partial<Record<string, string>> = {
  "solo-mining": "Solo Mining",
  minerwars: "MinerWars",
  bounty: "Bounties",
  referrals: "Referrals",
  ambassador: "Ambassador",
  deposits: "Deposits",
  withdrawals: "Withdrawals",
  purchases: "Purchases & Upgrades",
  "simple-earn": "Simple Earn",
  transactions: "Transactions",
};

// Card layout constants — horizontal (900px wide)
const CARD_W = 900;
const PAD = 36;
const GAP = 12;
const CARD_BASE_H = 52; // sheet label + top/bottom padding + USD row
const REWARD_ROW_H = 22; // one currency amount row (non-mining)
const MINING_ROW_H = 30; // label line + value line per mining row
const POWER_BANNER_H = 0; // power is shown inline in the header, no extra slot needed
const HEADER_H = 80;
const DIV_H = 1;
const GRID_TOP = 18;
const GRID_BOT = 18;
const FOOTER_H = 40;
const PAD_BOT = 22;

// Mining group keys — kept so mining sheets sort first in the grid
const MINING_GROUP_KEYS = new Set(["solo-mining", "minerwars"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

// All cards in a single row; wrap to 2 rows only when cards would be too narrow
function computeColCount(n: number): number {
  if (n <= 0) return 1;
  // target min card width ~130px within 900-72=828px available
  const available = CARD_W - 2 * PAD;
  const singleRowW = (available - (n - 1) * GAP) / n;
  if (singleRowW >= 130) return n;
  return Math.ceil(n / 2);
}

function computeCardItemH(
  maxRewards: number,
  hasMining: boolean,
  includeMaintenance = true,
): number {
  const miningH = hasMining ? (includeMaintenance ? 3 * MINING_ROW_H : REWARD_ROW_H) : 0;
  const normalH = Math.max(1, maxRewards) * REWARD_ROW_H;
  return CARD_BASE_H + Math.max(normalH, miningH);
}

function computeTotalH(
  sheets: SheetEntry[],
  includeMaintenance: boolean,
  hasPowerTrend = false,
): number {
  const n = sheets.length;
  if (n === 0) return PAD + HEADER_H + DIV_H + GRID_TOP + GRID_BOT + DIV_H + FOOTER_H + PAD_BOT;
  const maxR = Math.max(1, ...sheets.map((s) => s.rewards.length));
  const hasMining = sheets.some((s) => !!s.mining);
  const itemH = computeCardItemH(maxR, hasMining, includeMaintenance);
  const cols = computeColCount(n);
  const rows = Math.ceil(n / cols);
  const gridH = rows * itemH + Math.max(0, rows - 1) * GAP;
  const bannerSlot = hasPowerTrend ? POWER_BANNER_H : 0;
  return (
    PAD + HEADER_H + DIV_H + GRID_TOP + bannerSlot + gridH + GRID_BOT + DIV_H + FOOTER_H + PAD_BOT
  );
}

interface CardColors {
  ORANGE: string;
  CARD_BG: string;
  WHITE: string;
  MUTED: string;
  DIM: string;
}

interface MiningStats {
  miners: number;
  totalTH: number;
  avgEE: number | null;
}

function _drawSingleCard(
  ctx: CanvasRenderingContext2D,
  sheet: SheetEntry,
  cx: number,
  cy: number,
  cardW: number,
  cardItemH: number,
  iconMap: Map<string, HTMLImageElement>,
  fiatCurrency: string,
  c: CardColors,
  includeMaintenance: boolean,
): void {
  const { ORANGE, CARD_BG, WHITE, MUTED, DIM } = c;
  const tx = cx + 14;
  const innerW = cardW - 14 - 8;

  fillRoundRect(ctx, cx, cy, cardW, cardItemH, 10, CARD_BG);
  fillRoundRect(ctx, cx, cy + 12, 4, cardItemH - 24, 2, ORANGE);

  ctx.font = "11px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  let labelText = sheet.label;
  if (ctx.measureText(labelText).width > innerW) {
    while (labelText.length > 1 && ctx.measureText(labelText + "\u2026").width > innerW)
      labelText = labelText.slice(0, -1);
    labelText += "\u2026";
  }
  ctx.fillText(labelText, tx, cy + 12);

  const rewardsStartY = cy + 28;

  if (sheet.mining) {
    const m = sheet.mining;
    if (includeMaintenance) {
      const mRows: Array<{ label: string; value: number; color: string }> = [
        { label: "Pool Reward", value: m.poolReward, color: MUTED },
        { label: "Maintenance", value: m.maintenance, color: "#ef4444" },
        { label: "Reward", value: m.reward, color: WHITE },
      ];
      for (let k = 0; k < mRows.length; k++) {
        const item = mRows[k];
        const rowY = rewardsStartY + k * MINING_ROW_H;
        const amtFs = cardW < 160 ? 11 : 13;
        const ICON_SIZE = 13;
        const iconGap = 4;
        ctx.font = `10px 'Space Grotesk', system-ui, sans-serif`;
        ctx.fillStyle = MUTED;
        ctx.textAlign = "left";
        ctx.fillText(item.label, tx, rowY);
        const valY = rowY + 14;
        ctx.font = `bold ${amtFs}px 'Space Grotesk', system-ui, sans-serif`;
        ctx.fillStyle = item.color;
        const maxAmtW = innerW - ICON_SIZE - iconGap;
        let amtText = item.value.toFixed(8);
        if (ctx.measureText(amtText).width > maxAmtW) {
          while (amtText.length > 1 && ctx.measureText(amtText + "\u2026").width > maxAmtW)
            amtText = amtText.slice(0, -1);
          amtText += "\u2026";
        }
        ctx.fillText(amtText, tx, valY);
        const amtW = ctx.measureText(amtText).width;
        const btcIcon = iconMap.get("BTC");
        if (btcIcon) {
          ctx.drawImage(
            btcIcon,
            tx + amtW + iconGap,
            valY + amtFs / 2 - ICON_SIZE / 2 - 1,
            ICON_SIZE,
            ICON_SIZE,
          );
        }
      }
    } else {
      // Excluded: single unlabeled pool-reward value row
      const amtFs = cardW < 160 ? 12 : 14;
      const ICON_SIZE = 13;
      const iconGap = 4;
      ctx.font = `bold ${amtFs}px 'Space Grotesk', system-ui, sans-serif`;
      ctx.fillStyle = WHITE;
      ctx.textAlign = "left";
      const maxAmtW = innerW - ICON_SIZE - iconGap;
      let amtText = m.poolReward.toFixed(8);
      if (ctx.measureText(amtText).width > maxAmtW) {
        while (amtText.length > 1 && ctx.measureText(amtText + "\u2026").width > maxAmtW)
          amtText = amtText.slice(0, -1);
        amtText += "\u2026";
      }
      ctx.fillText(amtText, tx, rewardsStartY);
      const amtW = ctx.measureText(amtText).width;
      const btcIcon = iconMap.get("BTC");
      if (btcIcon) {
        ctx.drawImage(
          btcIcon,
          tx + amtW + iconGap,
          rewardsStartY + amtFs / 2 - ICON_SIZE / 2 - 1,
          ICON_SIZE,
          ICON_SIZE,
        );
      }
    }
  } else {
    for (let k = 0; k < sheet.rewards.length; k++) {
      const reward = sheet.rewards[k];
      const rowY = rewardsStartY + k * REWARD_ROW_H;
      const amtFs = cardW < 160 ? 12 : 14;
      ctx.font = `bold ${amtFs}px 'Space Grotesk', system-ui, sans-serif`;
      ctx.fillStyle = WHITE;
      ctx.textAlign = "left";
      const ICON_SIZE = 13;
      const iconGap = 4;
      const maxAmtW = innerW - ICON_SIZE - iconGap;
      let amtText = fmtAmount(reward.total, reward.currency);
      if (ctx.measureText(amtText).width > maxAmtW) {
        while (amtText.length > 1 && ctx.measureText(amtText + "\u2026").width > maxAmtW)
          amtText = amtText.slice(0, -1);
        amtText += "\u2026";
      }
      ctx.fillText(amtText, tx, rowY);
      const amtW = ctx.measureText(amtText).width;
      const iconImg = iconMap.get(reward.currency);
      if (iconImg) {
        ctx.drawImage(
          iconImg,
          tx + amtW + iconGap,
          rowY + amtFs / 2 - ICON_SIZE / 2 - 1,
          ICON_SIZE,
          ICON_SIZE,
        );
      }
    }
  }

  const totalFiatVal =
    sheet.mining && !includeMaintenance
      ? fiatCurrency === "USD"
        ? sheet.mining.poolRewardInUSD
        : sheet.mining.poolRewardInFiat
      : fiatCurrency === "USD"
        ? sheet.rewards.reduce((s, r) => s + r.totalUSD, 0)
        : sheet.rewards.reduce((s, r) => s + r.totalFiat, 0);
  if (totalFiatVal > 0) {
    ctx.font = "10px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillStyle = DIM;
    ctx.textAlign = "left";
    ctx.fillText(fmtFiat(totalFiatVal, fiatCurrency), tx, cy + cardItemH - 20);
  }
}

function getDateRangeFilter(
  period: Period,
  month: number,
  year: number,
): { from: string; to: string } | null {
  if (period === "all") return null;
  if (period === "7d") {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
  }
  if (period === "month") {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
  }
  // year
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function filterByDate(records: unknown[], range: { from: string; to: string } | null): unknown[] {
  if (!range) return records;
  return records.filter((r) => {
    const d = ((r as Record<string, unknown>).createdAt as string | undefined)?.slice(0, 10) ?? "";
    return d >= range.from && d <= range.to;
  });
}

function computeMiningBreakdown(records: unknown[]): {
  poolReward: number;
  maintenance: number;
  reward: number;
  poolRewardInUSD: number;
  poolRewardInFiat: number;
} {
  let poolReward = 0,
    maintenance = 0,
    reward = 0,
    poolRewardInUSD = 0,
    poolRewardInFiat = 0;
  for (const r of records) {
    const rec = r as Record<string, unknown>;
    const pr = Number(rec.poolReward ?? 0);
    const rw = Number(rec.reward ?? 0);
    poolReward += pr;
    maintenance += Number(rec.maintenance ?? 0);
    reward += rw;
    // Fiat value of poolReward proportional to reward's fiat (same BTC price per record)
    const ratio = rw !== 0 ? pr / rw : 0;
    poolRewardInUSD += Number(rec.rewardInUSD ?? rec.rewardInUsd ?? rec.valueUsd ?? 0) * ratio;
    poolRewardInFiat += Number(rec.rewardInFiat ?? rec.valueFiat ?? 0) * ratio;
  }
  return { poolReward, maintenance, reward, poolRewardInUSD, poolRewardInFiat };
}

function computeRewardsByCurrency(
  records: unknown[],
): Array<{ currency: string; total: number; totalUSD: number; totalFiat: number }> {
  const map = new Map<string, { total: number; totalUSD: number; totalFiat: number }>();
  for (const r of records) {
    const rec = r as Record<string, unknown>;
    const cur = typeof rec.currency === "string" ? rec.currency : "BTC";
    const ex = map.get(cur) ?? { total: 0, totalUSD: 0, totalFiat: 0 };
    map.set(cur, {
      total: ex.total + Number(rec.reward ?? 0),
      totalUSD: ex.totalUSD + Number(rec.rewardInUSD ?? rec.rewardInUsd ?? rec.valueUsd ?? 0),
      totalFiat: ex.totalFiat + Number(rec.rewardInFiat ?? rec.valueFiat ?? 0),
    });
  }
  return [...map.entries()].map(([currency, v]) => ({ currency, ...v }));
}

function fmtAmount(value: number, currency: string): string {
  if (currency === "BTC") return value.toFixed(8);
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFiat(value: number, currency: string): string {
  try {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function fmtTH(th: number): string {
  if (th >= 1000) return `${(th / 1000).toFixed(1)}K`;
  if (th < 1) return `${(th * 1000).toFixed(1)} GH`;
  return th.toFixed(2);
}

// ─── Canvas drawing ───────────────────────────────────────────────────────────

// ─── SVG icon strings (sourced from currency-icons.tsx) ────────────────────────

const _SVG_BTC = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 41 40"><g clip-path="url(#a)"><path d="M39.8968 24.8382C37.2255 35.5525 26.3738 42.0731 15.6583 39.4012C4.94712 36.73 -1.57344 25.8776 1.09903 15.164C3.769 4.44845 14.6208 -2.07273 25.3332 0.598491C36.0481 3.26971 42.568 14.1234 39.8968 24.8382Z" fill="#F7931A"/><path d="M29.7598 17.387C30.179 14.585 28.0455 13.0787 25.1283 12.0738L26.0746 8.2781L23.7642 7.70229L22.8429 11.398C22.2355 11.2466 21.6117 11.1038 20.9918 10.9623L21.9196 7.24231L19.6105 6.6665L18.6635 10.4609C18.1608 10.3464 17.6672 10.2332 17.1882 10.1141L17.1908 10.1022L14.0045 9.30665L13.3898 11.7744C13.3898 11.7744 15.1041 12.1672 15.0679 12.1916C16.0036 12.4252 16.1728 13.0444 16.1445 13.5354L15.0666 17.8595C15.1311 17.8759 15.2146 17.8996 15.3068 17.9365C15.2298 17.9174 15.1475 17.8963 15.0626 17.8759L13.5517 23.9334C13.4372 24.2177 13.147 24.6441 12.4929 24.4822C12.5159 24.5158 10.8135 24.063 10.8135 24.063L9.6665 26.7078L12.6732 27.4573C13.2325 27.5975 13.7807 27.7442 14.3203 27.8824L13.3642 31.7216L15.672 32.2974L16.6189 28.499C17.2494 28.6701 17.8614 28.8281 18.4602 28.9768L17.5165 32.7574L19.827 33.3332L20.7832 29.5013C24.723 30.2469 27.6856 29.9461 28.9326 26.3827C29.9375 23.5136 28.8826 21.8585 26.8097 20.7793C28.3193 20.4312 29.4564 19.4382 29.7598 17.387ZM24.4808 24.7895C23.7668 27.6587 18.936 26.1076 17.3698 25.7187L18.6385 20.6326C20.2047 21.0235 25.2271 21.7973 24.4808 24.7895ZM25.1955 17.3455C24.544 19.9554 20.5232 18.6294 19.2189 18.3043L20.3692 13.6913C21.6735 14.0164 25.8739 14.6231 25.1955 17.3455Z" fill="white"/></g><defs><clipPath id="a"><rect width="40" height="40" fill="white" transform="translate(.5)"/></clipPath></defs></svg>`;

const _SVG_GMT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#7540EF"/><path d="M12.1879 3.6001C10.9516 3.6001 9.69996 3.85967 8.49415 4.42462C6.41833 5.38656 4.8462 7.09668 4.08303 9.23432C3.33512 11.3414 3.45723 13.6012 4.43409 15.6167C6.46412 19.8004 11.5926 21.5716 15.8664 19.5866C16.9501 19.0828 17.9117 18.3651 18.7054 17.4795C19.4838 16.5939 20.0486 15.5709 20.3996 14.4563L18.5985 12.0133L20.3538 9.61605H17.8811L16.1259 11.9827L17.9422 14.4105L17.9269 14.441C16.5532 17.5253 12.8442 18.9454 9.6847 17.5864C8.1431 16.9146 6.95255 15.6931 6.35728 14.1509C5.77727 12.6393 5.8078 11.0055 6.46412 9.52443C7.83783 6.44011 11.5316 5.02011 14.7064 6.37904C15.6985 6.80657 16.5532 7.46313 17.1943 8.30292H19.9112C18.4306 5.34075 15.3779 3.6001 12.1879 3.6001Z" fill="white"/><path d="M16.3565 9.59961H13.8991L12.1133 11.9816L13.8991 14.3482H16.3565L14.6317 11.9816L16.3565 9.59961Z" fill="white"/></svg>`;

const _SVG_USD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#22c55e"/><text x="10" y="10" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="#fff" font-family="sans-serif">$</text></svg>`;

const _SVG_USDT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z" fill="#26A17B"/><path d="M13.4212 12.9295V12.9276C13.3414 12.9332 12.9295 12.9573 12.013 12.9573C11.2801 12.9573 10.7662 12.9369 10.5844 12.9276V12.9295C7.76623 12.8052 5.66419 12.3154 5.66419 11.7273C5.66419 11.141 7.76809 10.6494 10.5844 10.525V12.4416C10.7681 12.4545 11.2968 12.4861 12.026 12.4861C12.9017 12.4861 13.3395 12.449 13.4212 12.4416V10.5269C16.2338 10.6531 18.3302 11.1429 18.3302 11.7291C18.3302 12.3154 16.2319 12.8052 13.4212 12.9314M13.4212 10.3284V8.6141H17.3451V6H6.66234V8.6141H10.5863V10.3284C7.39703 10.475 5 11.1058 5 11.8627C5 12.6197 7.39889 13.2505 10.5863 13.3989V18.8942H13.423V13.3989C16.6067 13.2523 19 12.6215 19 11.8646C19 11.1095 16.6067 10.4768 13.423 10.3302" fill="white"/></svg>`;

const _SVG_TON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA"/><path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5381 22.4861C43.3045 19.4251 41.0761 15.6277 37.5627 15.6277H37.5603ZM26.2548 36.8068L23.6847 31.8327L17.4833 20.7414C17.0742 20.0315 17.5795 19.1218 18.4362 19.1218H26.2524V36.8092L26.2548 36.8068ZM38.5108 20.739L32.3118 31.8351L29.7417 36.8068V19.1194H37.5579C38.4146 19.1194 38.9199 20.0291 38.5108 20.739Z" fill="white"/></svg>`;

function _svgGeneric(letter: string, fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="${fill}"/><text x="10" y="10" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="#fff" font-family="sans-serif">${letter}</text></svg>`;
}

const _SVG_BNB = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#F3BA2F"/><path d="M12.116 13.884L16 10l3.886 3.886 2.26-2.26L16 5.48 9.856 11.624l2.26 2.26zM5.48 16l2.26-2.26 2.26 2.26-2.26 2.26L5.48 16zm6.636 2.116L16 22l3.886-3.886 2.261 2.259L16 26.52l-6.146-6.146 2.262-2.258zm10.144-2.116l2.26-2.26 2.26 2.26-2.26 2.26-2.26-2.26zm-3.954 0L16 18.262l-2.307-2.307 2.307-2.306L18.26 16z" fill="white"/></svg>`;

function _getCurrencyIconSvg(currency: string): string {
  switch (currency) {
    case "BTC":
      return _SVG_BTC;
    case "GMT":
      return _SVG_GMT;
    case "USD":
      return _SVG_USD;
    case "USDT":
      return _SVG_USDT;
    case "TON":
      return _SVG_TON;
    case "BNB":
      return _SVG_BNB;
    default:
      return _svgGeneric((currency[0] ?? "?").toUpperCase(), "#6366f1");
  }
}

// Module-level image cache — persists across re-renders / re-opens
const _iconCache = new Map<string, HTMLImageElement>();
let _logoCache: HTMLImageElement | null | undefined; // undefined = not tried yet

function _svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg load"));
    };
    img.src = url;
  });
}

async function _preloadCardAssets(currencies: string[]): Promise<{
  logoImg: HTMLImageElement | null;
  iconMap: Map<string, HTMLImageElement>;
}> {
  // App logo
  const logoPromise: Promise<HTMLImageElement | null> =
    _logoCache !== undefined
      ? Promise.resolve(_logoCache)
      : new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            _logoCache = img;
            resolve(img);
          };
          img.onerror = () => {
            _logoCache = null;
            resolve(null);
          };
          img.src = "/logo.webp";
        });

  // Currency icons
  const unique = [...new Set(currencies)];
  const iconPromises = unique.map(async (cur): Promise<[string, HTMLImageElement] | null> => {
    if (_iconCache.has(cur)) return [cur, _iconCache.get(cur)!];
    try {
      const img = await _svgToImage(_getCurrencyIconSvg(cur));
      _iconCache.set(cur, img);
      return [cur, img];
    } catch {
      return null;
    }
  });

  // Ensure Space Grotesk is loaded before canvas draws it
  const fontPromise = document.fonts
    ? Promise.all([
        document.fonts.load('7px "Space Grotesk"'),
        document.fonts.load('bold 12px "Space Grotesk"'),
        document.fonts.load('bold 20px "Space Grotesk"'),
      ]).catch(() => null)
    : Promise.resolve(null);

  const [logoImg, ...iconResults] = await Promise.all([logoPromise, fontPromise, ...iconPromises]);
  const iconMap = new Map<string, HTMLImageElement>();
  for (const r of iconResults) {
    if (r && Array.isArray(r))
      iconMap.set((r as [string, HTMLImageElement])[0], (r as [string, HTMLImageElement])[1]);
  }
  return { logoImg, iconMap };
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  const R = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + R, y);
  ctx.lineTo(x + w - R, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + R);
  ctx.lineTo(x + w, y + h - R);
  ctx.quadraticCurveTo(x + w, y + h, x + w - R, y + h);
  ctx.lineTo(x + R, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - R);
  ctx.lineTo(x, y + R);
  ctx.quadraticCurveTo(x, y, x + R, y);
  ctx.closePath();
  ctx.fill();
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  sheets: SheetEntry[],
  periodLabel: string,
  alias: string,
  logoImg: HTMLImageElement | null,
  iconMap: Map<string, HTMLImageElement>,
  fiatCurrency: string,
  includeMaintenance: boolean,
  miningStats: MiningStats | null,
): void {
  const W = CARD_W;
  const H = computeTotalH(sheets, includeMaintenance, miningStats !== null);

  const ORANGE = "#f7931a";
  const BG = "#0f0f0f";
  const CARD_BG = "#1a1a1a";
  const WHITE = "#f0f0f0";
  const MUTED = "#888888";
  const DIM = "#555555";
  const DIVIDER = "#1e1e1e";
  const cardColors: CardColors = { ORANGE, CARD_BG, WHITE, MUTED, DIM };

  ctx.textBaseline = "top";

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Orange top accent bar (4px)
  ctx.fillStyle = ORANGE;
  ctx.fillRect(0, 0, W, 4);

  let y = PAD;

  // ── Header ──
  const LOGO_SIZE = 36;
  const logoY = y;
  if (logoImg) {
    ctx.drawImage(logoImg, PAD, logoY, LOGO_SIZE, LOGO_SIZE);
  } else {
    const cx = PAD + LOGO_SIZE / 2,
      cy = logoY + LOGO_SIZE / 2,
      r = LOGO_SIZE / 2 - 1;
    ctx.fillStyle = ORANGE;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
  }

  const brandX = PAD + LOGO_SIZE + 8;
  ctx.font = "bold 20px 'Space Grotesk', system-ui, sans-serif";
  ctx.textAlign = "left";
  const brandY = logoY + (LOGO_SIZE - 20) / 2;
  ctx.fillStyle = WHITE;
  ctx.fillText("REWARD", brandX, brandY);
  const rewardW = ctx.measureText("REWARD").width;
  ctx.fillStyle = ORANGE;
  ctx.fillText("TRACKR", brandX + rewardW, brandY);

  // ── Stat badge — same style as sheet cards ──
  if (miningStats || alias) {
    const BADGE_CORNER = 10; // matches sheet card radius
    const LABEL_FS = 7;
    const VAL_FS = 12;
    const UNIT_FS = 8;
    const COL_PAD = 16;
    const BADGE_H = LOGO_SIZE + 8; // ~44px
    const BAR_W = 4; // orange left accent bar (same as sheet cards)
    const BAR_INSET = 10;
    const TEXT_GAP = 3; // gap between label and value
    const BLOCK_H = LABEL_FS + TEXT_GAP + VAL_FS; // total label+value block height

    const cols: Array<{ label: string; value: string; unit?: string }> = [];
    if (alias) cols.push({ label: "ACCOUNT", value: alias });
    if (miningStats) {
      cols.push({ label: "MINERS", value: `${miningStats.miners}` });
      cols.push({ label: "HASHPOWER", value: fmtTH(miningStats.totalTH), unit: "TH" });
      if (miningStats.avgEE !== null)
        cols.push({ label: "EFFICIENCY", value: `${Math.round(miningStats.avgEE)}`, unit: "W/TH" });
    }

    // Measure each column's natural content width
    const colWidths = cols.map(({ label, value, unit }) => {
      ctx.font = `${LABEL_FS}px 'Space Grotesk', system-ui, sans-serif`;
      const lw = ctx.measureText(label).width;
      ctx.font = `bold ${VAL_FS}px 'Space Grotesk', system-ui, sans-serif`;
      const vw = ctx.measureText(value).width;
      let uw = 0;
      if (unit) {
        ctx.font = `${UNIT_FS}px 'Space Grotesk', system-ui, sans-serif`;
        uw = ctx.measureText(unit).width + 3;
      }
      return Math.max(lw, vw + uw) + COL_PAD * 2;
    });

    const BADGE_W = colWidths.reduce((a, b) => a + b, 0);
    const bx = W - PAD - BADGE_W;
    const by = logoY + (LOGO_SIZE - BADGE_H) / 2;
    const midY = by + BADGE_H / 2;
    // Center the label+value block as a whole unit
    const BLOCK_TOP = midY - BLOCK_H / 2;
    const LABEL_Y = BLOCK_TOP; // label top
    const VAL_Y = BLOCK_TOP + LABEL_FS + TEXT_GAP; // value top

    // Card background — identical to sheet cards
    fillRoundRect(ctx, bx, by, BADGE_W, BADGE_H, BADGE_CORNER, CARD_BG);

    // Orange left accent bar — identical to sheet cards
    fillRoundRect(ctx, bx, by + BAR_INSET, BAR_W, BADGE_H - BAR_INSET * 2, 2, ORANGE);

    // Draw columns
    let colX = bx;
    for (let i = 0; i < cols.length; i++) {
      const { label, value, unit } = cols[i];
      const cw = colWidths[i];
      const centerX = colX + cw / 2;

      // Label — top of block, centered horizontally
      ctx.font = `${LABEL_FS}px 'Space Grotesk', system-ui, sans-serif`;
      ctx.fillStyle = MUTED;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, centerX, LABEL_Y);

      // Value + optional muted unit — bottom of block, centered as a group
      ctx.font = `bold ${VAL_FS}px 'Space Grotesk', system-ui, sans-serif`;
      const vw = ctx.measureText(value).width;
      let uw = 0;
      if (unit) {
        ctx.font = `${UNIT_FS}px 'Space Grotesk', system-ui, sans-serif`;
        uw = ctx.measureText(unit).width + 3;
      }
      const startX = centerX - (vw + uw) / 2;

      ctx.font = `bold ${VAL_FS}px 'Space Grotesk', system-ui, sans-serif`;
      ctx.fillStyle = WHITE;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(value, startX, VAL_Y);
      if (unit) {
        ctx.font = `${UNIT_FS}px 'Space Grotesk', system-ui, sans-serif`;
        ctx.fillStyle = MUTED;
        ctx.textBaseline = "top";
        ctx.fillText(unit, startX + vw + 3, VAL_Y + (VAL_FS - UNIT_FS));
      }

      // Divider after column (except last)
      if (i < cols.length - 1) {
        ctx.save();
        ctx.strokeStyle = DIM;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colX + cw, by + 8);
        ctx.lineTo(colX + cw, by + BADGE_H - 8);
        ctx.stroke();
        ctx.restore();
      }

      colX += cw;
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  y += LOGO_SIZE + 10;

  ctx.font = "12px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillStyle = MUTED;
  ctx.fillText("GoMining Rewards Summary", PAD, y);

  y += 18;

  ctx.font = "bold 14px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillStyle = ORANGE;
  ctx.textAlign = "left";
  ctx.fillText(periodLabel, PAD, y);

  y += 34; // → PAD + HEADER_H

  // Divider
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(PAD, y, W - 2 * PAD, DIV_H);
  y += DIV_H + GRID_TOP;

  // ── Sheet cards grid ──
  const miningSheets = sheets.filter((s) => MINING_GROUP_KEYS.has(s.key));
  const otherSheets = sheets.filter((s) => !MINING_GROUP_KEYS.has(s.key));
  const hasMiningGroup = miningSheets.length === 2;
  const sortedSheets = hasMiningGroup ? [...miningSheets, ...otherSheets] : sheets;
  const n = sortedSheets.length;
  const maxRewards = Math.max(1, ...sortedSheets.map((s) => s.rewards.length));
  const hasMining = sortedSheets.some((s) => !!s.mining);
  const CARD_ITEM_H = computeCardItemH(maxRewards, hasMining, includeMaintenance);
  const COLS = computeColCount(n);
  const ROWS = Math.ceil(n / COLS);
  const cardW = Math.floor((W - 2 * PAD - (COLS - 1) * GAP) / COLS);

  for (let i = 0; i < n; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = PAD + col * (cardW + GAP);
    const cy = y + row * (CARD_ITEM_H + GAP);
    _drawSingleCard(
      ctx,
      sortedSheets[i],
      cx,
      cy,
      cardW,
      CARD_ITEM_H,
      iconMap,
      fiatCurrency,
      cardColors,
      includeMaintenance,
    );
  }

  y += ROWS * CARD_ITEM_H + Math.max(0, ROWS - 1) * GAP + GRID_BOT;

  // Divider
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(PAD, y, W - 2 * PAD, DIV_H);
  y += DIV_H;

  // ── Footer ──
  ctx.font = "10px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillStyle = DIM;
  ctx.textAlign = "left";
  ctx.fillText("rewardtrackr.com", PAD, y + 13);

  ctx.textAlign = "right";
  const todayStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  ctx.fillText(`Generated ${todayStr}`, W - PAD, y + 13);
}

// ─── ScPicker — custom styled dropdown (matches fiat-dropdown style) ──────────

function ScPicker({
  value,
  options,
  onChange,
  style,
}: {
  value: string | number;
  options: Array<{ label: string; value: string | number }>;
  onChange: (v: string | number) => void;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="sc-picker" style={style}>
      <button
        type="button"
        className="sc-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label ?? "—"}</span>
        <span className={`sc-picker-caret${open ? " sc-picker-caret--open" : ""}`}>▾</span>
      </button>
      {open && (
        <ul className="sc-picker-menu" role="listbox">
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`sc-picker-option${opt.value === value ? " sc-picker-option--selected" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShareCardModal({
  isOpen,
  onClose,
  cacheVersion = 0,
}: {
  isOpen: boolean;
  onClose: () => void;
  cacheVersion?: number;
}) {
  const [period, setPeriod] = useState<Period>("month");
  const [selMonth, setSelMonth] = useState(() => new Date().getMonth());
  const [selYear, setSelYear] = useState(() => new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [exclusions, setExclusions] = useState<ExclusionRecord>({});
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [fiatDisplay, setFiatDisplay] = useState<string>("USD");
  const [includeMaintenance, setIncludeMaintenance] = useState(true);
  const [powerTrend, setPowerTrend] = useState<MiningStats | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, isOpen);

  const alias = useMemo(() => localStorage.getItem(LS_KEY_SYNC_ALIAS) ?? "", []);

  // Detect the extra fiat currency stored in the cache (if any)
  const availableFiat = useMemo(() => {
    void cacheVersion;
    for (const k of ALL_REWARD_KEYS) {
      const entry = loadCacheEntry(k);
      if (entry?.extraFiatCurrency) return entry.extraFiatCurrency;
    }
    return null;
  }, [cacheVersion]);

  // Date range for the current period selection — shared by sheetData + filter modal
  const range = useMemo(
    () => getDateRangeFilter(period, selMonth, selYear),
    [period, selMonth, selYear],
  );

  // Reset per-record exclusions whenever the period changes
  // (exclusion IDs are indexed within the date-filtered array, so they're period-specific)
  useEffect(() => {
    setExclusions({});
  }, [period, selMonth, selYear]);

  // Date-filtered cache snapshot — this is what ShareFilterModal receives so it only
  // shows the records that fall inside the selected time window.
  const filteredCacheForFilter = useMemo((): CacheState => {
    void cacheVersion;
    const result = {} as CacheState;
    for (const k of ALL_REWARD_KEYS) {
      const entry = loadCacheEntry(k);
      if (!entry) {
        result[k] = null;
        continue;
      }
      const recs = filterByDate(entry.records as unknown[], range) as typeof entry.records;
      result[k] = recs.length ? { ...entry, records: recs, totalCount: recs.length } : null;
    }
    return result;
  }, [cacheVersion, range]);

  // Sheets that have data in the cache AND have records in the selected time range
  const availableSheets = useMemo(() => {
    void cacheVersion;
    return ALL_TABS.filter((tab) => {
      if (tab.key === "purchases") {
        const p = loadCacheEntry("purchases" as RewardKey);
        const u = loadCacheEntry("upgrades" as RewardKey);
        return (p?.records?.length ?? 0) > 0 || (u?.records?.length ?? 0) > 0;
      }
      return (loadCacheEntry(tab.key as RewardKey)?.records?.length ?? 0) > 0;
    });
  }, [cacheVersion]);

  // Subset of availableSheets that have records in the current time period
  const sheetsInPeriod = useMemo(() => {
    return new Set(
      availableSheets
        .filter((tab) => {
          if (tab.key === "purchases") {
            return !!(filteredCacheForFilter["purchases"] || filteredCacheForFilter["upgrades"]);
          }
          return !!filteredCacheForFilter[tab.key as RewardKey];
        })
        .map((t) => t.key),
    );
  }, [availableSheets, filteredCacheForFilter]);

  // Auto-select sheets that have data in the current period; deselect those that don't
  useEffect(() => {
    if (isOpen) {
      setSelectedSheets(new Set(sheetsInPeriod));
    }
  }, [isOpen, sheetsInPeriod]);

  // Compute totals per selected sheet for the chosen period
  const sheetData = useMemo((): SheetEntry[] => {
    void cacheVersion;
    return availableSheets
      .filter((tab) => selectedSheets.has(tab.key))
      .flatMap((tab) => {
        let records: unknown[];
        if (tab.key === "purchases") {
          const purchRecs = loadCacheEntry("purchases" as RewardKey)?.records ?? [];
          const upgrRecs = loadCacheEntry("upgrades" as RewardKey)?.records ?? [];
          // Date-filter first so indices match what the filter modal shows
          const dfp = filterByDate(purchRecs, range);
          const dfu = filterByDate(upgrRecs, range);
          const excSet = new Set(exclusions["purchases"] ?? []);
          const fp = dfp.filter(
            (r, i) =>
              !excSet.has(
                `purchases::${String((r as Record<string, unknown>).createdAt ?? "")}::${i}`,
              ),
          );
          const fu = dfu.filter(
            (r, i) =>
              !excSet.has(
                `upgrades::${String((r as Record<string, unknown>).createdAt ?? "")}::${i}`,
              ),
          );
          records = [...fp, ...fu];
        } else {
          const raw = loadCacheEntry(tab.key as RewardKey)?.records ?? [];
          const dfRaw = filterByDate(raw, range);
          const excSet = new Set(exclusions[tab.key as RewardKey] ?? []);
          records = dfRaw.filter(
            (r, i) =>
              !excSet.has(
                `${tab.key}::${String((r as Record<string, unknown>).createdAt ?? "")}::${i}`,
              ),
          );
        }
        if (!records.length) return [];
        const isMining = tab.key === "solo-mining" || tab.key === "minerwars";
        const rewards = computeRewardsByCurrency(records);
        const mining = isMining ? computeMiningBreakdown(records) : undefined;
        return [{ key: tab.key, label: SHEET_LABELS[tab.key] ?? tab.key, rewards, mining }];
      });
  }, [cacheVersion, range, selectedSheets, availableSheets, exclusions]);

  // Redraw canvas preview whenever sheet data or period changes
  useEffect(() => {
    if (sheetData.length === 0) return;
    let cancelled = false;
    const currencies = sheetData.flatMap((s) => s.rewards.map((r) => r.currency));
    void _preloadCardAssets(currencies).then(({ logoImg, iconMap }) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const PREVIEW_W = (previewRef.current?.clientWidth ?? 680) - 2; // -2 for border
      const H = computeTotalH(sheetData, includeMaintenance, !!powerTrend);
      const scale = PREVIEW_W / CARD_W;
      const previewH = Math.round(H * scale);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = PREVIEW_W * dpr;
      canvas.height = previewH * dpr;
      canvas.style.width = `${PREVIEW_W}px`;
      canvas.style.height = `${previewH}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr * scale, dpr * scale);
      drawCard(
        ctx,
        sheetData,
        getPeriodLabel(period, selMonth, selYear),
        alias,
        logoImg,
        iconMap,
        fiatDisplay,
        includeMaintenance,
        powerTrend,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [sheetData, period, selMonth, selYear, alias, fiatDisplay, includeMaintenance, powerTrend]);

  const handleDownload = useCallback(async () => {
    if (sheetData.length === 0) return;
    setGenerating(true);
    try {
      const currencies = sheetData.flatMap((s) => s.rewards.map((r) => r.currency));
      const { logoImg, iconMap } = await _preloadCardAssets(currencies);
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const H = computeTotalH(sheetData, includeMaintenance, !!powerTrend);
      const canvas = document.createElement("canvas");
      canvas.width = CARD_W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      const label = getPeriodLabel(period, selMonth, selYear);
      drawCard(
        ctx,
        sheetData,
        label,
        alias,
        logoImg,
        iconMap,
        fiatDisplay,
        includeMaintenance,
        powerTrend,
      );

      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve();
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `rewardtrackr-${label.replace(/\s+/g, "-").toLowerCase()}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve();
        }, "image/png");
      });
    } finally {
      setGenerating(false);
    }
  }, [sheetData, period, selMonth, selYear, alias, fiatDisplay, includeMaintenance, powerTrend]);

  const hasMiningSelected = useMemo(
    () =>
      (selectedSheets.has("solo-mining") || selectedSheets.has("minerwars")) &&
      (sheetsInPeriod.has("solo-mining") || sheetsInPeriod.has("minerwars")),
    [selectedSheets, sheetsInPeriod],
  );

  // Fetch current total mining power when a mining sheet is selected
  useEffect(() => {
    if (!hasMiningSelected) {
      setPowerTrend(null);
      return;
    }
    let cancelled = false;
    const token = sessionStorage.getItem(LS_KEY_SYNC_TOKEN) ?? "";
    if (!token) return;
    const headers = buildApiHeaders(token);
    void (async () => {
      try {
        const [nftStats, bonusStats] = await Promise.all([
          getMyNftStats(headers),
          getBonusMinerStats(headers),
        ]);
        if (cancelled) return;
        const totalTH = nftStats.totalPower + (bonusStats?.power ?? 0);
        const totalMiners = nftStats.count + (bonusStats ? 1 : 0);
        // Power-weighted average EE across NFTs + bonus miner
        let avgEE: number | null = null;
        const totalForEE = nftStats.totalPower + (bonusStats?.power ?? 0);
        if (totalForEE > 0) {
          let weightedSum = (nftStats.avgEE ?? 0) * nftStats.totalPower;
          if (bonusStats?.energyEfficiency != null)
            weightedSum += bonusStats.energyEfficiency * bonusStats.power;
          const hasSomeEE = nftStats.avgEE != null || bonusStats?.energyEfficiency != null;
          if (hasSomeEE) avgEE = weightedSum / totalForEE;
        }
        setPowerTrend(totalTH > 0 ? { miners: totalMiners, totalTH, avgEE } : null);
      } catch {
        if (!cancelled) setPowerTrend(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasMiningSelected]);

  const toggleSheet = useCallback((key: string) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="sc-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Generate shareable image"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sc-panel">
        {/* Header */}
        <div className="sc-header">
          <span className="sc-title">Generate Shareable Image</span>
          <button className="sc-close" onClick={onClose} aria-label="Close">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="sc-body">
          {/* Top row: controls */}
          <div className="sc-top-row">
            <div className="sc-section sc-period-section">
              <div className="sc-section-label-row">
                <span className="sc-section-label">Time period</span>
              </div>
              <div className="sc-period-grid">
                {(["7d", "month", "year", "all"] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`sc-period-btn${period === p ? " sc-period-btn--on" : ""}`}
                    onClick={() => setPeriod(p)}
                  >
                    {p === "7d"
                      ? "7 days"
                      : p === "month"
                        ? "Month"
                        : p === "year"
                          ? "Year"
                          : "All time"}
                  </button>
                ))}
              </div>
              {/* Always rendered so height stays fixed; hidden when irrelevant */}
              <div
                className={`sc-period-sub${period !== "month" && period !== "year" ? " sc-period-sub--hidden" : ""}`}
              >
                {period !== "year" && (
                  <ScPicker
                    value={selMonth}
                    options={MONTH_NAMES.map((m, i) => ({ label: m, value: i }))}
                    onChange={(v) => setSelMonth(Number(v))}
                    style={{ visibility: period === "month" ? "visible" : "hidden" }}
                  />
                )}
                <ScPicker
                  value={selYear}
                  options={yearOptions.map((y) => ({ label: String(y), value: y }))}
                  onChange={(v) => setSelYear(Number(v))}
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
                    {(["USD", availableFiat] as string[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`sc-fiat-btn${fiatDisplay === f ? " sc-fiat-btn--on" : ""}`}
                        onClick={() => setFiatDisplay(f)}
                      >
                        {f}
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
                        onChange={(e) => setIncludeMaintenance(e.target.checked)}
                        aria-label="Include maintenance"
                      />
                    </label>
                  </>
                )}
                {/* Spacer so this section stays same height as period section */}
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
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
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
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        <span className="sc-sheet-name">{SHEET_LABELS[tab.key] ?? tab.key}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Preview — full width below controls */}
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

        {/* Footer */}
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
            cache={filteredCacheForFilter}
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
