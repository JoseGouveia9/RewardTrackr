import type { Workbook } from "exceljs";
import type {
  ExtraFiatCurrency,
  StandardEnrichedRecord,
  WalletTransactionEnrichedRecord,
} from "@/types/rewards";
import {
  BOLD_WHITE,
  FORMAT_BTC,
  FORMAT_DATE,
  FORMAT_OTHER,
  PURPLE_FILL,
  autoFitColumns,
  getFiatFormats,
  getFiatHeaders,
  getFiatValues,
  styleHeader,
  styleTotal,
  subtotal,
} from "./helpers";

/** Single-currency reward sheet with one TOTAL row on top; totals use SUBTOTAL so filters apply. */
export function buildStandardSheet(
  workbook: Workbook,
  sheetName: string,
  records: Array<StandardEnrichedRecord | WalletTransactionEnrichedRecord>,
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): void {
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = ["Date", "Currency", "Reward", ...getFiatHeaders(extraCurrency, includeUsd)];
  const COLUMN_COUNT = headers.length;

  worksheet.addRow(headers);
  for (const record of records) {
    const date = new Date(record.createdAt);
    worksheet.addRow([
      Number.isNaN(date.getTime()) ? "" : date,
      record.currency || "",
      record.reward ?? 0,
      ...getFiatValues(
        record.rewardInUSD ?? 0,
        record.rewardInFiat ?? 0,
        extraCurrency,
        includeUsd,
      ),
    ]);
  }

  const lastDataRow = worksheet.rowCount;
  for (let row = 2; row <= lastDataRow; row++) {
    worksheet.getCell(`A${row}`).numFmt = FORMAT_DATE;
    const rowCurrency = worksheet.getCell(`B${row}`).value;
    worksheet.getCell(`C${row}`).numFmt = rowCurrency === "BTC" ? FORMAT_BTC : FORMAT_OTHER;
    const rowFormats = getFiatFormats(extraCurrency, includeUsd);
    rowFormats.forEach((format, index) => {
      worksheet.getCell(`${String.fromCharCode(68 + index)}${row}`).numFmt = format;
    });
  }

  worksheet.spliceRows(1, 0, new Array(COLUMN_COUNT).fill(""));
  const headerRow = 2;
  const dataFrom = 3;
  const dataTo = lastDataRow + 1;

  worksheet.getRow(headerRow).values = headers;
  styleHeader(worksheet, headerRow, COLUMN_COUNT);

  worksheet.getCell("A1").value = "TOTAL";
  worksheet.getCell("C1").value = subtotal("C", dataFrom, dataTo);
  worksheet.getCell("C1").numFmt = FORMAT_OTHER;
  const fiatFormats = getFiatFormats(extraCurrency, includeUsd);
  fiatFormats.forEach((format, index) => {
    const columnLetter = String.fromCharCode(68 + index);
    worksheet.getCell(`${columnLetter}1`).value = subtotal(columnLetter, dataFrom, dataTo);
    worksheet.getCell(`${columnLetter}1`).numFmt = format;
  });
  styleTotal(worksheet, 1, COLUMN_COUNT);

  worksheet.views = [{ state: "frozen", ySplit: 2, showGridLines: true }];
  worksheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: dataTo, column: COLUMN_COUNT },
  };
  autoFitColumns(worksheet);
}

/**
 * Like the standard sheet but adds one TOTAL row per currency (SUMPRODUCT over visible rows only).
 * Fiat totals are merged into a single cell spanning those rows.
 */
