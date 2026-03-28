import { memo, useEffect, useMemo, useRef, useState } from "react";
import { loadCacheEntry } from "@/features/export/utils/cache";
import type { RewardKey } from "@/features/export/types";
import "./data-viewer.css";

// ── Types ─────────────────────────────────────────────────────

type Currency = "BTC" | "GMT" | "USD" | "FIAT";
type TabKind = "mining" | "simple" | "earn" | "tx" | "purchase";

interface TabDef {
  key: RewardKey;
  label: string;
  kind: TabKind;
}

const ALL_TABS: TabDef[] = [
  { key: "solo-mining", label: "Solo Mining", kind: "mining" },
  { key: "minerwars", label: "MinerWars", kind: "mining" },
  { key: "bounty", label: "Bounties", kind: "simple" },
  { key: "referrals", label: "Referrals", kind: "simple" },
  { key: "ambassador", label: "Ambassador", kind: "simple" },
  { key: "deposits", label: "Deposits", kind: "simple" },
  { key: "withdrawals", label: "Withdrawals", kind: "simple" },
  { key: "purchases", label: "Purchases & Upgrades", kind: "purchase" },
  { key: "simple-earn", label: "Simple Earn", kind: "earn" },
  { key: "transactions", label: "Transactions", kind: "tx" },
];

// ── Currency icons ─────────────────────────────────────────────

const CURRENCY_COLORS: Record<string, string> = {
  ETH: "#627EEA",
  BNB: "#F0B90B",
  SOL: "#9945FF",
  TON: "#0098EA",
  USDT: "#26A17B",
  USDC: "#2775CA",
};

function BtcIcon() {
  return (
    <svg
      className="dv-currency-icon dv-currency-icon-svg"
      viewBox="0 0 41 40"
      fill="none"
      aria-label="BTC"
    >
      <g clipPath="url(#btc-clip)">
        <path
          d="M39.8968 24.8382C37.2255 35.5525 26.3738 42.0731 15.6583 39.4012C4.94712 36.73 -1.57344 25.8776 1.09903 15.164C3.769 4.44845 14.6208 -2.07273 25.3332 0.598491C36.0481 3.26971 42.568 14.1234 39.8968 24.8382Z"
          fill="#F7931A"
        />
        <path
          d="M29.7598 17.387C30.179 14.585 28.0455 13.0787 25.1283 12.0738L26.0746 8.2781L23.7642 7.70229L22.8429 11.398C22.2355 11.2466 21.6117 11.1038 20.9918 10.9623L21.9196 7.24231L19.6105 6.6665L18.6635 10.4609C18.1608 10.3464 17.6672 10.2332 17.1882 10.1141L17.1908 10.1022L14.0045 9.30665L13.3898 11.7744C13.3898 11.7744 15.1041 12.1672 15.0679 12.1916C16.0036 12.4252 16.1728 13.0444 16.1445 13.5354L15.0666 17.8595C15.1311 17.8759 15.2146 17.8996 15.3068 17.9365C15.2298 17.9174 15.1475 17.8963 15.0626 17.8759L13.5517 23.9334C13.4372 24.2177 13.147 24.6441 12.4929 24.4822C12.5159 24.5158 10.8135 24.063 10.8135 24.063L9.6665 26.7078L12.6732 27.4573C13.2325 27.5975 13.7807 27.7442 14.3203 27.8824L13.3642 31.7216L15.672 32.2974L16.6189 28.499C17.2494 28.6701 17.8614 28.8281 18.4602 28.9768L17.5165 32.7574L19.827 33.3332L20.7832 29.5013C24.723 30.2469 27.6856 29.9461 28.9326 26.3827C29.9375 23.5136 28.8826 21.8585 26.8097 20.7793C28.3193 20.4312 29.4564 19.4382 29.7598 17.387ZM24.4808 24.7895C23.7668 27.6587 18.936 26.1076 17.3698 25.7187L18.6385 20.6326C20.2047 21.0235 25.2271 21.7973 24.4808 24.7895ZM25.1955 17.3455C24.544 19.9554 20.5232 18.6294 19.2189 18.3043L20.3692 13.6913C21.6735 14.0164 25.8739 14.6231 25.1955 17.3455Z"
          fill="white"
        />
      </g>
      <defs>
        <clipPath id="btc-clip">
          <rect width="40" height="40" fill="white" transform="translate(0.5)" />
        </clipPath>
      </defs>
    </svg>
  );
}

function GmtIcon() {
  return (
    <svg
      className="dv-currency-icon dv-currency-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-label="GMT"
    >
      <circle cx="12" cy="12" r="12" fill="#7540EF" />
      <path
        d="M12.1879 3.6001C10.9516 3.6001 9.69996 3.85967 8.49415 4.42462C6.41833 5.38656 4.8462 7.09668 4.08303 9.23432C3.33512 11.3414 3.45723 13.6012 4.43409 15.6167C6.46412 19.8004 11.5926 21.5716 15.8664 19.5866C16.9501 19.0828 17.9117 18.3651 18.7054 17.4795C19.4838 16.5939 20.0486 15.5709 20.3996 14.4563L18.5985 12.0133L20.3538 9.61605H17.8811L16.1259 11.9827L17.9422 14.4105L17.9269 14.441C16.5532 17.5253 12.8442 18.9454 9.6847 17.5864C8.1431 16.9146 6.95255 15.6931 6.35728 14.1509C5.77727 12.6393 5.8078 11.0055 6.46412 9.52443C7.83783 6.44011 11.5316 5.02011 14.7064 6.37904C15.6985 6.80657 16.5532 7.46313 17.1943 8.30292H19.9112C18.4306 5.34075 15.3779 3.6001 12.1879 3.6001Z"
        fill="white"
      />
      <path
        d="M16.3565 9.59961H13.8991L12.1133 11.9816L13.8991 14.3482H16.3565L14.6317 11.9816L16.3565 9.59961Z"
        fill="white"
      />
    </svg>
  );
}

function UsdIcon() {
  return (
    <svg
      className="dv-currency-icon dv-currency-icon-svg"
      viewBox="0 0 20 20"
      fill="none"
      aria-label="USD"
    >
      <circle cx="10" cy="10" r="9" fill="#22c55e" />
      <text
        x="10"
        y="10"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="13"
        fontWeight="700"
        fill="#fff"
        fontFamily="sans-serif"
      >
        $
      </text>
    </svg>
  );
}

function getCurrencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? code.slice(0, 1);
  } catch {
    return code.slice(0, 1);
  }
}

function FiatIcon({ code }: { code: string }) {
  const symbol = getCurrencySymbol(code);
  const long = symbol.length > 1;
  return (
    <svg
      className="dv-currency-icon dv-currency-icon-svg"
      viewBox="0 0 20 20"
      fill="none"
      aria-label={code}
    >
      <circle cx="10" cy="10" r="9" fill="#6366f1" />
      <text
        x="10"
        y="10"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={long ? "9" : "13"}
        fontWeight="700"
        fill="#fff"
        fontFamily="sans-serif"
      >
        {symbol}
      </text>
    </svg>
  );
}

