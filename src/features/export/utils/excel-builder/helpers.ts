import ExcelJS from "exceljs";
import type { Worksheet } from "exceljs";
import type { ExtraFiatCurrency } from "../../types";

export const FMT_DATE = "dd/mm/yyyy hh:mm:ss";
export const FMT_BTC = "0.00000000";
export const FMT_OTHER = "[<=0.009]0.000;0.00";
export const FMT_USD = "[<=0.009]$#,##0.000;$#,##0.00";
const FMT_EUR = "[<=0.009]€#,##0.000;€#,##0.00";

export const PURPLE_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF7A4DF6" },
};
export const BOLD_WHITE: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };
export const CENTER: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };

const CURRENCY_FMT: Record<string, string> = {
  EUR: FMT_EUR,
  GBP: '"£"#,##0.00',
  JPY: '"¥"#,##0',
  CNY: '"¥"#,##0.00',
  BRL: '"R$"#,##0.00',
  CHF: '"CHF"#,##0.00',
  ILS: '"₪"#,##0.00',
  INR: '"₹"#,##0.00',
  KRW: '"₩"#,##0',
  RUB: '"₽"#,##0.00',
  THB: '"฿"#,##0.00',
  UAH: '"₴"#,##0.00',
  PHP: '"₱"#,##0.00',
  NGN: '"₦"#,##0.00',
  GEL: '"₾"#,##0.00',
  KZT: '"₸"#,##0.00',
  MNT: '"₮"#,##0',
  GHS: '"₵"#,##0.00',
  LAK: '"₭"#,##0',
  VND: '"₫"#,##0',
  AZN: '"₼"#,##0.00',
  CRC: '"₡"#,##0.00',
  AMD: '"֏"#,##0.00',
  BDT: '"৳"#,##0.00',
  KHR: '"៛"#,##0',
  ALL: '"L"#,##0.00',
  BAM: '"KM"#,##0.00',
  BGN: '"лв"#,##0.00',
  CZK: '#,##0.00"Kč"',
  DKK: '"kr"#,##0.00',
  HUF: '#,##0"Ft"',
  ISK: '"kr"#,##0',
  MKD: '"ден"#,##0.00',
  NOK: '"kr"#,##0.00',
  PLN: '#,##0.00"zł"',
  RON: '#,##0.00"lei"',
  RSD: '#,##0.00"din"',
  SEK: '"kr"#,##0.00',
  ARS: '"$"#,##0.00',
  BBD: '"Bds$"#,##0.00',
  BMD: '"$"#,##0.00',
  BSD: '"B$"#,##0.00',
  BZD: '"BZ$"#,##0.00',
  CAD: '"C$"#,##0.00',
  CLP: '"$"#,##0',
  COP: '"$"#,##0.00',
  DOP: '"RD$"#,##0.00',
  GIP: '"£"#,##0.00',
  GYD: '"$"#,##0.00',
  HNL: '"L"#,##0.00',
  HTG: '"G"#,##0.00',
  JMD: '"J$"#,##0.00',
  KYD: '"CI$"#,##0.00',
  MXN: '"$"#,##0.00',
  PEN: '"S/"#,##0.00',
  PYG: '"Gs"#,##0',
  SRD: '"$"#,##0.00',
  TTD: '"TT$"#,##0.00',
  UYU: '"$"#,##0.00',
  XCD: '"EC$"#,##0.00',
  AED: '"AED"#,##0.00',
  BHD: '"BD"#,##0.000',
  JOD: '"JD"#,##0.000',
  KWD: '"KD"#,##0.000',
  OMR: '"OMR"#,##0.000',
  QAR: '"QAR"#,##0.00',
  SAR: '"SAR"#,##0.00',
  AOA: '"Kz"#,##0.00',
  BWP: '"P"#,##0.00',
  CVE: '"Esc"#,##0.00',
  DJF: '"Fdj"#,##0',
  DZD: '"DZD"#,##0.00',
  EGP: '"E£"#,##0.00',
  ERN: '"Nfk"#,##0.00',
  ETB: '"Br"#,##0.00',
  GMD: '"D"#,##0.00',
  KES: '"KSh"#,##0.00',
  KMF: '"CF"#,##0',
  LRD: '"$"#,##0.00',
  LSL: '"L"#,##0.00',
  MAD: '"MAD"#,##0.00',
  MDL: '"L"#,##0.00',
  MGA: '"Ar"#,##0',
  MRU: '"UM"#,##0.00',
  MUR: '"Rs"#,##0.00',
  MWK: '"MK"#,##0.00',
  MZN: '"MT"#,##0.00',
  NAD: '"N$"#,##0.00',
  RWF: '"RF"#,##0',
  SCR: '"Rs"#,##0.00',
  SLE: '"Le"#,##0.00',
  STN: '"Db"#,##0.00',
  SZL: '"L"#,##0.00',
  TND: '"DT"#,##0.000',
  TZS: '"TSh"#,##0.00',
  UGX: '"USh"#,##0',
  XAF: '"FCFA"#,##0',
  XOF: '"CFA"#,##0',
  ZAR: '"R"#,##0.00',
  ZMW: '"ZK"#,##0.00',
  ANG: '"ƒ"#,##0.00',
  AUD: '"A$"#,##0.00',
  AWG: '"ƒ"#,##0.00',
  BND: '"B$"#,##0.00',
  BOB: '"Bs."#,##0.00',
  BTN: '"Nu"#,##0.00',
  FJD: '"FJ$"#,##0.00',
  GTQ: '"Q"#,##0.00',
  HKD: '"HK$"#,##0.00',
  IDR: '"Rp"#,##0',
  KGS: '"лв"#,##0.00',
  LKR: '"Rs"#,##0.00',
  MOP: '"P"#,##0.00',
  MRU2: '"UM"#,##0.00',
  MVR: '"Rf"#,##0.00',
  MYR: '"RM"#,##0.00',
  NPR: '"Rs"#,##0.00',
  NZD: '"NZ$"#,##0.00',
  PGK: '"K"#,##0.00',
  PKR: '"Rs"#,##0.00',
  SBD: '"SI$"#,##0.00',
  TJS: '"SM"#,##0.00',
  TMT: '"T"#,##0.00',
  TOP: '"T$"#,##0.00',
  TWD: '"NT$"#,##0.00',
  UZS: '"UZS"#,##0',
  VUV: '"VT"#,##0',
  WST: '"WS$"#,##0.00',
  XPF: '"CFP"#,##0',
};