export function buildMultiCurrencySheet(
  workbook: Workbook,
  sheetName: string,
  records: Array<StandardEnrichedRecord | WalletTransactionEnrichedRecord>,
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
  rewardHeader = "Reward",
): void {
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = ["Date", "Currency", rewardHeader, ...getFiatHeaders(extraCurrency, includeUsd)];
  const COLUMN_COUNT = headers.length;

  const currencies = [...new Set(records.map((record) => record.currency).filter(Boolean))].sort();

  worksheet.addRow(headers);
  for (const record of records) {
    const date = new Date(record.createdAt);
    worksheet.addRow([
      Number.isNaN(date.getTime()) ? "" : date,
      record.currency || "",
      record.reward ?? 0,
      ...getFiatValues(
        record.rewardInUSD ?? 0,
        record.rewardInFiat ?? 0,
        extraCurrency,
        includeUsd,
      ),
    ]);
  }

  const lastDataRow = worksheet.rowCount;
  for (let row = 2; row <= lastDataRow; row++) {
    worksheet.getCell(`A${row}`).numFmt = FORMAT_DATE;
    const rowCurrency = worksheet.getCell(`B${row}`).value;
    worksheet.getCell(`C${row}`).numFmt = rowCurrency === "BTC" ? FORMAT_BTC : FORMAT_OTHER;
    const rowFormats = getFiatFormats(extraCurrency, includeUsd);
    rowFormats.forEach((format, index) => {
      worksheet.getCell(`${String.fromCharCode(68 + index)}${row}`).numFmt = format;
    });
  }

  const totalRowCount = Math.max(currencies.length, 1);
  for (let index = 0; index < totalRowCount; index++) {
    worksheet.spliceRows(1 + index, 0, new Array(COLUMN_COUNT).fill(""));
  }

  const headerRow = 1 + totalRowCount;
  const dataFrom = 2 + totalRowCount;
  const dataTo = lastDataRow + totalRowCount;

  worksheet.getRow(headerRow).values = headers;
  styleHeader(worksheet, headerRow, COLUMN_COUNT);

  for (let index = 0; index < currencies.length; index++) {
    const currency = currencies[index];
    const rowNumber = 1 + index;
    const isBTC = currency === "BTC";

    worksheet.getCell(`A${rowNumber}`).value = `TOTAL (${currency})`;
    worksheet.getCell(`C${rowNumber}`).value = {
      formula:
        `SUMPRODUCT((B$${dataFrom}:B$${dataTo}="${currency}")` +
        `*(SUBTOTAL(109,OFFSET(C$${dataFrom},ROW(C$${dataFrom}:C$${dataTo})-ROW(C$${dataFrom}),0,1))))`,
    };
    worksheet.getCell(`C${rowNumber}`).numFmt = isBTC ? FORMAT_BTC : FORMAT_OTHER;
    styleTotal(worksheet, rowNumber, COLUMN_COUNT);
  }

  const fiatFormats = getFiatFormats(extraCurrency, includeUsd);
  fiatFormats.forEach((format, index) => {
    const columnLetter = String.fromCharCode(68 + index);
    worksheet.getCell(`${columnLetter}1`).value = subtotal(columnLetter, dataFrom, dataTo);
    worksheet.getCell(`${columnLetter}1`).numFmt = format;

    if (currencies.length > 1) {
      worksheet.mergeCells(`${columnLetter}1:${columnLetter}${totalRowCount}`);
      for (let rowIndex = 1; rowIndex <= totalRowCount; rowIndex++) {
        worksheet.getCell(`${columnLetter}${rowIndex}`).fill = PURPLE_FILL;
        worksheet.getCell(`${columnLetter}${rowIndex}`).font = BOLD_WHITE;
      }
    }
  });

  worksheet.views = [{ state: "frozen", ySplit: headerRow, showGridLines: true }];
  worksheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: dataTo, column: COLUMN_COUNT },
  };
  autoFitColumns(worksheet);
}

/** Wallet transactions sheet; adds a Type column (txType, else fromType) before Currency. */
export function buildTransactionsSheet(
  workbook: Workbook,
  sheetName: string,
  records: Array<WalletTransactionEnrichedRecord>,
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): void {
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = [
    "Date",
    "Type",
    "Currency",
    "Reward",
    ...getFiatHeaders(extraCurrency, includeUsd),
  ];
  const COLUMN_COUNT = headers.length;

  worksheet.addRow(headers);
  for (const record of records) {
    const date = new Date(record.createdAt);
    worksheet.addRow([
      Number.isNaN(date.getTime()) ? "" : date,
      record.txType || record.fromType || "",
      record.currency || "",
      record.reward ?? 0,
      ...getFiatValues(
        record.rewardInUSD ?? 0,
        record.rewardInFiat ?? 0,
        extraCurrency,
        includeUsd,
      ),
    ]);
  }

  const lastDataRow = worksheet.rowCount;
  for (let row = 2; row <= lastDataRow; row++) {
    worksheet.getCell(`A${row}`).numFmt = FORMAT_DATE;
    const rowCurrency = worksheet.getCell(`C${row}`).value;
    worksheet.getCell(`D${row}`).numFmt = rowCurrency === "BTC" ? FORMAT_BTC : FORMAT_OTHER;
    const rowFormats = getFiatFormats(extraCurrency, includeUsd);
    rowFormats.forEach((format, index) => {
      worksheet.getCell(`${String.fromCharCode(69 + index)}${row}`).numFmt = format;
    });
  }

  worksheet.spliceRows(1, 0, new Array(COLUMN_COUNT).fill(""));
  const headerRow = 2;
  const dataFrom = 3;
  const dataTo = lastDataRow + 1;

  worksheet.getRow(headerRow).values = headers;
  styleHeader(worksheet, headerRow, COLUMN_COUNT);

  worksheet.getCell("A1").value = "TOTAL";
  worksheet.getCell("D1").value = subtotal("D", dataFrom, dataTo);
  worksheet.getCell("D1").numFmt = FORMAT_OTHER;
  const fiatFormats = getFiatFormats(extraCurrency, includeUsd);
  fiatFormats.forEach((format, index) => {
    const columnLetter = String.fromCharCode(69 + index);
    worksheet.getCell(`${columnLetter}1`).value = subtotal(columnLetter, dataFrom, dataTo);
    worksheet.getCell(`${columnLetter}1`).numFmt = format;
  });
  styleTotal(worksheet, 1, COLUMN_COUNT);

  worksheet.views = [{ state: "frozen", ySplit: 2, showGridLines: true }];
  worksheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: dataTo, column: COLUMN_COUNT },
  };
  autoFitColumns(worksheet);
}