function UsdtIcon() {
  return (
    <svg
      className="dv-currency-icon dv-currency-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-label="USDT"
    >
      <path
        d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z"
        fill="#26A17B"
      />
      <path
        d="M13.4212 12.9295V12.9276C13.3414 12.9332 12.9295 12.9573 12.013 12.9573C11.2801 12.9573 10.7662 12.9369 10.5844 12.9276V12.9295C7.76623 12.8052 5.66419 12.3154 5.66419 11.7273C5.66419 11.141 7.76809 10.6494 10.5844 10.525V12.4416C10.7681 12.4545 11.2968 12.4861 12.026 12.4861C12.9017 12.4861 13.3395 12.449 13.4212 12.4416V10.5269C16.2338 10.6531 18.3302 11.1429 18.3302 11.7291C18.3302 12.3154 16.2319 12.8052 13.4212 12.9314M13.4212 10.3284V8.6141H17.3451V6H6.66234V8.6141H10.5863V10.3284C7.39703 10.475 5 11.1058 5 11.8627C5 12.6197 7.39889 13.2505 10.5863 13.3989V18.8942H13.423V13.3989C16.6067 13.2523 19 12.6215 19 11.8646C19 11.1095 16.6067 10.4768 13.423 10.3302"
        fill="white"
      />
    </svg>
  );
}

function TonIcon() {
  return (
    <svg
      className="dv-currency-icon dv-currency-icon-svg"
      viewBox="0 0 56 56"
      fill="none"
      aria-label="TON"
    >
      <path
        d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z"
        fill="#0098EA"
      />
      <path
        d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5381 22.4861C43.3045 19.4251 41.0761 15.6277 37.5627 15.6277H37.5603ZM26.2548 36.8068L23.6847 31.8327L17.4833 20.7414C17.0742 20.0315 17.5795 19.1218 18.4362 19.1218H26.2524V36.8092L26.2548 36.8068ZM38.5108 20.739L32.3118 31.8351L29.7417 36.8068V19.1194H37.5579C38.4146 19.1194 38.9199 20.0291 38.5108 20.739Z"
        fill="white"
      />
    </svg>
  );
}

