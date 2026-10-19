import type { Workbook } from "exceljs";
import type { ExtraFiatCurrency, MiningEnrichedRecord } from "@/types/rewards";
import {
  FORMAT_BTC,
  FORMAT_DATE,
  FORMAT_OTHER,
  autoFitColumns,
  getFiatFormats,
  getFiatHeaders,
  getFiatValues,
  styleHeader,
  styleTotal,
  subtotal,
} from "./helpers";

/**
 * Mining sheet with pool reward, maintenance and net reward columns plus a frozen TOTAL row on top.
 * Totals use SUBTOTAL so they follow the active autofilter.
 */
export function buildMiningSheet(
  workbook: Workbook,
  sheetName: string,
  records: MiningEnrichedRecord[],
  extraCurrency: ExtraFiatCurrency | null,
): void {
  const worksheet = workbook.addWorksheet(sheetName);
  const fiatHeaders = getFiatHeaders(extraCurrency);
  const headers = [
    "Date",
    "Power (TH)",
    "Pool Reward (BTC)",
    "Pool Reward (GMT)",
    ...fiatHeaders.map((header) => header.replace("Reward", "Pool Reward")),
    "Maintenance (BTC)",
    "Maintenance (GMT)",
    ...fiatHeaders.map((header) => header.replace("Reward", "Maintenance")),
    "Discount",
    "Reward (BTC)",
    "Reward (GMT)",
    ...fiatHeaders,
    "Reinvested to Power",
  ];
  const COLUMN_COUNT = headers.length;

  worksheet.addRow(headers);
  for (const record of records) {
    const date = new Date(record.createdAt);
    worksheet.addRow([
      Number.isNaN(date.getTime()) ? "" : date,
      record.totalPower ?? 0,
      record.poolReward ?? 0,
      record.poolRewardGMT ?? 0,
      ...getFiatValues(record.poolRewardUSD ?? 0, record.poolRewardFiat ?? 0, extraCurrency),
      record.maintenance ?? 0,
      record.maintenanceGMT ?? 0,
      ...getFiatValues(record.maintenanceUSD ?? 0, record.maintenanceFiat ?? 0, extraCurrency),
      record.discount ?? 0,
      record.reward ?? 0,
      record.rewardGMT ?? 0,
      ...getFiatValues(record.rewardInUSD ?? 0, record.rewardInFiat ?? 0, extraCurrency),
      record.reinvested ? "Yes" : "No",
    ]);
  }

  const lastDataRow = worksheet.rowCount;
  const fiatFormats = getFiatFormats(extraCurrency);

  for (let row = 2; row <= lastDataRow; row++) {
    let column = 1;
    worksheet.getCell(row, column++).numFmt = FORMAT_DATE;
    worksheet.getCell(row, column++).numFmt = FORMAT_OTHER;
    worksheet.getCell(row, column++).numFmt = FORMAT_BTC;
    worksheet.getCell(row, column++).numFmt = FORMAT_OTHER;
    fiatFormats.forEach((format) => {
      worksheet.getCell(row, column++).numFmt = format;
    });
    worksheet.getCell(row, column++).numFmt = FORMAT_BTC;
    worksheet.getCell(row, column++).numFmt = FORMAT_OTHER;
    fiatFormats.forEach((format) => {
      worksheet.getCell(row, column++).numFmt = format;
    });
    worksheet.getCell(row, column++).numFmt = "0.00%";
    worksheet.getCell(row, column++).numFmt = FORMAT_BTC;
    worksheet.getCell(row, column++).numFmt = FORMAT_OTHER;
    fiatFormats.forEach((format) => {
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
  let totalColumn = 2;
  totalColumn++;

  worksheet.getCell(1, totalColumn).value = subtotal(
    String.fromCharCode(64 + totalColumn),
    dataFrom,
    dataTo,
  );
  worksheet.getCell(1, totalColumn++).numFmt = FORMAT_BTC;
  worksheet.getCell(1, totalColumn).value = subtotal(
    String.fromCharCode(64 + totalColumn),
    dataFrom,
    dataTo,
  );
  worksheet.getCell(1, totalColumn++).numFmt = FORMAT_OTHER;
  fiatFormats.forEach((format) => {
    worksheet.getCell(1, totalColumn).value = subtotal(
      String.fromCharCode(64 + totalColumn),
      dataFrom,
      dataTo,
    );
    worksheet.getCell(1, totalColumn++).numFmt = format;
  });

  worksheet.getCell(1, totalColumn).value = subtotal(
    String.fromCharCode(64 + totalColumn),
    dataFrom,
    dataTo,
  );
  worksheet.getCell(1, totalColumn++).numFmt = FORMAT_BTC;
  worksheet.getCell(1, totalColumn).value = subtotal(
    String.fromCharCode(64 + totalColumn),
    dataFrom,
    dataTo,
  );
  worksheet.getCell(1, totalColumn++).numFmt = FORMAT_OTHER;
  fiatFormats.forEach((format) => {
    worksheet.getCell(1, totalColumn).value = subtotal(
      String.fromCharCode(64 + totalColumn),
      dataFrom,
      dataTo,
    );
    worksheet.getCell(1, totalColumn++).numFmt = format;
  });

  totalColumn++;

  worksheet.getCell(1, totalColumn).value = subtotal(
    String.fromCharCode(64 + totalColumn),
    dataFrom,
    dataTo,
  );
  worksheet.getCell(1, totalColumn++).numFmt = FORMAT_BTC;
  worksheet.getCell(1, totalColumn).value = subtotal(
    String.fromCharCode(64 + totalColumn),
    dataFrom,
    dataTo,
  );
  worksheet.getCell(1, totalColumn++).numFmt = FORMAT_OTHER;
  fiatFormats.forEach((format) => {
    worksheet.getCell(1, totalColumn).value = subtotal(
      String.fromCharCode(64 + totalColumn),
      dataFrom,
      dataTo,
    );
    worksheet.getCell(1, totalColumn++).numFmt = format;
  });
  styleTotal(worksheet, 1, COLUMN_COUNT);

  worksheet.views = [{ state: "frozen", ySplit: 2, showGridLines: true }];
  worksheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: dataTo, column: COLUMN_COUNT },
  };
  autoFitColumns(worksheet);
}
