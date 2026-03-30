import ExcelJS from "exceljs";
import type { Workbook, Worksheet } from "exceljs";
import { REWARD_CONFIG_MAP } from "../config/reward-configs";
import { WALLET_TX_KEYS } from "../config/wallet-types";
import type {
  ExtraFiatCurrency,
  FetchRewardsOptions,
  MiningEnrichedRecord,
  PurchaseEnrichedRecord,
  RewardSheetPayload,
  SheetType,
  SimpleEarnEnrichedRecord,
  StandardEnrichedRecord,
  WalletTxEnrichedRecord,
} from "../types";

// ── Format constants ──────────────────────────────────────────────

const FMT_DATE = "dd/mm/yyyy hh:mm:ss";
const FMT_BTC = "0.00000000";
const FMT_OTHER = "[<=0.009]0.000;0.00";
const FMT_USD = "[<=0.009]$#,##0.000;$#,##0.00";
const FMT_EUR = "[<=0.009]\u20ac#,##0.000;\u20ac#,##0.00";

// ── Style helpers ─────────────────────────────────────────────────

/** Sets each column's width to fit its widest cell content, capped at 60 characters. */
function autoFitColumns(ws: Worksheet): void {
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

const PURPLE_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF7A4DF6" },
};
const BOLD_WHITE: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };
const CENTER: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };

// Maps ISO 4217 currency code → Excel number format. Falls back to "CODE #,##0.00".
const CURRENCY_FMT: Record<string, string> = {
  EUR: FMT_EUR,
  GBP: '"\u00a3"#,##0.00', // £
  JPY: '"\u00a5"#,##0', // ¥ (no decimals)
  CNY: '"\u00a5"#,##0.00',
  BRL: '"R$"#,##0.00',
  CHF: '"CHF"#,##0.00',
  ILS: '"\u20aa"#,##0.00', // ₪
  INR: '"\u20b9"#,##0.00', // ₹
  KRW: '"\u20a9"#,##0', // ₩ (no decimals)
  RUB: '"\u20bd"#,##0.00', // ₽
  THB: '"\u0e3f"#,##0.00', // ฿
  UAH: '"\u20b4"#,##0.00', // ₴
  PHP: '"\u20b1"#,##0.00', // ₱
  NGN: '"\u20a6"#,##0.00', // ₦
  GEL: '"\u20be"#,##0.00', // ₾
  KZT: '"\u20b8"#,##0.00', // ₸
  MNT: '"\u20ae"#,##0', // ₮ (no decimals)
  GHS: '"\u20b5"#,##0.00', // ₵
  LAK: '"\u20ad"#,##0', // ₭ (no decimals)
  VND: '"\u20ab"#,##0', // ₫ (no decimals)
  AZN: '"\u20bc"#,##0.00', // ₼
  CRC: '"\u20a1"#,##0.00', // ₡
  AMD: '"\u058f"#,##0.00', // ֏
  BDT: '"\u09f3"#,##0.00', // ৳
  KHR: '"\u17db"#,##0', // ៛ (no decimals)
  ALL: '"L"#,##0.00',
  BAM: '"KM"#,##0.00',
  BGN: '"\u043b\u0432"#,##0.00',
  CZK: '#,##0.00"K\u010d"',
  DKK: '"kr"#,##0.00',
  HUF: '#,##0"Ft"',
  ISK: '"kr"#,##0',
  MKD: '"\u0434\u0435\u043d"#,##0.00',
  NOK: '"kr"#,##0.00',
  PLN: '#,##0.00"z\u0142"',
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
  GIP: '"\u00a3"#,##0.00',
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
  EGP: '"E\u00a3"#,##0.00',
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
  ANG: '"\u0192"#,##0.00',
  AUD: '"A$"#,##0.00',
  AWG: '"\u0192"#,##0.00',
  BND: '"B$"#,##0.00',
  BOB: '"Bs."#,##0.00',
  BTN: '"Nu"#,##0.00',
  FJD: '"FJ$"#,##0.00',
  GTQ: '"Q"#,##0.00',
  HKD: '"HK$"#,##0.00',
  IDR: '"Rp"#,##0',
  KGS: '"\u043b\u0432"#,##0.00',
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

/** Returns the Excel number-format string for the given ISO 4217 currency code. */
function getCurrencyFormat(currency: string): string {
  return CURRENCY_FMT[currency] ?? `"${currency} "#,##0.00`;
}

/** Returns the fiat column header strings for USD and/or the extra currency. */
function getFiatHeaders(extraCurrency: ExtraFiatCurrency | null, includeUsd = true): string[] {
  if (!includeUsd) return [];
  return extraCurrency ? ["Reward (USD)", `Reward (${extraCurrency})`] : ["Reward (USD)"];
}

/** Returns the Excel number-format strings for the fiat columns. */
function getFiatFormats(extraCurrency: ExtraFiatCurrency | null, includeUsd = true): string[] {
  if (!includeUsd) return [];
  return extraCurrency ? [FMT_USD, getCurrencyFormat(extraCurrency)] : [FMT_USD];
}

/** Returns the fiat cell values to append to a row based on the enabled currencies. */
function getFiatValues(
  usdValue: number,
  fiatValue: number,
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): number[] {
  if (!includeUsd) return [];
  return extraCurrency ? [usdValue, fiatValue] : [usdValue];
}

/** Applies the purple-fill / bold-white style to a totals row. */
function styleTotal(ws: Worksheet, rowNumber: number, colCount: number): void {
  const row = ws.getRow(rowNumber);
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).fill = PURPLE_FILL;
    row.getCell(c).font = BOLD_WHITE;
  }
}