function SolIcon() {
  return (
    <svg
      className="dv-currency-icon dv-currency-icon-svg"
      viewBox="0 0 740 740"
      fill="none"
      aria-label="SOL"
    >
      <path
        d="M370 739.5C574.069 739.5 739.5 574.069 739.5 370C739.5 165.931 574.069 0.5 370 0.5C165.931 0.5 0.5 165.931 0.5 370C0.5 574.069 165.931 739.5 370 739.5Z"
        fill="url(#sol-grad)"
      />
      <path
        d="M228.522 471.85C229.919 470.317 231.623 469.094 233.522 468.26C235.414 467.431 237.456 466.999 239.522 466.99L578.132 467.27C579.575 467.27 580.986 467.69 582.195 468.478C583.404 469.267 584.357 470.389 584.939 471.71C585.521 473.03 585.706 474.492 585.472 475.916C585.238 477.34 584.595 478.665 583.622 479.73L511.512 559.13C510.118 560.662 508.419 561.885 506.525 562.722C504.631 563.559 502.582 563.991 500.512 563.99L161.912 563.71C160.47 563.705 159.062 563.283 157.856 562.494C156.65 561.704 155.699 560.583 155.118 559.264C154.537 557.945 154.351 556.486 154.582 555.064C154.813 553.641 155.452 552.316 156.422 551.25L228.522 471.85ZM583.592 405.76C584.565 406.825 585.208 408.15 585.442 409.574C585.676 410.998 585.491 412.459 584.909 413.78C584.327 415.1 583.374 416.223 582.165 417.011C580.956 417.8 579.545 418.22 578.102 418.22L239.502 418.5C237.431 418.501 235.382 418.069 233.488 417.232C231.594 416.395 229.895 415.172 228.502 413.64L156.412 334.2C155.442 333.131 154.803 331.804 154.572 330.38C154.337 328.958 154.522 327.498 155.102 326.179C155.683 324.86 156.635 323.738 157.842 322.95C159.05 322.162 160.459 321.739 161.902 321.73L500.512 321.46C502.583 321.456 504.632 321.886 506.527 322.723C508.422 323.56 510.12 324.785 511.512 326.32L583.592 405.76ZM228.522 180.87C229.913 179.335 231.611 178.11 233.506 177.273C235.401 176.436 237.45 176.006 239.522 176.01L578.132 176.29C579.573 176.291 580.984 176.712 582.191 177.5C583.398 178.288 584.35 179.41 584.932 180.73C585.513 182.047 585.698 183.504 585.466 184.925C585.233 186.345 584.592 187.667 583.622 188.73L511.512 268.13C510.118 269.662 508.419 270.885 506.525 271.722C504.631 272.559 502.582 272.991 500.512 272.99L161.912 272.71C160.468 272.71 159.056 272.289 157.848 271.499C156.64 270.708 155.689 269.583 155.112 268.26C154.535 266.942 154.353 265.486 154.585 264.066C154.817 262.647 155.455 261.325 156.422 260.26L228.522 180.87Z"
        fill="white"
      />
      <defs>
        <linearGradient
          id="sol-grad"
          x1="22.9373"
          y1="755.595"
          x2="789.865"
          y2="65.3742"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.08" stopColor="#9945FF" />
          <stop offset="0.3" stopColor="#8954F3" />
          <stop offset="0.5" stopColor="#5497D5" />
          <stop offset="0.6" stopColor="#43B4CA" />
          <stop offset="0.72" stopColor="#2CD3B0" />
          <stop offset="0.97" stopColor="#14F195" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function EthIcon() {
  return (
    <svg
      className="dv-currency-icon dv-currency-icon-svg"
      viewBox="0 0 32 32"
      fill="none"
      aria-label="ETH"
    >
      <path
        d="M31.9132 16.0003C31.9132 24.7904 24.7877 31.9161 15.9977 31.9161C7.20769 31.9161 0.0820312 24.7904 0.0820312 16.0003C0.0820312 7.21037 7.20769 0.0847168 15.9977 0.0847168C24.7876 0.0847168 31.9132 7.21037 31.9132 16.0003Z"
        fill="#1085EE"
      />
      <g opacity="0.8">
        <path
          d="M15.9469 8.61536L15.8486 8.94949V18.6452L15.9469 18.7434L20.4476 16.083L15.9469 8.61536Z"
          fill="white"
        />
        <path
          opacity="0.7"
          d="M15.947 8.61536L11.4463 16.083L15.947 18.7434V14.0374V8.61536Z"
          fill="white"
        />
        <path
          d="M15.947 20.2077L15.8916 20.2752V23.7291L15.947 23.8909L20.4504 17.5487L15.947 20.2077Z"
          fill="white"
        />
        <path
          opacity="0.7"
          d="M15.947 23.8909V20.2077L11.4463 17.5487L15.947 23.8909Z"
          fill="white"
        />
        <path
          opacity="0.7"
          d="M15.9473 18.7434L20.4479 16.0831L15.9473 14.0374V18.7434Z"
          fill="white"
        />
        <path
          opacity="0.7"
          d="M11.4463 16.083L15.9469 18.7433V14.0374L11.4463 16.083Z"
          fill="white"
        />
      </g>
    </svg>
  );
}

function BnbIcon() {
  return (
    <svg
      className="dv-currency-icon dv-currency-icon-svg"
      viewBox="0 0 40 40"
      fill="none"
      aria-label="BNB"
    >
      <rect width="40" height="40" rx="20" fill="white" />
      <path
        d="M19.9675 40C30.9954 40 39.9352 31.0457 39.9352 20C39.9352 8.9543 30.9954 0 19.9675 0C8.93961 0 -0.000244141 8.9543 -0.000244141 20C-0.000244141 31.0457 8.93961 40 19.9675 40Z"
        fill="#F0B90B"
      />
      <path
        d="M12.6873 20.0001L9.68734 23.0209L6.6665 20.0001L9.68734 16.9792L12.6873 20.0001ZM19.9998 12.6876L25.1665 17.8542L28.1873 14.8334L23.0207 9.68758L19.9998 6.66675L16.979 9.68758L11.8332 14.8334L14.854 17.8542L19.9998 12.6876ZM30.3123 16.9792L27.3123 20.0001L30.3332 23.0209L33.3332 20.0001L30.3123 16.9792ZM19.9998 27.3126L14.8332 22.1459L11.8332 25.1667L16.9998 30.3334L19.9998 33.3334L23.0207 30.3126L28.1873 25.1459L25.1665 22.1459L19.9998 27.3126ZM19.9998 23.0209L23.0207 20.0001L19.9998 16.9792L16.979 20.0001L19.9998 23.0209Z"
        fill="white"
      />
    </svg>
  );
}

// BTC/GMT/USDT/TON/SOL/ETH/BNB get real logos; fiat currencies use FiatIcon; others get colored/grey circle with letters
function AnyCurrencyIcon({ currency }: { currency: string }) {
  if (currency === "BTC") return <BtcIcon />;
  if (currency === "GMT") return <GmtIcon />;
  if (currency === "USDT") return <UsdtIcon />;
  if (currency === "TON") return <TonIcon />;
  if (currency === "SOL") return <SolIcon />;
  if (currency === "ETH") return <EthIcon />;
  if (currency === "BNB") return <BnbIcon />;
  if (currency === "USD") return <UsdIcon />;
  // Any valid ISO 4217 currency code gets the FiatIcon with its symbol
  let isValidFiat = false;
  try {
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(0);
    isValidFiat = true;
  } catch {
    /* not a valid fiat code */
  }
  if (isValidFiat) return <FiatIcon code={currency} />;
  const color = CURRENCY_COLORS[currency] ?? "#6b7280";
  const label = currency.slice(0, 3);
  const fontSize = label.length > 2 ? "7" : "9";
  return (
    <svg
      className="dv-currency-icon dv-currency-icon-svg"
      viewBox="0 0 20 20"
      fill="none"
      aria-label={currency}
    >
      <circle cx="10" cy="10" r="9" fill={color} />
      <text
        x="10"
        y="10"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="700"
        fill="#fff"
        fontFamily="sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}

// Only used for mining tabs (BTC / GMT / USD / FIAT selector)
function MiningCurrencyIcon({ currency, fiatCode }: { currency: Currency; fiatCode: string }) {
  if (currency === "BTC") return <BtcIcon />;
  if (currency === "GMT") return <GmtIcon />;
  if (currency === "USD") return <UsdIcon />;
  return <FiatIcon code={fiatCode} />;
}

// ── Helpers ───────────────────────────────────────────────────

function loadFiatCode(): string {
  try {
    const raw = localStorage.getItem("rt_export_config");
    if (!raw) return "EUR";
    const parsed = JSON.parse(raw) as { excelFiatCurrency?: string };
    return typeof parsed.excelFiatCurrency === "string" ? parsed.excelFiatCurrency : "EUR";
  } catch {
    return "EUR";
  }
}

// Mining tabs: decimals driven by selector currency
function fmt(value: number, currency: Currency): string {
  if (!Number.isFinite(value)) return "—";
  const decimals = currency === "BTC" ? 8 : currency === "GMT" ? 4 : 2;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Simple tabs: decimals driven by raw currency string
function fmtAny(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "—";
  if (currency === "BTC") {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    }).format(value);
  }
  // All other currencies: 2 decimals, unless that truncates to 0.00 — then find the first significant decimal
  // Uses floor (truncation) so e.g. 0.005 stays "0.005" instead of rounding up to "0.01"
  let decimals = 2;
  while (
    decimals < 18 &&
    value !== 0 &&
    Math.floor(Math.abs(value) * Math.pow(10, decimals)) === 0
  ) {
    decimals++;
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function getField(record: Record<string, unknown>, currency: Currency, base: string): number {
  const map: Record<Currency, string> = {
    BTC: base,
    GMT: `${base}GMT`,
    USD: base === "reward" ? "rewardInUSD" : `${base}USD`,
    FIAT: base === "reward" ? "rewardInFiat" : `${base}Fiat`,
  };
  const val = record[map[currency]];
  const n = Number(val ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ── Pagination ────────────────────────────────────────────────

const PAGE_SIZE = 15;

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pageCount = Math.ceil(total / PAGE_SIZE);
  if (pageCount <= 1) return null;
  return (
    <div className="dv-pagination">
      <button
        type="button"
        className="dv-pagination-btn"
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        aria-label="Previous page"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <span className="dv-pagination-info">
        {page + 1} / {pageCount}
      </span>
      <button
        type="button"
        className="dv-pagination-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount - 1}
        aria-label="Next page"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}

interface DateRange {
  from: string;
  to: string;
}
const EMPTY_DATE_RANGE: DateRange = { from: "", to: "" };

function isDateRangeActive(r: DateRange): boolean {
  return !!(r.from || r.to);
}

function getDateBounds(rows: Array<{ date: string }>): { minDate?: string; maxDate?: string } {
  if (!rows.length) return {};
  let min = rows[0].date.slice(0, 10);
  let max = min;
  for (const r of rows) {
    const d = r.date.slice(0, 10);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { minDate: min, maxDate: max };
}

function matchesDateRange(isoDate: string, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const d = isoDate.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

function useFilterDropdownPos() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  function capturePos() {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }
  const style: React.CSSProperties | undefined = rect
    ? {
        position: "fixed",
        top: rect.top - 8,
        left: rect.left,
        bottom: "auto",
        transform: "translateY(-100%)",
      }
    : undefined;
  return { btnRef, style, capturePos };
}

function ColFilterWrap({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { btnRef, style, capturePos } = useFilterDropdownPos();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="dv-col-filter">
      <button
        ref={btnRef}
        type="button"
        className={`dv-col-filter-btn${active ? " dv-col-filter-btn--active" : ""}`}
        onClick={() => {
          if (!open) capturePos();
          setOpen((o) => !o);
        }}
      >
        <svg
          width="10"
          height="10"
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
        {label}
      </button>
      {open && (
        <div className="dv-col-filter-dropdown" style={style}>
          {children}
        </div>
      )}
    </div>
  );
}

const DATE_PRESETS = [
  { label: "Today", from: () => iso(0), to: () => iso(0) },
  { label: "Last 7 days", from: () => iso(-6), to: () => iso(0) },
  { label: "Last 30 days", from: () => iso(-29), to: () => iso(0) },
  {
    label: "This month",
    from: () => {
      const d = new Date();
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
    },
    to: () => iso(0),
  },
  { label: "This year", from: () => `${new Date().getFullYear()}-01-01`, to: () => iso(0) },
];

const CAL_MONTHS = [
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

function iso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function MiniCalendar({
  year,
  month,
  pending,
  picking,
  hover,
  minDate,
  maxDate,
  onDayClick,
  onDayHover,
}: {
  year: number;
  month: number;
  pending: DateRange;
  picking: boolean;
  hover: string;
  minDate?: string;
  maxDate?: string;
  onDayClick: (iso: string) => void;
  onDayHover: (iso: string) => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const prevMonthDays = new Date(year, month, 0).getDate();

  const rangeEnd = picking && hover ? hover : pending.to;
  const lo =
    pending.from && rangeEnd ? (pending.from <= rangeEnd ? pending.from : rangeEnd) : pending.from;
  const hi =
    pending.from && rangeEnd ? (pending.from <= rangeEnd ? rangeEnd : pending.from) : pending.from;

  // Build 42-cell grid (6 rows × 7 cols)
  const cells: { day: number; iso: string; out: boolean }[] = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ day: d, iso: isoDate(py, pm, d), out: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: isoDate(year, month, d), out: false });
  }
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ day: d, iso: isoDate(ny, nm, d), out: true });
  }

  return (
    <div className="dv-cal-grid">
      {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
        <span key={d} className="dv-cal-dow">
          {d}
        </span>
      ))}
      {cells.map(({ day, iso: cellIso, out }) => {
        const isDisabled =
          out || (!!minDate && cellIso < minDate) || (!!maxDate && cellIso > maxDate);
        const isSel = !isDisabled && (cellIso === pending.from || cellIso === pending.to);
        const isInRange = !isDisabled && !!lo && !!hi && cellIso > lo && cellIso < hi;
        const hasRange = !!lo && !!hi && lo !== hi;
        const isSelStart = hasRange && !isDisabled && cellIso === lo;
        const isSelEnd = hasRange && !isDisabled && cellIso === hi;
        return (
          <button
            key={cellIso + (out ? "o" : "")}
            type="button"
            className={`dv-cal-day${isDisabled ? " dv-cal-day--out" : ""}${isSel ? " dv-cal-day--sel" : ""}${isSelStart ? " dv-cal-day--sel-start" : ""}${isSelEnd ? " dv-cal-day--sel-end" : ""}${isInRange ? " dv-cal-day--in-range" : ""}`}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onDayClick(cellIso);
            }}
            onMouseEnter={() => {
              if (!isDisabled) onDayHover(cellIso);
            }}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

function DateRangeFilter({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState("");
  const today = new Date();
  const initDate = maxDate ? new Date(maxDate + "T00:00:00") : today;
  const [calYear, setCalYear] = useState(initDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initDate.getMonth());
  const ref = useRef<HTMLDivElement>(null);
  const years = Array.from({ length: 8 }, (_, i) => today.getFullYear() - 5 + i);
  const { btnRef, style: dropStyle, capturePos } = useFilterDropdownPos();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openPicker() {
    capturePos();
    setPending({ ...value });
    setPicking(false);
    setHover("");
    setOpen(true);
  }

  function handleApply() {
    onChange(pending);
    setPicking(false);
  }

  function handleClear() {
    onChange(EMPTY_DATE_RANGE);
    setPending(EMPTY_DATE_RANGE);
    setPicking(false);
    setHover("");
  }

  function handlePreset(p: (typeof DATE_PRESETS)[0]) {
    setPending({ from: p.from(), to: p.to() });
    setPicking(false);
    setHover("");
  }

  function handleDayClick(d: string) {
    if (!picking) {
      setPending({ from: d, to: "" });
      setPicking(true);
      setHover(d);
    } else {
      const from = pending.from;
      setPending(d < from ? { from: d, to: from } : { from, to: d });
      setPicking(false);
      setHover("");
    }
  }

  const activePreset =
    DATE_PRESETS.find((p) => p.from() === pending.from && p.to() === pending.to)?.label ?? null;

  return (
    <div ref={ref} className="dv-col-filter">
      <button
        ref={btnRef}
        type="button"
        className={`dv-col-filter-btn${isDateRangeActive(value) ? " dv-col-filter-btn--active" : ""}`}
        onClick={openPicker}
      >
        <svg
          width="10"
          height="10"
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
        Date
      </button>

      {open && (
        <div className="dv-col-filter-dropdown" style={dropStyle}>
          <div className="dv-filter-date-layout">
            {/* Left: presets + actions */}
            <div className="dv-filter-date-presets">
              <div className="dv-filter-presets-list">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={`dv-filter-preset-btn${activePreset === p.label ? " dv-filter-preset-btn--active" : ""}`}
                    onClick={() => handlePreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="dv-filter-actions">
                <button type="button" className="dv-filter-apply-btn" onClick={handleApply}>
                  Apply
                </button>
                <button type="button" className="dv-filter-clear-btn" onClick={handleClear}>
                  Clear
                </button>
              </div>
            </div>

            {/* Right: single calendar with selects */}
            <div className="dv-filter-cals">
              <div className="dv-cal-header">
                <select
                  className="dv-cal-select"
                  value={calMonth}
                  onChange={(e) => setCalMonth(Number(e.target.value))}
                >
                  {CAL_MONTHS.map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  className="dv-cal-select"
                  value={calYear}
                  onChange={(e) => setCalYear(Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <MiniCalendar
                year={calYear}
                month={calMonth}
                pending={pending}
                picking={picking}
                hover={hover}
                minDate={minDate}
                maxDate={maxDate}
                onDayClick={handleDayClick}
                onDayHover={setHover}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TypeCheckFilter({
  label,
  types,
  selected,
  onChange,
}: {
  label: string;
  types: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <ColFilterWrap label={label} active={selected.length > 0}>
      <div className="dv-filter-checks">
        {types.map((t) => (
          <label key={t} className="dv-filter-check-label">
            <input
              type="checkbox"
              className="dv-filter-checkbox"
              checked={selected.includes(t)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, t] : selected.filter((x) => x !== t))
              }
            />
            {t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <button type="button" className="dv-filter-clear-link" onClick={() => onChange([])}>
          Clear
        </button>
      )}
    </ColFilterWrap>
  );
}

// ── Mining table ──────────────────────────────────────────────

function MiningTable({
  rewardKey,
  currency,
  fiatCode,
}: {
  rewardKey: RewardKey;
  currency: Currency;
  fiatCode: string;
}) {
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const entry = useMemo(() => loadCacheEntry(rewardKey), [rewardKey]);

  const rows = useMemo(() => {
    if (!entry?.records?.length) return [];
    return entry.records.map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        date: String(rec.createdAt ?? ""),
        poolReward: getField(rec, currency, "poolReward"),
        maintenance: getField(rec, currency, "maintenance"),
        reward: getField(rec, currency, "reward"),
      };
    });
  }, [entry, currency]);

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesDateRange(r.date, dateRange)),
    [rows, dateRange],
  );

  useEffect(() => setPage(0), [dateRange]);

  const pageRows = useMemo(
    () => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page],
  );

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, r) => ({
          poolReward: acc.poolReward + r.poolReward,
          maintenance: acc.maintenance + r.maintenance,
          reward: acc.reward + r.reward,
        }),
        { poolReward: 0, maintenance: 0, reward: 0 },
      ),
    [filteredRows],
  );

  if (!entry) {
    return (
      <div className="dv-empty">
        No cached data for this sheet. Export it first from the main panel.
      </div>
    );
  }

  return (
    <div className="dv-tables-wrap">
      <table className="dv-table dv-table-totals">
        <colgroup>
          <col className="dv-col-date" />
          <col className="dv-col-value" />
          <col className="dv-col-value" />
          <col className="dv-col-value" />
        </colgroup>
        <tbody>
          <tr>
            <td className="dv-totals-label">Total</td>
            <td>
              <span className="dv-total-cell-label">Pool Reward</span>
              <span className="dv-total-cell-value dv-cell-with-icon">
                {fmt(totals.poolReward, currency)}
                <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
              </span>
            </td>
            <td>
              <span className="dv-total-cell-label">Maintenance</span>
              <span className="dv-total-cell-value dv-cell-with-icon">
                {fmt(totals.maintenance, currency)}
                <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
              </span>
            </td>
            <td>
              <span className="dv-total-cell-label">Reward</span>
              <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                {fmt(totals.reward, currency)}
                <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="dv-table dv-table-data">
        <colgroup>
          <col className="dv-col-date" />
          <col className="dv-col-value" />
          <col className="dv-col-value" />
          <col className="dv-col-value" />
        </colgroup>
        <thead>
          <tr>
            <th>
              <DateRangeFilter value={dateRange} onChange={setDateRange} {...dateBounds} />
            </th>
            <th>Pool Reward</th>
            <th>Maintenance</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => (
            <tr key={i}>
              <td className="dv-td-date">{fmtDate(row.date)}</td>
              <td>
                <span className="dv-cell-with-icon">
                  {fmt(row.poolReward, currency)}
                  <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                </span>
              </td>
              <td>
                <span className="dv-cell-with-icon">
                  {fmt(row.maintenance, currency)}
                  <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                </span>
              </td>
              <td className="dv-td-accent">
                <span className="dv-cell-with-icon">
                  {fmt(row.reward, currency)}
                  <MiningCurrencyIcon currency={currency} fiatCode={fiatCode} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} total={filteredRows.length} onChange={setPage} />
    </div>
  );
}

// ── Simple table (bounties / referrals / ambassador / deposits / withdrawals) ──

type SimpleView = "NATIVE" | "USD" | "FIAT";

function SimpleTable({
  rewardKey,
  fiatCode,
  simpleView,
}: {
  rewardKey: RewardKey;
  fiatCode: string;
  simpleView: SimpleView;
}) {
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const entry = useMemo(() => loadCacheEntry(rewardKey), [rewardKey]);

  const rows = useMemo(() => {
    if (!entry?.records?.length) return [];
    return entry.records.map((r) => {
      const rec = r as Record<string, unknown>;
      const reward = Number(rec.reward ?? 0);
      const rewardInUSD = Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0);
      const rewardInFiat = Number(rec.rewardInFiat ?? 0);
      return {
        date: String(rec.createdAt ?? ""),
        currency: String(rec.currency ?? ""),
        reward: Number.isFinite(reward) ? reward : 0,
        rewardInUSD: Number.isFinite(rewardInUSD) ? rewardInUSD : 0,
        rewardInFiat: Number.isFinite(rewardInFiat) ? rewardInFiat : 0,
      };
    });
  }, [entry]);

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesDateRange(r.date, dateRange)),
    [rows, dateRange],
  );

  useEffect(() => setPage(0), [dateRange]);

  const pageRows = useMemo(
    () => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page],
  );

  // One totals row per distinct currency
  const currencyTotals = useMemo(() => {
    const map = new Map<string, { reward: number; rewardInUSD: number; rewardInFiat: number }>();
    for (const row of filteredRows) {
      const cur = map.get(row.currency) ?? { reward: 0, rewardInUSD: 0, rewardInFiat: 0 };
      map.set(row.currency, {
        reward: cur.reward + row.reward,
        rewardInUSD: cur.rewardInUSD + row.rewardInUSD,
        rewardInFiat: cur.rewardInFiat + row.rewardInFiat,
      });
    }
    return [...map.entries()];
  }, [filteredRows]);

  const grandTotal = useMemo(
    () =>
      currencyTotals.reduce(
        (acc, [, t]) => ({
          rewardInUSD: acc.rewardInUSD + t.rewardInUSD,
          rewardInFiat: acc.rewardInFiat + t.rewardInFiat,
        }),
        { rewardInUSD: 0, rewardInFiat: 0 },
      ),
    [currencyTotals],
  );

  if (!entry) {
    return (
      <div className="dv-empty">
        No cached data for this sheet. Export it first from the main panel.
      </div>
    );
  }

  const isNative = simpleView === "NATIVE";
  const rewardIcon = isNative ? null : simpleView === "USD" ? (
    <UsdIcon />
  ) : (
    <FiatIcon code={fiatCode} />
  );
  const isSingleCurrency = currencyTotals.length === 1;
  const valueLabel =
    rewardKey === "deposits" ? "Deposited" : rewardKey === "withdrawals" ? "Withdrawn" : "Reward";

  function rowValue(row: {
    reward: number;
    rewardInUSD: number;
    rewardInFiat: number;
    currency: string;
  }) {
    if (simpleView === "USD") return { v: row.rewardInUSD, c: "USD" };
    if (simpleView === "FIAT") return { v: row.rewardInFiat, c: "FIAT" };
    return { v: row.reward, c: row.currency };
  }

  return (
    <div className="dv-tables-wrap">
      {/* Totals — one row per currency */}
      <table className="dv-table dv-table-totals">
        <colgroup>
          <col className="dv-col-date" />
          <col className="dv-col-value" />
        </colgroup>
        <tbody>
          {currencyTotals.map(([currency, totals]) => {
            const { v, c } = rowValue({ ...totals, currency });
            return (
              <tr key={currency}>
                <td>
                  {isSingleCurrency ? (
                    <span className="dv-totals-label">Total</span>
                  ) : (
                    <span className="dv-totals-currency-cell">
                      <AnyCurrencyIcon currency={currency} />
                      <span className="dv-totals-currency-label">{currency}</span>
                    </span>
                  )}
                </td>
                <td>
                  <span className="dv-total-cell-label">{valueLabel}</span>
                  <span className="dv-total-cell-value dv-cell-with-icon">
                    {fmtAny(v, c)}
                    {isNative ? <AnyCurrencyIcon currency={currency} /> : rewardIcon}
                  </span>
                </td>
              </tr>
            );
          })}
          {!isSingleCurrency && !isNative && (
            <tr>
              <td className="dv-totals-label">Total</td>
              <td>
                <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                  {fmtAny(
                    simpleView === "USD" ? grandTotal.rewardInUSD : grandTotal.rewardInFiat,
                    simpleView,
                  )}
                  {rewardIcon}
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Data table */}
      <table className="dv-table dv-table-data">
        <colgroup>
          <col className="dv-col-date" />
          <col className="dv-col-value" />
        </colgroup>
        <thead>
          <tr>
            <th>
              <DateRangeFilter value={dateRange} onChange={setDateRange} {...dateBounds} />
            </th>
            <th>
              <span className="dv-cell-with-icon">
                {valueLabel} {rewardIcon}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => {
            const { v, c } = rowValue(row);
            return (
              <tr key={i}>
                <td className="dv-td-date">{fmtDate(row.date)}</td>
                <td className={isNative ? "dv-td-white" : ""}>
                  <span className="dv-cell-with-icon">
                    {fmtAny(v, c)}
                    {isNative ? <AnyCurrencyIcon currency={row.currency} /> : rewardIcon}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} total={filteredRows.length} onChange={setPage} />
    </div>
  );
}

// ── Simple Earn table ─────────────────────────────────────────

type EarnView = "NATIVE" | "USD" | "FIAT";

function SimpleEarnTable({
  rewardKey,
  fiatCode,
  earnView,
}: {
  rewardKey: RewardKey;
  fiatCode: string;
  earnView: EarnView;
}) {
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const entry = useMemo(() => loadCacheEntry(rewardKey), [rewardKey]);

  const rows = useMemo(() => {
    if (!entry?.records?.length) return [];
    return entry.records.map((r) => {
      const rec = r as Record<string, unknown>;
      const reward = Number(rec.reward ?? 0);
      const rewardInUSD = Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0);
      const rewardInFiat = Number(rec.rewardInFiat ?? 0);
      const apr = Number(rec.apr ?? 0);
      return {
        date: String(rec.createdAt ?? ""),
        asset: String(rec.asset ?? rec.currency ?? ""),
        currency: String(rec.currency ?? ""),
        apr: Number.isFinite(apr) ? apr : 0,
        reward: Number.isFinite(reward) ? reward : 0,
        rewardInUSD: Number.isFinite(rewardInUSD) ? rewardInUSD : 0,
        rewardInFiat: Number.isFinite(rewardInFiat) ? rewardInFiat : 0,
      };
    });
  }, [entry]);

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesDateRange(r.date, dateRange)),
    [rows, dateRange],
  );

  useEffect(() => setPage(0), [dateRange]);

  const pageRows = useMemo(
    () => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page],
  );

  const assetTotals = useMemo(() => {
    const map = new Map<
      string,
      { currency: string; reward: number; rewardInUSD: number; rewardInFiat: number }
    >();
    for (const row of filteredRows) {
      const cur = map.get(row.asset) ?? {
        currency: row.currency,
        reward: 0,
        rewardInUSD: 0,
        rewardInFiat: 0,
      };
      map.set(row.asset, {
        currency: row.currency,
        reward: cur.reward + row.reward,
        rewardInUSD: cur.rewardInUSD + row.rewardInUSD,
        rewardInFiat: cur.rewardInFiat + row.rewardInFiat,
      });
    }
    return [...map.entries()];
  }, [filteredRows]);

  const earnGrandTotal = useMemo(
    () =>
      assetTotals.reduce(
        (acc, [, t]) => ({
          reward: acc.reward + t.reward,
          rewardInUSD: acc.rewardInUSD + t.rewardInUSD,
          rewardInFiat: acc.rewardInFiat + t.rewardInFiat,
        }),
        { reward: 0, rewardInUSD: 0, rewardInFiat: 0 },
      ),
    [assetTotals],
  );

  const isEarnNative = earnView === "NATIVE";
  const isEarnUsd = earnView === "USD";
  const nativeCurrency = assetTotals[0]?.[1]?.currency ?? "";
  const earnTotalIcon = isEarnNative ? (
    <AnyCurrencyIcon currency={nativeCurrency} />
  ) : isEarnUsd ? (
    <UsdIcon />
  ) : (
    <FiatIcon code={fiatCode} />
  );

  function earnRowValue(row: {
    reward: number;
    rewardInUSD: number;
    rewardInFiat: number;
    currency: string;
  }) {
    if (earnView === "USD") return { v: row.rewardInUSD, c: "USD" };
    if (earnView === "FIAT") return { v: row.rewardInFiat, c: "FIAT" };
    return { v: row.reward, c: row.currency };
  }

  if (!entry) {
    return (
      <div className="dv-empty">
        No cached data for this sheet. Export it first from the main panel.
      </div>
    );
  }

  return (
    <div className="dv-tables-wrap">
      {/* Grand total */}
      <table className="dv-table dv-table-totals">
        <colgroup>
          <col className="dv-col-date" />
          <col className="dv-col-value" />
          <col style={{ width: "12%" }} />
          <col className="dv-col-value" />
        </colgroup>
        <tbody>
          <tr>
            <td className="dv-totals-label">Total</td>
            <td />
            <td />
            <td>
              <span className="dv-total-cell-label">Reward</span>
              <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                {isEarnNative
                  ? fmtAny(earnGrandTotal.reward, nativeCurrency)
                  : fmtAny(
                      isEarnUsd ? earnGrandTotal.rewardInUSD : earnGrandTotal.rewardInFiat,
                      isEarnUsd ? "USD" : "FIAT",
                    )}
                {earnTotalIcon}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Data table */}
      <table className="dv-table dv-table-data">
        <colgroup>
          <col className="dv-col-date" />
          <col className="dv-col-value" />
          <col style={{ width: "12%" }} />
          <col className="dv-col-value" />
        </colgroup>
        <thead>
          <tr>
            <th>
              <DateRangeFilter value={dateRange} onChange={setDateRange} {...dateBounds} />
            </th>
            <th>Asset</th>
            <th>APR</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => {
            const { v, c } = earnRowValue(row);
            const icon = isEarnNative ? (
              <AnyCurrencyIcon currency={row.currency} />
            ) : isEarnUsd ? (
              <UsdIcon />
            ) : (
              <FiatIcon code={fiatCode} />
            );
            return (
              <tr key={i}>
                <td className="dv-td-date">{fmtDate(row.date)}</td>
                <td>
                  <span className="dv-cell-with-icon">
                    <AnyCurrencyIcon currency={row.asset} />
                    {row.asset}
                  </span>
                </td>
                <td>{(row.apr * 100).toFixed(2)}%</td>
                <td className="dv-td-accent">
                  <span className="dv-cell-with-icon">
                    {fmtAny(v, c)}
                    {icon}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} total={filteredRows.length} onChange={setPage} />
    </div>
  );
}

