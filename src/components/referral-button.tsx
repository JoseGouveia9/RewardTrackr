import { memo, useEffect } from "react";
import "./referral-button.css";

interface ReferralButtonProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const ReferralButton = memo(function ReferralButton({
  open,
  onOpen,
  onClose,
}: ReferralButtonProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button type="button" className="referral-btn" onClick={onOpen}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="referral-btn-icon"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
        <span>No GoMining account?</span>
      </button>

      {open && (
        <div className="referral-overlay" onClick={onClose} aria-modal="true" role="dialog">
          <div className="referral-modal" onClick={(e) => e.stopPropagation()}>
            <div className="referral-modal-header">
              <span className="referral-modal-title">No GoMining account?</span>
              <button
                type="button"
                className="referral-modal-close"
                onClick={onClose}
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="referral-modal-intro">
              Sign up with my referral code and get these bonuses:
            </p>

            <ul className="referral-modal-perks">
              <li>
                <span className="referral-perk-title">
                  5% bonus in TH on your first miner purchase
                </span>
                <span className="referral-perk-condition">Within 30 days after registration</span>
              </li>
              <li>
                <span className="referral-perk-title">
                  $20 cashback in TH for the first $100 spent with the GoMining card
                </span>
                <span className="referral-perk-condition">Within 90 days after registration</span>
              </li>
              <li>
                <span className="referral-perk-title">30 days of Platinum+ for free</span>
                <span className="referral-perk-condition">Within 30 days after registration</span>
              </li>
            </ul>

            <a
              className="referral-modal-cta"
              href="https://gomining.com/?ref=9GFJB2X"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sign Up for GoMining
            </a>

            <p className="referral-modal-code">
              Use code <strong>9GFJB2X</strong> on your profile and at checkout when buying your
              first miner
            </p>
          </div>
        </div>
      )}
    </>
  );
});
