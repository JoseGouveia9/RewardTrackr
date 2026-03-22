import { memo, useState } from "react";
import "./referral-banner.css";

export const ReferralBanner = memo(function ReferralBanner() {
  const [open, setOpen] = useState(false);

  return (
    <div className="referral-banner">
      <button className="referral-toggle" onClick={() => setOpen((v) => !v)}>
        <span>Don't have a GoMining account yet?</span>
        <span className={`referral-chevron ${open ? "referral-chevron--open" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="referral-body">
          <p className="referral-intro">Sign up with my referral code and get these bonuses:</p>
          <ul className="referral-perks">
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
            className="referral-cta"
            href="https://gomining.com/?ref=9GFJB2X"
            target="_blank"
            rel="noopener noreferrer"
          >
            Sign Up for GoMining
          </a>
          <p className="referral-code-note">
            Use code <strong>9GFJB2X</strong> on your profile and at checkout when buying your first
            miner
          </p>
        </div>
      )}
    </div>
  );
});
