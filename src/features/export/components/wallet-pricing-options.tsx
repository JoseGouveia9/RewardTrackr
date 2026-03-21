import { memo } from "react";

interface WalletPricingOptionsProps {
  includeWalletFiat: boolean;
  onToggle: (checked: boolean) => void;
}

export const WalletPricingOptions = memo(function WalletPricingOptions({
  includeWalletFiat,
  onToggle,
}: WalletPricingOptionsProps) {
  return (
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
          onChange={(e) => onToggle(e.target.checked)}
        />
        Include fiat pricing (USD). Extra fiat is configured below.
      </label>
      {includeWalletFiat && (
        <p className="wallet-warning">
          Warning: this can take some time. CoinGecko free plan has rate limits, and each limit hit
          triggers a 60s cooldown.
        </p>
      )}
    </div>
  );
});