// ── Transactions table ────────────────────────────────────────

type TxView = "GMT" | "USD" | "FIAT";

function TransactionsTable({
  rewardKey,
  fiatCode,
  txView,
}: {
  rewardKey: RewardKey;
  fiatCode: string;
  txView: TxView;
}) {
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const entry = useMemo(() => loadCacheEntry(rewardKey), [rewardKey]);

  const allRows = useMemo(() => {
    if (!entry?.records?.length) return [];
    return entry.records.map((r) => {
      const rec = r as Record<string, unknown>;
      const reward = Number(rec.reward ?? 0);
      const rewardInUSD = Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0);
      const rewardInFiat = Number(rec.rewardInFiat ?? 0);
      return {
        date: String(rec.createdAt ?? ""),
        txType: String(rec.txType ?? rec.fromType ?? ""),
        reward: Number.isFinite(reward) ? reward : 0,
        rewardInUSD: Number.isFinite(rewardInUSD) ? rewardInUSD : 0,
        rewardInFiat: Number.isFinite(rewardInFiat) ? rewardInFiat : 0,
      };
    });
  }, [entry]);

  const dateBounds = useMemo(() => getDateBounds(allRows), [allRows]);

  const types = useMemo(
    () => [...new Set(allRows.map((r) => r.txType))].filter(Boolean).sort(),
    [allRows],
  );

  const filteredRows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          matchesDateRange(r.date, dateRange) &&
          (selectedTypes.length === 0 || selectedTypes.includes(r.txType)),
      ),
    [allRows, dateRange, selectedTypes],
  );

  useEffect(() => setPage(0), [dateRange, selectedTypes]);

  const pageRows = useMemo(
    () => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page],
  );

  const rewardIcon =
    txView === "GMT" ? <GmtIcon /> : txView === "USD" ? <UsdIcon /> : <FiatIcon code={fiatCode} />;

  function rowValue(row: { reward: number; rewardInUSD: number; rewardInFiat: number }) {
    if (txView === "USD") return { v: row.rewardInUSD, c: "USD" };
    if (txView === "FIAT") return { v: row.rewardInFiat, c: "FIAT" };
    return { v: row.reward, c: "GMT" };
  }

  const total = useMemo(
    () =>
      filteredRows.reduce(
        (acc, r) => ({
          reward: acc.reward + r.reward,
          rewardInUSD: acc.rewardInUSD + r.rewardInUSD,
          rewardInFiat: acc.rewardInFiat + r.rewardInFiat,
        }),
        { reward: 0, rewardInUSD: 0, rewardInFiat: 0 },
      ),
    [filteredRows],
  );

  if (!entry) {
    return (
      <div className="dv-empty">
        No cached data for this sheet. Export it first from the main panel.
      </div>
    );
  }

  return (
    <div className="dv-tables-wrap">
      {/* Totals */}
      <table className="dv-table dv-table-totals">
        <colgroup>
          <col className="dv-col-date" />
          <col style={{ width: "36%" }} />
          <col className="dv-col-value" />
        </colgroup>
        <tbody>
          <tr>
            <td className="dv-totals-label">Total</td>
            <td />
            <td>
              <span className="dv-total-cell-label">Reward</span>
              <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                {fmtAny(rowValue(total).v, rowValue(total).c)}
                {rewardIcon}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Data table */}
      <table className="dv-table dv-table-data">
        <colgroup>
          <col className="dv-col-date" />
          <col style={{ width: "36%" }} />
          <col className="dv-col-value" />
        </colgroup>
        <thead>
          <tr>
            <th>
              <DateRangeFilter value={dateRange} onChange={setDateRange} {...dateBounds} />
            </th>
            <th>
              <TypeCheckFilter
                label="Type"
                types={types}
                selected={selectedTypes}
                onChange={setSelectedTypes}
              />
            </th>
            <th>
              <span className="dv-cell-with-icon">Reward {rewardIcon}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => {
            const { v, c } = rowValue(row);
            return (
              <tr key={i}>
                <td className="dv-td-date">{fmtDate(row.date)}</td>
                <td>{row.txType}</td>
                <td className="dv-td-accent">
                  <span className="dv-cell-with-icon">
                    {fmtAny(v, c)}
                    {rewardIcon}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} total={filteredRows.length} onChange={setPage} />
    </div>
  );
}

