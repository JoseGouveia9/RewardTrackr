import type { Workbook } from "exceljs";
import type {
  ExtraFiatCurrency,
  MiningEnrichedRecord,
  PurchaseEnrichedRecord,
  SimpleEarnEnrichedRecord,
  StandardEnrichedRecord,
  WalletTxEnrichedRecord,
} from "../../types";
import {
  FMT_BTC,
  FMT_DATE,
  FMT_OTHER,
  FMT_USD,
  autoFitColumns,
  getCurrencyFormat,
  getFiatFormats,
  getFiatHeaders,
  getFiatValues,
  styleHeader,
  styleTotal,
  subtotal,
  BOLD_WHITE,
  PURPLE_FILL,
} from "./helpers";

export function buildMiningSheet(
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
    ws.getCell(row, col++).numFmt = FMT_OTHER;
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
    ws.getCell(row, col++).numFmt = "0.00%";
    ws.getCell(row, col++).numFmt = FMT_BTC;
    ws.getCell(row, col++).numFmt = FMT_OTHER;
    fiatFormats.forEach((fmt) => {
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
  let totalCol = 2;
  totalCol++;

  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_BTC;
  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_OTHER;
  fiatFormats.forEach((fmt) => {
    ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
    ws.getCell(1, totalCol++).numFmt = fmt;
  });

  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_BTC;
  ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
  ws.getCell(1, totalCol++).numFmt = FMT_OTHER;
  fiatFormats.forEach((fmt) => {
    ws.getCell(1, totalCol).value = subtotal(String.fromCharCode(64 + totalCol), dataFrom, dataTo);
    ws.getCell(1, totalCol++).numFmt = fmt;
  });

  totalCol++;

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

export function buildStandardSheet(
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

export function buildMultiCurrencySheet(
  workbook: Workbook,
  sheetName: string,
  records: Array<StandardEnrichedRecord | WalletTxEnrichedRecord>,
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
  rewardHeader = "Reward",
): void {
  const ws = workbook.addWorksheet(sheetName);
  const headers = ["Date", "Currency", rewardHeader, ...getFiatHeaders(extraCurrency, includeUsd)];
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

export function buildPurchasesSheet(
  workbook: Workbook,
  sheetName: string,
  records: PurchaseEnrichedRecord[],
  extraCurrency: ExtraFiatCurrency | null,
): void {
  const ws = workbook.addWorksheet(sheetName);
  const headers = ["Date", "Type", "Currency", "Bought", "Value (USD)"];
  if (extraCurrency) headers.push(`Value (${extraCurrency})`);
  const COLS = headers.length;

  const currencies = [...new Set(records.map((r) => r.currency).filter(Boolean))].sort();

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
    const cur = ws.getCell(`C${row}`).value;
    ws.getCell(row, 4).numFmt = cur === "BTC" ? FMT_BTC : FMT_OTHER;
    ws.getCell(row, 5).numFmt = FMT_USD;
    if (extraCurrency) ws.getCell(row, 6).numFmt = getCurrencyFormat(extraCurrency);
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
    ws.getCell(`D${rowNum}`).value = {
      formula:
        `SUMPRODUCT((C$${dataFrom}:C$${dataTo}="${cur}")` +
        `*(SUBTOTAL(109,OFFSET(D$${dataFrom},ROW(D$${dataFrom}:D$${dataTo})-ROW(D$${dataFrom}),0,1))))`,
    };
    ws.getCell(`D${rowNum}`).numFmt = isBTC ? FMT_BTC : FMT_OTHER;
    styleTotal(ws, rowNum, COLS);
  }

  ws.getCell("E1").value = subtotal("E", dataFrom, dataTo);
  ws.getCell("E1").numFmt = FMT_USD;
  if (currencies.length > 1) {
    ws.mergeCells(`E1:E${totalRowCount}`);
    for (let r = 1; r <= totalRowCount; r++) {
      ws.getCell(`E${r}`).fill = PURPLE_FILL;
      ws.getCell(`E${r}`).font = BOLD_WHITE;
    }
  }

  if (extraCurrency) {
    ws.getCell("F1").value = subtotal("F", dataFrom, dataTo);
    ws.getCell("F1").numFmt = getCurrencyFormat(extraCurrency);
    if (currencies.length > 1) {
      ws.mergeCells(`F1:F${totalRowCount}`);
      for (let r = 1; r <= totalRowCount; r++) {
        ws.getCell(`F${r}`).fill = PURPLE_FILL;
        ws.getCell(`F${r}`).font = BOLD_WHITE;
      }
    }
  }

  ws.views = [{ state: "frozen", ySplit: headerRow, showGridLines: true }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: dataTo, column: COLS } };
  autoFitColumns(ws);
}

export function buildTransactionsSheet(
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

export function buildSimpleEarnSheet(
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
    ws.getCell(row, col++).numFmt = FMT_DATE;
    col++;
    ws.getCell(row, col++).numFmt = "0.00%";
    col++;
    ws.getCell(row, col++).numFmt = FMT_BTC;
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
  ws.getCell("E1").value = subtotal("E", dataFrom, dataTo);
  ws.getCell("E1").numFmt = FMT_BTC;
  const fiatFormats = getFiatFormats(extraCurrency, includeUsd);
  fiatFormats.forEach((fmt, i) => {
    const l = String.fromCharCode(70 + i);
    ws.getCell(`${l}1`).value = subtotal(l, dataFrom, dataTo);
    ws.getCell(`${l}1`).numFmt = fmt;
  });
  styleTotal(ws, 1, COLS);

  ws.views = [{ state: "frozen", ySplit: 2, showGridLines: true }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: dataTo, column: COLS } };
  autoFitColumns(ws);
}
