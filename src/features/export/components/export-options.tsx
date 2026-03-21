import { memo } from "react";
import { TransactionFilter } from "./transaction-filter";
import { WalletPricingOptions } from "./wallet-pricing-options";
import { ExtraFiatOptions } from "./extra-fiat-options";
import type { ExtraFiatCurrency, RewardKey } from "../types";
import "./export-options.css";

interface ExportOptionsProps {
  selectedKeys: RewardKey[];
  walletSheetsSelected: boolean;
  selectedTxFromTypes: string[];
  onToggleTxType: (fromTypes: string[], checked: boolean) => void;
  includeWalletFiat: boolean;
  onToggleWalletFiat: (checked: boolean) => void;
  includeExcelFiat: boolean;
  onToggleExcelFiat: (checked: boolean) => void;
  excelFiatCurrency: ExtraFiatCurrency;
  onChangeFiatCurrency: (v: ExtraFiatCurrency) => void;
}

export const ExportOptions = memo(function ExportOptions({
  selectedKeys,
  walletSheetsSelected,
  selectedTxFromTypes,
  onToggleTxType,
  includeWalletFiat,
  onToggleWalletFiat,
  includeExcelFiat,
  onToggleExcelFiat,
  excelFiatCurrency,
  onChangeFiatCurrency,
}: ExportOptionsProps) {
  return (
    <>
      {selectedKeys.includes("transactions") && (
        <TransactionFilter
          selectedTxFromTypes={selectedTxFromTypes}
          onToggleTxType={onToggleTxType}
        />
      )}
      {walletSheetsSelected && (
        <WalletPricingOptions
          includeWalletFiat={includeWalletFiat}
          onToggle={onToggleWalletFiat}
        />
      )}
      <ExtraFiatOptions
        includeExcelFiat={includeExcelFiat}
        onToggle={onToggleExcelFiat}
        currency={excelFiatCurrency}
        onChangeCurrency={onChangeFiatCurrency}
      />
    </>
  );
});