/** Applies the purple-fill / bold-white / centered style to a header row. */
function styleHeader(ws: Worksheet, rowNumber: number, colCount: number): void {
  const row = ws.getRow(rowNumber);
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).fill = PURPLE_FILL;
    row.getCell(c).font = BOLD_WHITE;
    row.getCell(c).alignment = CENTER;
  }
}

/** Returns an ExcelJS formula object for SUBTOTAL(9, …) over the given column and row range. */
function subtotal(col: string, from: number, to: number): { formula: string } {
  return { formula: `SUBTOTAL(9,${col}$${from}:${col}$${to})` };
}

// Sheet builders

/** Adds a mining (Solo Mining / Miner Wars) worksheet with daily reward, maintenance and power columns. */
function buildMiningSheet(
  workbook: Workbook,
  sheetName: string,
  records: MiningEnrichedRecord[],
  extraCurrency: ExtraFiatCurrency | null,
): void {
  const ws = workbook.addWorksheet(sheetName);
  const fiatHeaders = getFiatHeaders(extraCurrency);
  const headers = [
    "Date",
    "Power (TH)",
    "Pool Reward (BTC)",
    "Pool Reward (GMT)",
    ...fiatHeaders.map((h) => h.replace("Reward", "Pool Reward")),
    "Maintenance (BTC)",
    "Maintenance (GMT)",
    ...fiatHeaders.map((h) => h.replace("Reward", "Maintenance")),
    "Discount",
    "Reward (BTC)",
    "Reward (GMT)",
    ...fiatHeaders,
    "Reinvested to Power",
  ];
  const COLS = headers.length;

  ws.addRow(headers);
  for (const r of records) {
    const date = new Date(r.createdAt);
    ws.addRow([
      Number.isNaN(date.getTime()) ? "" : date,
      r.totalPower ?? 0,
      r.poolReward ?? 0,
      r.poolRewardGMT ?? 0,
      ...getFiatValues(r.poolRewardUSD ?? 0, r.poolRewardFiat ?? 0, extraCurrency),
      r.maintenance ?? 0,
      r.maintenanceGMT ?? 0,
      ...getFiatValues(r.maintenanceUSD ?? 0, r.maintenanceFiat ?? 0, extraCurrency),
      r.discount ?? 0,
      r.reward ?? 0,
      r.rewardGMT ?? 0,
      ...getFiatValues(r.rewardInUSD ?? 0, r.rewardInFiat ?? 0, extraCurrency),
      r.reinvested ? "Yes" : "No",
    ]);
  }

  const lastDataRow = ws.rowCount;
  const fiatFormats = getFiatFormats(extraCurrency);

  for (let row = 2; row <= lastDataRow; row++) {
    let col = 1;
    ws.getCell(row, col++).numFmt = FMT_DATE;
    ws.getCell(row, col++).numFmt = FMT_OTHER; // Power (TH/s)
    ws.getCell(row, col++).numFmt = FMT_BTC;
    ws.getCell(row, col++).numFmt = FMT_OTHER;
    fiatFormats.forEach((fmt) => {
      ws.getCell(row, col++).numFmt = fmt;
    });
    ws.getCell(row, col++).numFmt = FMT_BTC;
    ws.getCell(row, col++).numFmt = FMT_OTHER;
    fiatFormats.forEach((fmt) => {
      ws.getCell(row, col++).numFmt = fmt;
    });
    ws.getCell(row, col++).numFmt = "0.00%"; // Discount
    ws.getCell(row, col++).numFmt = FMT_BTC;
    ws.getCell(row, col++).numFmt = FMT_OTHER;
    fiatFormats.forEach((fmt) => {
      ws.getCell(row, col++).numFmt = fmt;
    });
    // Reinvested to Power — text, no numFmt
  }

  ws.spliceRows(1, 0, new Array(COLS).fill(""));
  const headerRow = 2;
  const dataFrom = 3;
  const dataTo = lastDataRow + 1;

  ws.getRow(headerRow).values = headers;
  styleHeader(ws, headerRow, COLS);

  ws.getCell("A1").value = "TOTAL";
  let totalCol = 2;
  // Power (TH/s) — sum
  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_OTHER;
  // Pool Reward BTC, GMT, fiat
  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_BTC;
  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_OTHER;
  fiatFormats.forEach((fmt) => {
    ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
    ws.getCell(1, totalCol++).numFmt = fmt;
  });
  // Maintenance BTC, GMT, fiat
  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_BTC;
  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_OTHER;
  fiatFormats.forEach((fmt) => {
    ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
    ws.getCell(1, totalCol++).numFmt = fmt;
  });
  // Discount — average
  ws.getCell(1, totalCol).value = {
    formula: `AVERAGE(${String.fromCharCode(64 + totalCol)}$${dataFrom}:${String.fromCharCode(64 + totalCol)}$${dataTo})`,
  };
  ws.getCell(1, totalCol++).numFmt = "0.00%";
  // Reward BTC, GMT, fiat
  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_BTC;
  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_OTHER;
  fiatFormats.forEach((fmt) => {
    ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
    ws.getCell(1, totalCol++).numFmt = fmt;
  });
  styleTotal(ws, 1, COLS);

  ws.views = [{ state: "frozen", ySplit: 2, showGridLines: true }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: dataTo, column: COLS } };
  autoFitColumns(ws);
}

