import type { Workbook } from "exceljs";
import type { ExtraFiatCurrency, PurchaseEnrichedRecord } from "@/types/rewards";
import {
  BOLD_WHITE,
  FORMAT_BTC,
  FORMAT_DATE,
  FORMAT_OTHER,
  FORMAT_USD,
  PURPLE_FILL,
  autoFitColumns,
  getCurrencyFormat,
  styleHeader,
  styleTotal,
  subtotal,
} from "./helpers";

/**
 * Purchases/upgrades sheet with per-currency totals above the header; totals respect the
 * autofilter.
 */
export function buildPurchasesSheet(
  workbook: Workbook,
  sheetName: string,
  records: PurchaseEnrichedRecord[],
  extraCurrency: ExtraFiatCurrency | null,
): void {
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = ["Date", "Type", "Currency", "Bought", "Value (USD)"];
  if (extraCurrency) headers.push(`Value (${extraCurrency})`);
  const COLUMN_COUNT = headers.length;

  const currencies = [...new Set(records.map((record) => record.currency).filter(Boolean))].sort();

  worksheet.addRow(headers);
  for (const record of records) {
    const date = new Date(record.createdAt);
    const row: Array<Date | string | number> = [
      Number.isNaN(date.getTime()) ? "" : date,
      record.type || "",
      record.currency || "",
      record.reward ?? record.valueFiat ?? 0,
      record.valueUsd ?? 0,
    ];
    if (extraCurrency) row.push(record.valueFiat ?? 0);
    worksheet.addRow(row);
  }

  const lastDataRow = worksheet.rowCount;
  for (let row = 2; row <= lastDataRow; row++) {
    worksheet.getCell(`A${row}`).numFmt = FORMAT_DATE;
    const rowCurrency = worksheet.getCell(`C${row}`).value;
    worksheet.getCell(row, 4).numFmt = rowCurrency === "BTC" ? FORMAT_BTC : FORMAT_OTHER;
    worksheet.getCell(row, 5).numFmt = FORMAT_USD;
    if (extraCurrency) worksheet.getCell(row, 6).numFmt = getCurrencyFormat(extraCurrency);
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
    worksheet.getCell(`D${rowNumber}`).value = {
      formula:
        `SUMPRODUCT((C$${dataFrom}:C$${dataTo}="${currency}")` +
        `*(SUBTOTAL(109,OFFSET(D$${dataFrom},ROW(D$${dataFrom}:D$${dataTo})-ROW(D$${dataFrom}),0,1))))`,
    };
    worksheet.getCell(`D${rowNumber}`).numFmt = isBTC ? FORMAT_BTC : FORMAT_OTHER;
    styleTotal(worksheet, rowNumber, COLUMN_COUNT);
  }

  worksheet.getCell("E1").value = subtotal("E", dataFrom, dataTo);
  worksheet.getCell("E1").numFmt = FORMAT_USD;
  if (currencies.length > 1) {
    worksheet.mergeCells(`E1:E${totalRowCount}`);
    for (let rowIndex = 1; rowIndex <= totalRowCount; rowIndex++) {
      worksheet.getCell(`E${rowIndex}`).fill = PURPLE_FILL;
      worksheet.getCell(`E${rowIndex}`).font = BOLD_WHITE;
    }
  }

  if (extraCurrency) {
    worksheet.getCell("F1").value = subtotal("F", dataFrom, dataTo);
    worksheet.getCell("F1").numFmt = getCurrencyFormat(extraCurrency);
    if (currencies.length > 1) {
      worksheet.mergeCells(`F1:F${totalRowCount}`);
      for (let rowIndex = 1; rowIndex <= totalRowCount; rowIndex++) {
        worksheet.getCell(`F${rowIndex}`).fill = PURPLE_FILL;
        worksheet.getCell(`F${rowIndex}`).font = BOLD_WHITE;
      }
    }
  }

  worksheet.views = [{ state: "frozen", ySplit: headerRow, showGridLines: true }];
  worksheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: dataTo, column: COLUMN_COUNT },
  };
  autoFitColumns(worksheet);
}
