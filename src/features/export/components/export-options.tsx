import { memo } from "react";
import { TX_CHECKBOX_OPTIONS } from "../config/wallet-types";
import { FiatDropdown } from "./fiat-dropdown";
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
        <div className="wallet-options">
          <p className="wallet-options-title">Transactions Filter</p>
          {TX_CHECKBOX_OPTIONS.map((opt) => {
            const checked = opt.fromTypes.every((ft) => selectedTxFromTypes.includes(ft));
            return (
              <label key={opt.label} className="wallet-option-row">
                <input
                  type="checkbox"
                  className="toggle-switch"
                  checked={checked}
                  onChange={(e) => onToggleTxType(opt.fromTypes, e.target.checked)}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      )}

      {walletSheetsSelected && (
        <div className="wallet-options">
          <p className="wallet-options-title">Wallet Pricing</p>
          <p className="subtle wallet-note">
            Applies only to Bounty, Deposits, Withdrawals and Transactions. GoMining API does not
            return fiat pricing for these sheets, so we enrich them using CoinGecko during export.
          </p>
          <label className="wallet-option-row">
            <input
              type="checkbox"
              className="toggle-switch"
              checked={includeWalletFiat}
              onChange={(e) => onToggleWalletFiat(e.target.checked)}
            />
            Include fiat pricing (USD). Extra fiat is configured below.
          </label>
          {includeWalletFiat && (
            <p className="wallet-warning">
              Warning: this can take some time. CoinGecko free plan has rate limits, and each limit
              hit triggers a 60s cooldown.
            </p>
          )}
        </div>
      )}

      <div className="excel-options">
        <p className="wallet-options-title">Extra Fiat Conversion</p>
        <label className="wallet-option-row">
          <input
            type="checkbox"
            className="toggle-switch"
            checked={includeExcelFiat}
            onChange={(e) => onToggleExcelFiat(e.target.checked)}
          />
          Include extra conversion column (USD is always included)
        </label>
        {includeExcelFiat && (
          <label className="wallet-option-row wallet-currency-row">
            Currency
            <FiatDropdown value={excelFiatCurrency} onChange={onChangeFiatCurrency} />
          </label>
        )}
      </div>
    </>
  );
});