/** Adds a standard single-currency reward worksheet (date, currency, reward, optional fiat). */
function buildStandardSheet(
  workbook: Workbook,
  sheetName: string,
  records: Array<StandardEnrichedRecord | WalletTxEnrichedRecord>,
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): void {
  const ws = workbook.addWorksheet(sheetName);
  const headers = ["Date", "Currency", "Reward", ...getFiatHeaders(extraCurrency, includeUsd)];
  const COLS = headers.length;

  ws.addRow(headers);
  for (const r of records) {
    const date = new Date(r.createdAt);
    ws.addRow([
      Number.isNaN(date.getTime()) ? "" : date,
      r.currency || "",
      r.reward ?? 0,
      ...getFiatValues(r.rewardInUSD ?? 0, r.rewardInFiat ?? 0, extraCurrency, includeUsd),
    ]);
  }

  const lastDataRow = ws.rowCount;
  for (let row = 2; row <= lastDataRow; row++) {
    ws.getCell(`A${row}`).numFmt = FMT_DATE;
    const cur = ws.getCell(`B${row}`).value;
    ws.getCell(`C${row}`).numFmt = cur === "BTC" ? FMT_BTC : FMT_OTHER;
    const fmts = getFiatFormats(extraCurrency, includeUsd);
    fmts.forEach((fmt, i) => {
      ws.getCell(`${String.fromCharCode(68 + i)}${row}`).numFmt = fmt;
    });
  }

  ws.spliceRows(1, 0, new Array(COLS).fill(""));
  const headerRow = 2;
  const dataFrom = 3;
  const dataTo = lastDataRow + 1;

  ws.getRow(headerRow).values = headers;
  styleHeader(ws, headerRow, COLS);

  ws.getCell("A1").value = "TOTAL";
  ws.getCell("C1").value = subtotal("C", dataFrom, dataTo);
  ws.getCell("C1").numFmt = FMT_OTHER;
  const fiatFormats = getFiatFormats(extraCurrency, includeUsd);
  fiatFormats.forEach((fmt, i) => {
    const l = String.fromCharCode(68 + i);
    ws.getCell(`${l}1`).value = subtotal(l, dataFrom, dataTo);
    ws.getCell(`${l}1`).numFmt = fmt;
  });
  styleTotal(ws, 1, COLS);

  ws.views = [{ state: "frozen", ySplit: 2, showGridLines: true }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: dataTo, column: COLS } };
  autoFitColumns(ws);
}

