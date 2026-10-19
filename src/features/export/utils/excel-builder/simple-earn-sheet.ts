import type { Workbook } from "exceljs";
import type { ExtraFiatCurrency, SimpleEarnEnrichedRecord } from "@/types/rewards";
import {
  FORMAT_BTC,
  FORMAT_DATE,
  autoFitColumns,
  getFiatFormats,
  getFiatHeaders,
  getFiatValues,
  styleHeader,
  styleTotal,
  subtotal,
} from "./helpers";

/** Simple Earn sheet with Asset and APR columns and a single TOTAL row on top. */
export function buildSimpleEarnSheet(
  workbook: Workbook,
  sheetName: string,
  records: SimpleEarnEnrichedRecord[],
  extraCurrency: ExtraFiatCurrency | null,
  includeUsd = true,
): void {
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = [
    "Date",
    "Asset",
    "APR",
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
      record.asset || "",
      record.apr ?? 0,
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
    let column = 1;
    worksheet.getCell(row, column++).numFmt = FORMAT_DATE;
    column++;
    worksheet.getCell(row, column++).numFmt = "0.00%";
    column++;
    worksheet.getCell(row, column++).numFmt = FORMAT_BTC;
    const rowFormats = getFiatFormats(extraCurrency, includeUsd);
    rowFormats.forEach((format) => {
      worksheet.getCell(row, column++).numFmt = format;
    });
  }

  worksheet.spliceRows(1, 0, new Array(COLUMN_COUNT).fill(""));
  const headerRow = 2;
  const dataFrom = 3;
  const dataTo = lastDataRow + 1;

  worksheet.getRow(headerRow).values = headers;
  styleHeader(worksheet, headerRow, COLUMN_COUNT);

  worksheet.getCell("A1").value = "TOTAL";
  worksheet.getCell("E1").value = subtotal("E", dataFrom, dataTo);
  worksheet.getCell("E1").numFmt = FORMAT_BTC;
  const fiatFormats = getFiatFormats(extraCurrency, includeUsd);
  fiatFormats.forEach((format, index) => {
    const columnLetter = String.fromCharCode(70 + index);
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