// ── Purchases / Upgrades table ────────────────────────────────

function PurchasesTable({ fiatCode, fiatView }: { fiatCode: string; fiatView: "USD" | "FIAT" }) {
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const purchasesEntry = useMemo(() => loadCacheEntry("purchases"), []);
  const upgradesEntry = useMemo(() => loadCacheEntry("upgrades"), []);

  function parseEntry(entry: ReturnType<typeof loadCacheEntry>) {
    if (!entry?.records?.length) return [];
    return entry.records.map((r) => {
      const rec = r as Record<string, unknown>;
      const valueUsd = Number(rec.valueUsd ?? 0);
      const valueFiat = Number(rec.valueFiat ?? 0);
      return {
        date: String(rec.createdAt ?? ""),
        type: String(rec.type ?? ""),
        currency: String(rec.currency ?? ""),
        valueUsd: Number.isFinite(valueUsd) ? valueUsd : 0,
        valueFiat: Number.isFinite(valueFiat) ? valueFiat : 0,
      };
    });
  }

  const rows = useMemo(
    () =>
      [...parseEntry(purchasesEntry), ...parseEntry(upgradesEntry)].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [purchasesEntry, upgradesEntry],
  );

  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);

  const types = useMemo(() => [...new Set(rows.map((r) => r.type))].filter(Boolean).sort(), [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          matchesDateRange(r.date, dateRange) &&
          (selectedTypes.length === 0 || selectedTypes.includes(r.type)),
      ),
    [rows, dateRange, selectedTypes],
  );

  useEffect(() => setPage(0), [dateRange, selectedTypes]);

  const pageRows = useMemo(
    () => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page],
  );

  const currencyTotals = useMemo(() => {
    const map = new Map<string, { valueUsd: number; valueFiat: number }>();
    for (const row of filteredRows) {
      const cur = map.get(row.currency) ?? { valueUsd: 0, valueFiat: 0 };
      map.set(row.currency, {
        valueUsd: cur.valueUsd + row.valueUsd,
        valueFiat: cur.valueFiat + row.valueFiat,
      });
    }
    return [...map.entries()];
  }, [filteredRows]);

  const grandTotal = useMemo(
    () =>
      currencyTotals.reduce(
        (acc, [, t]) => ({
          valueUsd: acc.valueUsd + t.valueUsd,
          valueFiat: acc.valueFiat + t.valueFiat,
        }),
        { valueUsd: 0, valueFiat: 0 },
      ),
    [currencyTotals],
  );

  const isUsd = fiatView === "USD";
  const fiatIcon = isUsd ? <UsdIcon /> : <FiatIcon code={fiatCode} />;

  if (!purchasesEntry && !upgradesEntry) {
    return (
      <div className="dv-empty">
        No cached data for this sheet. Export it first from the main panel.
      </div>
    );
  }

  return (
    <div className="dv-tables-wrap">
      {/* Totals per currency */}
      <table className="dv-table dv-table-totals">
        <colgroup>
          <col className="dv-col-date" />
          <col style={{ width: "36%" }} />
          <col className="dv-col-value" />
        </colgroup>
        <tbody>
          {currencyTotals.map(([currency, t]) => (
            <tr key={currency}>
              <td>
                <span className="dv-totals-currency-cell">
                  <AnyCurrencyIcon currency={currency} />
                  <span className="dv-totals-currency-label">{currency}</span>
                </span>
              </td>
              <td />
              <td>
                <span className="dv-total-cell-label">Bought</span>
                <span className="dv-total-cell-value dv-cell-with-icon">
                  {fmtAny(isUsd ? t.valueUsd : t.valueFiat, isUsd ? "USD" : "FIAT")}
                  {fiatIcon}
                </span>
              </td>
            </tr>
          ))}
          {currencyTotals.length > 1 && (
            <tr>
              <td className="dv-totals-label">Total</td>
              <td />
              <td>
                <span className="dv-total-cell-value dv-total-cell-value--accent dv-cell-with-icon">
                  {fmtAny(
                    isUsd ? grandTotal.valueUsd : grandTotal.valueFiat,
                    isUsd ? "USD" : "FIAT",
                  )}
                  {fiatIcon}
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Data table */}
      <table className="dv-table dv-table-data">
        <colgroup>
          <col className="dv-col-date" />
          <col style={{ width: "36%" }} />
          <col className="dv-col-value" />
        </colgroup>
        <thead>
          <tr>
            <th>
              <DateRangeFilter value={dateRange} onChange={setDateRange} {...dateBounds} />
            </th>
            <th>
              <TypeCheckFilter
                label="Type"
                types={types}
                selected={selectedTypes}
                onChange={setSelectedTypes}
              />
            </th>
            <th>
              <span className="dv-cell-with-icon">Bought {fiatIcon}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => (
            <tr key={i}>
              <td className="dv-td-date">{fmtDate(row.date)}</td>
              <td>{row.type}</td>
              <td className="dv-td-accent">
                <span className="dv-cell-with-icon">
                  {fmtAny(isUsd ? row.valueUsd : row.valueFiat, isUsd ? "USD" : "FIAT")}
                  {fiatIcon}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} total={filteredRows.length} onChange={setPage} />
    </div>
  );
}

