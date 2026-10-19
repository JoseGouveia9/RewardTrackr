import ExcelJS from "exceljs";
import { REWARD_CONFIG_MAP } from "@/config/reward-configs";
import { WALLET_TRANSACTION_KEYS } from "@/config/wallet-types";
import type {
  ExtraFiatCurrency,
  FetchRewardsOptions,
  MiningEnrichedRecord,
  PurchaseEnrichedRecord,
  RewardSheetPayload,
  SheetType,
  SimpleEarnEnrichedRecord,
  StandardEnrichedRecord,
  WalletTransactionEnrichedRecord,
} from "@/types/rewards";
import { buildMiningSheet } from "./mining-sheet";
import { buildPurchasesSheet } from "./purchases-sheet";
import {
  buildMultiCurrencySheet,
  buildStandardSheet,
  buildTransactionsSheet,
} from "./reward-sheets";
import { buildSimpleEarnSheet } from "./simple-earn-sheet";

/**
 * Builds the workbook, one sheet per payload, choosing the builder from the sheet type.
 * Purchases and upgrades are merged into a single date-sorted sheet.
 */
export async function buildExcelFromSheets(
  sheets: RewardSheetPayload[],
  options: FetchRewardsOptions = {},
): Promise<ArrayBuffer> {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw new Error("No sheet data provided");
  }

  const workbook = new ExcelJS.Workbook();

  const includeWalletFiat = options?.walletTransaction?.includeFiat !== false;
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

    const includeUsd = WALLET_TRANSACTION_KEYS.has(sheet.key) ? includeWalletFiat : true;
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
      case "multi-currency": {
        const rewardHeader =
          sheet.sheetName === "Withdrawals"
            ? "Withdrawn"
            : sheet.sheetName === "Deposits"
              ? "Deposited"
              : "Reward";
        buildMultiCurrencySheet(
          workbook,
          sheet.sheetName,
          records as Array<StandardEnrichedRecord | WalletTransactionEnrichedRecord>,
          walletExtraCurrency,
          includeUsd,
          rewardHeader,
        );
        break;
      }
      case "transactions":
        buildTransactionsSheet(
          workbook,
          sheet.sheetName,
          records as WalletTransactionEnrichedRecord[],
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
          records as Array<StandardEnrichedRecord | WalletTransactionEnrichedRecord>,
          walletExtraCurrency,
          includeUsd,
        );
    }
  }

  if (purchaseRecords !== null) {
    purchaseRecords.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
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