/** Adds a multi-currency reward worksheet with one TOTAL row per distinct currency. */
function buildMultiCurrencySheet(
  workbook: Workbook,
  sheetName: string,
  records: Array<StandardEnrichedRecord | WalletTxEnrichedRecord>,
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): void {
  const ws = workbook.addWorksheet(sheetName);
  const headers = ["Date", "Currency", "Reward", ...getFiatHeaders(extraCurrency, includeUsd)];
  const COLS = headers.length;

  const currencies = [...new Set(records.map((r) => r.currency).filter(Boolean))].sort();

  ws.addRow(headers);
  for (const r of records) {
    const date = new Date(r.createdAt);
    ws.addRow([
      Number.isNaN(date.getTime()) ? "" : date,
      r.currency || "",
      r.reward ?? 0,
      ...getFiatValues(r.rewardInUSD ?? 0, r.rewardInFiat ?? 0, extraCurrency, includeUsd),
    ]);
  }

  const lastDataRow = ws.rowCount;
  for (let row = 2; row <= lastDataRow; row++) {
    ws.getCell(`A${row}`).numFmt = FMT_DATE;
    const cur = ws.getCell(`B${row}`).value;
    ws.getCell(`C${row}`).numFmt = cur === "BTC" ? FMT_BTC : FMT_OTHER;
    const fmts = getFiatFormats(extraCurrency, includeUsd);
    fmts.forEach((fmt, i) => {
      ws.getCell(`${String.fromCharCode(68 + i)}${row}`).numFmt = fmt;
    });
  }

  const totalRowCount = Math.max(currencies.length, 1);
  for (let i = 0; i < totalRowCount; i++) {
    ws.spliceRows(1 + i, 0, new Array(COLS).fill(""));
  }

  const headerRow = 1 + totalRowCount;
  const dataFrom = 2 + totalRowCount;
  const dataTo = lastDataRow + totalRowCount;

  ws.getRow(headerRow).values = headers;
  styleHeader(ws, headerRow, COLS);

  for (let idx = 0; idx < currencies.length; idx++) {
    const cur = currencies[idx];
    const rowNum = 1 + idx;
    const isBTC = cur === "BTC";

    ws.getCell(`A${rowNum}`).value = `TOTAL (${cur})`;
    ws.getCell(`C${rowNum}`).value = {
      formula:
        `SUMPRODUCT((B$${dataFrom}:B$${dataTo}="${cur}")` +
        `*(SUBTOTAL(109,OFFSET(C$${dataFrom},ROW(C$${dataFrom}:C$${dataTo})-ROW(C$${dataFrom}),0,1))))`,
    };
    ws.getCell(`C${rowNum}`).numFmt = isBTC ? FMT_BTC : FMT_OTHER;
    styleTotal(ws, rowNum, COLS);
  }

  const fiatFormats = getFiatFormats(extraCurrency, includeUsd);
  fiatFormats.forEach((fmt, i) => {
    const l = String.fromCharCode(68 + i);
    ws.getCell(`${l}1`).value = subtotal(l, dataFrom, dataTo);
    ws.getCell(`${l}1`).numFmt = fmt;

    if (currencies.length > 1) {
      ws.mergeCells(`${l}1:${l}${totalRowCount}`);
      for (let r = 1; r <= totalRowCount; r++) {
        ws.getCell(`${l}${r}`).fill = PURPLE_FILL;
        ws.getCell(`${l}${r}`).font = BOLD_WHITE;
      }
    }
  });

  ws.views = [{ state: "frozen", ySplit: headerRow, showGridLines: true }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: dataTo, column: COLS } };
  autoFitColumns(ws);
}

