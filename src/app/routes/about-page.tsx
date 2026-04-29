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
            RewardTrackr is a free, open-source browser tool that lets GoMining users export and
            analyse their reward history. It connects directly to the GoMining API using your
            personal access token stored temporarily in your browser session, and organises your
            data into a structured Excel spreadsheet you can download and keep.
          </p>
          <p>
            RewardTrackr does not operate its own backend or database. Data remains in your browser
            unless you explicitly export or share it.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Features</h2>
          <ul>
            <li>
              Export Solo Mining, MinerWars, Bounties, Simple Earn, Referrals, Ambassador, Deposits,
              Withdrawals, and Transactions
            </li>
            <li>Incremental sync — only fetches new records since your last export</li>
            <li>BTC price enrichment via CoinGecko for historical USD/EUR values</li>
            <li>Extra fiat currency columns (EUR, GBP, and more)</li>
            <li>Shareable read-only record snapshots</li>
            <li>Light and dark theme, multi-language support</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Open Source</h2>
          <p>
            RewardTrackr is open source and released under the{" "}
            <a
              href="https://github.com/JoseGouveia9/RewardTrackr/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT License
            </a>
            . You are free to inspect the code, report issues, or contribute improvements.
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
