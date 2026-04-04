import { CURRENCY_COLORS } from "../../utils/constants";
import type { Currency } from "../../types";

// Renders the Bitcoin (BTC) circular logo SVG icon.
export function BtcIcon() {
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

// Renders the GoMining Token (GMT) circular logo SVG icon.
export function GmtIcon() {
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

// Renders a green circular USD ($) icon.
export function UsdIcon() {
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

// Returns the locale currency symbol for an ISO 4217 code, falling back to the first letter.
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

// Renders an indigo circular icon showing the locale currency symbol for the given ISO 4217 code.
export function FiatIcon({ code }: { code: string }) {
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

// Renders the Tether (USDT) circular logo SVG icon.
export function UsdtIcon() {
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

// Renders the TON circular logo SVG icon.
export function TonIcon() {
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

// Renders the Solana (SOL) circular logo SVG icon.
export function SolIcon() {
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

// Renders the Ethereum (ETH) circular logo SVG icon.
export function EthIcon() {
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

// Renders the BNB circular logo SVG icon.
export function BnbIcon() {
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

// Renders the appropriate icon for any currency: real logos for known coins, FiatIcon for ISO 4217, or a coloured letter badge.
export function AnyCurrencyIcon({ currency }: { currency: string }) {
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
    // not a valid fiat code
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

// Renders the currency icon for the mining-tab selector (BTC, GMT, USD, or the configured fiat).
export function MiningCurrencyIcon({
  currency,
  fiatCode,
}: {
  currency: Currency;
  fiatCode: string;
}) {
  if (currency === "BTC") return <BtcIcon />;
  if (currency === "GMT") return <GmtIcon />;
  if (currency === "USD") return <UsdIcon />;
  return <FiatIcon code={fiatCode} />;
}