/** Adds a purchases/upgrades worksheet listing type, currency, amount and USD/fiat value. */
function buildPurchasesSheet(
  workbook: Workbook,
  sheetName: string,
  records: PurchaseEnrichedRecord[],
  extraCurrency: ExtraFiatCurrency | null,
): void {
  const ws = workbook.addWorksheet(sheetName);
  const headers = ["Date", "Type", "Currency", "Paid", "Value (USD)"];
  if (extraCurrency) headers.push(`Value (${extraCurrency})`);
  const COLS = headers.length;

  ws.addRow(headers);
  for (const r of records) {
    const date = new Date(r.createdAt);
    const row: Array<Date | string | number> = [
      Number.isNaN(date.getTime()) ? "" : date,
      r.type || "",
      r.currency || "",
      r.reward ?? r.valueFiat ?? 0,
      r.valueUsd ?? 0,
    ];
    if (extraCurrency) row.push(r.valueFiat ?? 0);
    ws.addRow(row);
  }

  const lastDataRow = ws.rowCount;
  for (let row = 2; row <= lastDataRow; row++) {
    ws.getCell(`A${row}`).numFmt = FMT_DATE;
    ws.getCell(row, 4).numFmt = FMT_OTHER;
    ws.getCell(row, 5).numFmt = FMT_USD;
    if (extraCurrency) ws.getCell(row, 6).numFmt = getCurrencyFormat(extraCurrency);
  }

  ws.spliceRows(1, 0, new Array(COLS).fill(""));
  const headerRow = 2;
  const dataFrom = 3;
  const dataTo = lastDataRow + 1;

  ws.getRow(headerRow).values = headers;
  styleHeader(ws, headerRow, COLS);

  ws.getCell("A1").value = "TOTAL";
  ws.getCell(1, 5).value = subtotal("E", dataFrom, dataTo);
  ws.getCell(1, 5).numFmt = FMT_USD;
  if (extraCurrency) {
    ws.getCell(1, 6).value = subtotal("F", dataFrom, dataTo);
    ws.getCell(1, 6).numFmt = getCurrencyFormat(extraCurrency);
  }
  styleTotal(ws, 1, COLS);

  ws.views = [{ state: "frozen", ySplit: 2, showGridLines: true }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: dataTo, column: COLS } };
  autoFitColumns(ws);
}