export function getCurrencyFormat(currency: string): string {
  return CURRENCY_FMT[currency] ?? `"${currency} "#,##0.00`;
}

export function getFiatHeaders(
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): string[] {
  if (!includeUsd) return [];
  return extraCurrency ? ["Reward (USD)", `Reward (${extraCurrency})`] : ["Reward (USD)"];
}

export function getFiatFormats(
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): string[] {
  if (!includeUsd) return [];
  return extraCurrency ? [FMT_USD, getCurrencyFormat(extraCurrency)] : [FMT_USD];
}

export function getFiatValues(
  usdValue: number,
  fiatValue: number,
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): number[] {
  if (!includeUsd) return [];
  return extraCurrency ? [usdValue, fiatValue] : [usdValue];
}

export function autoFitColumns(ws: Worksheet): void {
  ws.columns.forEach((col) => {
    if (!col?.eachCell) return;
    let maxLen = 8;
    col.eachCell({ includeEmpty: false }, (cell) => {
      let len = 8;
      const val = cell.value;
      if (val instanceof Date) {
        len = 20;
      } else if (typeof val === "string") {
        len = val.length;
      } else if (typeof val === "number") {
        len = String(val).length + 4;
      } else if (val && typeof val === "object" && "formula" in val) {
        len = 14;
      } else if (val != null) {
        len = String(val).length;
      }
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 60);
  });
}

export function styleTotal(ws: Worksheet, rowNumber: number, colCount: number): void {
  const row = ws.getRow(rowNumber);
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).fill = PURPLE_FILL;
    row.getCell(c).font = BOLD_WHITE;
  }
}

export function styleHeader(ws: Worksheet, rowNumber: number, colCount: number): void {
  const row = ws.getRow(rowNumber);
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).fill = PURPLE_FILL;
    row.getCell(c).font = BOLD_WHITE;
    row.getCell(c).alignment = CENTER;
  }
}

export function subtotal(col: string, from: number, to: number): { formula: string } {
  return { formula: `SUBTOTAL(9,${col}$${from}:${col}$${to})` };
}
