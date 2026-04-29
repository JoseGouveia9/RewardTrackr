import { useNavigate } from "react-router";
import "./legal-page.css";

export function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <button type="button" className="legal-back" onClick={() => void navigate("/")}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </button>

      <div className="legal-header">
        <h1 className="legal-title">About RewardTrackr</h1>
        <p className="legal-meta">An unofficial GoMining companion tool</p>
      </div>

      <div className="legal-divider" />

      <div className="legal-body">
        <div className="legal-section">
          <h2 className="legal-section-title">What is RewardTrackr?</h2>
          <p>
            RewardTrackr is a free, source-available browser tool that lets GoMining users export
            and analyse their reward history. It connects directly to the GoMining API using your
            personal access token stored temporarily in your browser session (sessionStorage), and
            organises your data into a structured Excel spreadsheet you can download and keep.
          </p>
          <p>
            RewardTrackr does not use its own backend to process or store your reward data. Your
            reward records remain in your browser unless you explicitly export or share them.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Features</h2>
          <ul>
            <li>
              Export Solo Mining, MinerWars, Bounties, Simple Earn, Referrals, Ambassador, Deposits,
              Withdrawals, and Transactions
            </li>
            <li>Incremental sync: only fetches new records since your last export</li>
            <li>BTC price enrichment via CoinGecko for historical USD/EUR values</li>
            <li>Extra fiat currency columns (EUR, GBP, and more)</li>
            <li>Shareable read-only record snapshots</li>
            <li>Light and dark theme, multi-language support</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Source Availability</h2>
          <p>
            RewardTrackr is source-available software. The source code is publicly accessible for
            transparency, security review, and personal use.
          </p>
          <p>
            You may clone and inspect the code for personal or educational purposes, but you may not
            redistribute, modify, or publish it as a competing product or service.
          </p>
          <p>
            <a
              href="https://github.com/JoseGouveia9/RewardTrackr"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/JoseGouveia9/RewardTrackr
            </a>
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Author</h2>
          <p>
            Built and maintained by José Gouveia (Moustachio). RewardTrackr is not affiliated with,
            endorsed by, or officially connected to GoMining or any of its related entities.
          </p>
        </div>
      </div>
    </div>
  );
}