/** Adds a wallet-transactions worksheet with type, currency, reward and optional fiat columns. */
function buildTransactionsSheet(
  workbook: Workbook,
  sheetName: string,
  records: Array<WalletTxEnrichedRecord>,
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): void {
  const ws = workbook.addWorksheet(sheetName);
  const headers = [
    "Date",
    "Type",
    "Currency",
    "Reward",
    ...getFiatHeaders(extraCurrency, includeUsd),
  ];
  const COLS = headers.length;

  ws.addRow(headers);
  for (const r of records) {
    const date = new Date(r.createdAt);
    ws.addRow([
      Number.isNaN(date.getTime()) ? "" : date,
      r.txType || r.fromType || "",
      r.currency || "",
      r.reward ?? 0,
      ...getFiatValues(r.rewardInUSD ?? 0, r.rewardInFiat ?? 0, extraCurrency, includeUsd),
    ]);
  }

  const lastDataRow = ws.rowCount;
  for (let row = 2; row <= lastDataRow; row++) {
    ws.getCell(`A${row}`).numFmt = FMT_DATE;
    const cur = ws.getCell(`C${row}`).value;
    ws.getCell(`D${row}`).numFmt = cur === "BTC" ? FMT_BTC : FMT_OTHER;
    const fmts = getFiatFormats(extraCurrency, includeUsd);
    fmts.forEach((fmt, i) => {
      ws.getCell(`${String.fromCharCode(69 + i)}${row}`).numFmt = fmt;
    });
  }

  ws.spliceRows(1, 0, new Array(COLS).fill(""));
  const headerRow = 2;
  const dataFrom = 3;
  const dataTo = lastDataRow + 1;

  ws.getRow(headerRow).values = headers;
  styleHeader(ws, headerRow, COLS);

  ws.getCell("A1").value = "TOTAL";
  ws.getCell("D1").value = subtotal("D", dataFrom, dataTo);
  ws.getCell("D1").numFmt = FMT_OTHER;
  const fiatFormats = getFiatFormats(extraCurrency, includeUsd);
  fiatFormats.forEach((fmt, i) => {
    const l = String.fromCharCode(69 + i);
    ws.getCell(`${l}1`).value = subtotal(l, dataFrom, dataTo);
    ws.getCell(`${l}1`).numFmt = fmt;
  });
  styleTotal(ws, 1, COLS);

  ws.views = [{ state: "frozen", ySplit: 2, showGridLines: true }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: dataTo, column: COLS } };
  autoFitColumns(ws);
}

/** Adds a Simple Earn worksheet with asset, APR, reward and optional fiat columns. */
function buildSimpleEarnSheet(
  workbook: Workbook,
  sheetName: string,
  records: SimpleEarnEnrichedRecord[],
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): void {
  const ws = workbook.addWorksheet(sheetName);
  const headers = [
    "Date",
    "Asset",
    "APR",
    "Currency",
    "Reward",
    ...getFiatHeaders(extraCurrency, includeUsd),
  ];
  const COLS = headers.length;

  ws.addRow(headers);
  for (const r of records) {
    const date = new Date(r.createdAt);
    ws.addRow([
      Number.isNaN(date.getTime()) ? "" : date,
      r.asset || "",
      r.apr ?? 0,
      r.currency || "",
      r.reward ?? 0,
      ...getFiatValues(r.rewardInUSD ?? 0, r.rewardInFiat ?? 0, extraCurrency, includeUsd),
    ]);
  }

  const lastDataRow = ws.rowCount;
  for (let row = 2; row <= lastDataRow; row++) {
    let col = 1;
    ws.getCell(row, col++).numFmt = FMT_DATE; // A: Date
    col++; // B: Asset (text)
    ws.getCell(row, col++).numFmt = "0.00%"; // C: APR
    col++; // D: Currency (text)
    ws.getCell(row, col++).numFmt = FMT_BTC; // E: Reward (always BTC)
    const fmts = getFiatFormats(extraCurrency, includeUsd);
    fmts.forEach((fmt) => {
      ws.getCell(row, col++).numFmt = fmt;
    });
  }

  ws.spliceRows(1, 0, new Array(COLS).fill(""));
  const headerRow = 2;
  const dataFrom = 3;
  const dataTo = lastDataRow + 1;

  ws.getRow(headerRow).values = headers;
  styleHeader(ws, headerRow, COLS);

  ws.getCell("A1").value = "TOTAL";
  // E = Reward (col 5), fiat starts at F (col 6)
  ws.getCell("E1").value = subtotal("E", dataFrom, dataTo);
  ws.getCell("E1").numFmt = FMT_BTC;
  const fiatFormats = getFiatFormats(extraCurrency, includeUsd);
  fiatFormats.forEach((fmt, i) => {
    const l = String.fromCharCode(70 + i); // F, G, ...
    ws.getCell(`${l}1`).value = subtotal(l, dataFrom, dataTo);
    ws.getCell(`${l}1`).numFmt = fmt;
  });
  styleTotal(ws, 1, COLS);

  ws.views = [{ state: "frozen", ySplit: 2, showGridLines: true }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: dataTo, column: COLS } };
  autoFitColumns(ws);
}

