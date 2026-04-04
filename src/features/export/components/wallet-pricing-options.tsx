import { memo } from "react";

interface WalletPricingOptionsProps {
  includeWalletFiat: boolean;
  onToggle: (checked: boolean) => void;
}

// Renders the wallet-fiat pricing toggle and rate-limit warning for wallet-tx sheets.
export const WalletPricingOptions = memo(function WalletPricingOptions({
  includeWalletFiat,
  onToggle,
}: WalletPricingOptionsProps) {
  return (
    <div className="wallet-options">
      <p className="options-section-title">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="12" x2="12" y1="2" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        Wallet Pricing
      </p>
      <p className="subtle wallet-note">
        Applies only to Bounty, Deposits, Withdrawals and Transactions. GoMining API does not return
        fiat pricing for these sheets, so we enrich them using CoinGecko during export.
      </p>
      <label className="wallet-option-row">
        Include fiat pricing (USD). Extra fiat is configured below.
        <input
          type="checkbox"
          className="toggle-switch"
          checked={includeWalletFiat}
          onChange={(e) => onToggle(e.target.checked)}
        />
      </label>
      {includeWalletFiat && (
        <p className="wallet-warning">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="warning-icon"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          This can take some time. CoinGecko free plan has rate limits, and each limit hit triggers
          a 60s cooldown.
        </p>
      )}
    </div>
  );
});