// ── Page component ────────────────────────────────────────────

interface DataViewerProps {
  onClose: () => void;
}

export const DataViewer = memo(function DataViewer({ onClose }: DataViewerProps) {
  const [activeKey, setActiveKey] = useState<RewardKey>("solo-mining");
  const [currency, setCurrency] = useState<Currency>("BTC");
  const [fiatView, setFiatView] = useState<"USD" | "FIAT">("USD");
  const [earnView, setEarnView] = useState<EarnView>("NATIVE");
  const [txView, setTxView] = useState<TxView>("GMT");
  const [simpleView, setSimpleView] = useState<SimpleView>("NATIVE");
  const fiatCode = useMemo(() => loadFiatCode(), []);

  const activeTab = ALL_TABS.find((t) => t.key === activeKey)!;
  const isMiningTab = activeTab.kind === "mining";
  const isEarnTab = activeTab.kind === "earn";
  const isTxTab = activeTab.kind === "tx";
  const isPurchaseTab = activeTab.kind === "purchase";
  const isSimpleTab = !isMiningTab && !isEarnTab && !isTxTab && !isPurchaseTab;

  const simpleDataInfo = useMemo(() => {
    if (!isSimpleTab) return { currencies: [] as string[], hasUsd: false, hasFiat: false };
    const entry = loadCacheEntry(activeKey);
    if (!entry?.records?.length)
      return { currencies: [] as string[], hasUsd: false, hasFiat: false };
    const set = new Set<string>();
    let hasUsd = false;
    let hasFiat = false;
    for (const r of entry.records) {
      const rec = r as Record<string, unknown>;
      const cur = String(rec.currency ?? "");
      if (cur) set.add(cur);
      if (Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0) !== 0) hasUsd = true;
      if (Number(rec.rewardInFiat ?? 0) !== 0) hasFiat = true;
    }
    return { currencies: [...set], hasUsd, hasFiat };
  }, [activeKey, isSimpleTab]);

  const txDataInfo = useMemo(() => {
    if (!isTxTab) return { hasUsd: false, hasFiat: false };
    const entry = loadCacheEntry(activeKey);
    if (!entry?.records?.length) return { hasUsd: false, hasFiat: false };
    let hasUsd = false;
    let hasFiat = false;
    for (const r of entry.records) {
      const rec = r as Record<string, unknown>;
      if (Number(rec.rewardInUSD ?? rec.rewardInUsd ?? 0) !== 0) hasUsd = true;
      if (Number(rec.rewardInFiat ?? 0) !== 0) hasFiat = true;
    }
    return { hasUsd, hasFiat };
  }, [activeKey, isTxTab]);

  useEffect(() => {
    if (isSimpleTab) setSimpleView("NATIVE");
  }, [activeKey, isSimpleTab]);

  useEffect(() => {
    if (isTxTab) setTxView("GMT");
  }, [activeKey, isTxTab]);

  const currencies: { key: Currency; label: string }[] = [
    { key: "BTC", label: "BTC" },
    { key: "GMT", label: "GMT" },
    { key: "USD", label: "USD" },
    { key: "FIAT", label: fiatCode },
  ];

  const earnViews: { key: EarnView; label: string }[] = [
    { key: "NATIVE", label: "BTC" },
    { key: "USD", label: "USD" },
    { key: "FIAT", label: fiatCode },
  ];

  const txViews: { key: TxView; label: string }[] = [
    { key: "GMT", label: "GMT" },
    ...(txDataInfo.hasUsd ? [{ key: "USD" as TxView, label: "USD" }] : []),
    ...(txDataInfo.hasFiat ? [{ key: "FIAT" as TxView, label: fiatCode }] : []),
  ];
  const showTxSelector = txDataInfo.hasUsd || txDataInfo.hasFiat;

  const fiatViews: { key: "USD" | "FIAT"; label: string }[] = [
    { key: "USD", label: "USD" },
    { key: "FIAT", label: fiatCode },
  ];

  const {
    currencies: simpleCurrencies,
    hasUsd: simpleHasUsd,
    hasFiat: simpleHasFiat,
  } = simpleDataInfo;
  const nativeLabel = simpleCurrencies.length === 1 ? simpleCurrencies[0] : "Native";
  const simpleViews: { key: SimpleView; label: string }[] = [
    { key: "NATIVE", label: nativeLabel },
    ...(simpleHasUsd ? [{ key: "USD" as SimpleView, label: "USD" }] : []),
    ...(simpleHasFiat ? [{ key: "FIAT" as SimpleView, label: fiatCode }] : []),
  ];
  const showSimpleSelector = simpleHasUsd || simpleHasFiat;

  return (
    <div className="dv-page">
      {/* Header */}
      <div className="dv-header">
        <div className="dv-header-left">
          <button type="button" className="dv-back-btn" onClick={onClose} aria-label="Back">
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
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>
          <span className="dv-title">Records</span>
        </div>

        {/* Currency selector */}
        {isMiningTab ? (
          <div className="dv-currency-selector">
            {currencies.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`dv-currency-btn${currency === c.key ? " dv-currency-btn--active" : ""}`}
                onClick={() => setCurrency(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : isEarnTab ? (
          <div className="dv-currency-selector">
            {earnViews.map((v) => (
              <button
                key={v.key}
                type="button"
                className={`dv-currency-btn${earnView === v.key ? " dv-currency-btn--active" : ""}`}
                onClick={() => setEarnView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : isTxTab && showTxSelector ? (
          <div className="dv-currency-selector">
            {txViews.map((v) => (
              <button
                key={v.key}
                type="button"
                className={`dv-currency-btn${txView === v.key ? " dv-currency-btn--active" : ""}`}
                onClick={() => setTxView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : isPurchaseTab ? (
          <div className="dv-currency-selector">
            {fiatViews.map((v) => (
              <button
                key={v.key}
                type="button"
                className={`dv-currency-btn${fiatView === v.key ? " dv-currency-btn--active" : ""}`}
                onClick={() => setFiatView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : showSimpleSelector ? (
          <div className="dv-currency-selector">
            {simpleViews.map((v) => (
              <button
                key={v.key}
                type="button"
                className={`dv-currency-btn${simpleView === v.key ? " dv-currency-btn--active" : ""}`}
                onClick={() => setSimpleView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="dv-tabs">
        {ALL_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`dv-tab${activeKey === tab.key ? " dv-tab--active" : ""}`}
            onClick={() => setActiveKey(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="dv-content">
        {isMiningTab ? (
          <MiningTable
            key={activeKey}
            rewardKey={activeKey}
            currency={currency}
            fiatCode={fiatCode}
          />
        ) : isEarnTab ? (
          <SimpleEarnTable
            key={activeKey}
            rewardKey={activeKey}
            fiatCode={fiatCode}
            earnView={earnView}
          />
        ) : isTxTab ? (
          <TransactionsTable
            key={activeKey}
            rewardKey={activeKey}
            fiatCode={fiatCode}
            txView={txView}
          />
        ) : isPurchaseTab ? (
          <PurchasesTable key={activeKey} fiatCode={fiatCode} fiatView={fiatView} />
        ) : (
          <SimpleTable
            key={activeKey}
            rewardKey={activeKey}
            fiatCode={fiatCode}
            simpleView={simpleView}
          />
        )}
      </div>
    </div>
  );
});

// ── Trigger button ────────────────────────────────────────────

interface DataViewerButtonProps {
  active: boolean;
  onClick: () => void;
}

export const DataViewerButton = memo(function DataViewerButton({
  active,
  onClick,
}: DataViewerButtonProps) {
  return (
    <button
      type="button"
      className={`dv-trigger-btn${active ? " dv-trigger-btn--active" : ""}`}
      onClick={onClick}
      aria-label="View records"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
      <span>Records</span>
    </button>
  );
});