// Main builder

/** Builds an Excel workbook from the supplied sheet payloads and returns its ArrayBuffer. */
export async function buildExcelFromSheets(
  sheets: RewardSheetPayload[],
  options: FetchRewardsOptions = {},
): Promise<ArrayBuffer> {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw new Error("No sheet data provided");
  }

  const workbook = new ExcelJS.Workbook();

  const includeWalletFiat = options?.walletTx?.includeFiat !== false;
  const includeExtraFiat = options?.excel?.includeFiat ?? true;
  const selectedExtraCurrency = options?.excel?.fiatCurrency;
  const extraFiatCurrency: ExtraFiatCurrency | null = includeExtraFiat
    ? (selectedExtraCurrency ?? "EUR")
    : null;
  let purchaseRecords: PurchaseEnrichedRecord[] | null = null;
  const purchaseKeys = new Set<string>();

  for (const sheet of sheets) {
    const config = REWARD_CONFIG_MAP[sheet.key];
    const sheetType: SheetType = sheet.sheetType ?? config?.sheetType ?? "standard";
    const records = Array.isArray(sheet.records) ? sheet.records : [];

    if (sheetType === "purchases") {
      const rows = records as PurchaseEnrichedRecord[];
      purchaseKeys.add(sheet.key);
      purchaseRecords = purchaseRecords ? [...purchaseRecords, ...rows] : [...rows];
      continue;
    }

    const includeUsd = WALLET_TX_KEYS.has(sheet.key) ? includeWalletFiat : true;
    const walletExtraCurrency = includeUsd ? extraFiatCurrency : null;

    switch (sheetType) {
      case "mining":
        buildMiningSheet(
          workbook,
          sheet.sheetName,
          records as MiningEnrichedRecord[],
          extraFiatCurrency,
        );
        break;
      case "multi-currency":
        buildMultiCurrencySheet(
          workbook,
          sheet.sheetName,
          records as Array<StandardEnrichedRecord | WalletTxEnrichedRecord>,
          walletExtraCurrency,
          includeUsd,
        );
        break;
      case "transactions":
        buildTransactionsSheet(
          workbook,
          sheet.sheetName,
          records as WalletTxEnrichedRecord[],
          walletExtraCurrency,
          includeUsd,
        );
        break;
      case "simple-earn":
        buildSimpleEarnSheet(
          workbook,
          sheet.sheetName,
          records as SimpleEarnEnrichedRecord[],
          extraFiatCurrency,
          includeUsd,
        );
        break;
      default:
        buildStandardSheet(
          workbook,
          sheet.sheetName,
          records as Array<StandardEnrichedRecord | WalletTxEnrichedRecord>,
          walletExtraCurrency,
          includeUsd,
        );
    }
  }

  if (purchaseRecords !== null) {
    purchaseRecords.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const purchaseSheetName =
      purchaseKeys.has("purchases") && purchaseKeys.has("upgrades")
        ? "Purchases & Upgrades"
        : purchaseKeys.has("purchases")
          ? "Purchases"
          : "Upgrades";
    buildPurchasesSheet(workbook, purchaseSheetName, purchaseRecords, extraFiatCurrency);
  }

  return workbook.xlsx.writeBuffer();
}
