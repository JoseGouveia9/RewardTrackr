import { useNavigate } from "react-router";
import "./legal-page.css";

export function PrivacyPage() {
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
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-meta">Last updated: April 2026</p>
      </div>

      <div className="legal-divider" />

      <div className="legal-body">
        <div className="legal-section">
          <h2 className="legal-section-title">No data collection</h2>
          <p>
            RewardTrackr does not operate its own backend or database. It does not collect, store,
            or transmit your personal data to any server operated by this project. There is no
            account system, no analytics, and no telemetry of any kind. Data remains in your browser
            unless you explicitly export or share it.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">What is stored in your browser</h2>
          <p>All data RewardTrackr uses is stored locally in your browser.</p>
          <p>
            <strong>Session storage (temporary):</strong>
          </p>
          <ul>
            <li>
              Your GoMining API access token — stored in <code>sessionStorage</code> and used solely
              to authenticate requests directly to the GoMining API on your behalf. This token is
              automatically cleared when the browser tab or session is closed.
            </li>
          </ul>
          <p>
            <strong>Local storage (persistent):</strong>
          </p>
          <ul>
            <li>
              Cached reward records from your last sync — to support faster incremental exports
            </li>
            <li>Export preferences (selected sheets, currency settings)</li>
            <li>UI preferences (theme, language, dismissed notices)</li>
          </ul>
          <p>
            RewardTrackr does not operate its own backend or database. Data remains in your browser
            unless you explicitly export or share it. You can remove stored data at any time by
            clearing your browser's site data or using the in-app "Clear cache" option.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Security notice</h2>
          <p>
            While your API token is stored only in your browser session and is not transmitted
            anywhere except directly to the GoMining API, browser storage may still be accessible to
            scripts running on the page or anyone with access to your device. Use RewardTrackr only
            on trusted devices and keep your browser secure.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Third-party API calls</h2>
          <p>RewardTrackr makes requests to the following external services on your behalf:</p>
          <ul>
            <li>
              <strong>GoMining API</strong> — to fetch your reward records. Your access token is
              sent in the request header. This is subject to GoMining's own privacy policy.
            </li>
            <li>
              <strong>CoinGecko API</strong> — to retrieve historical BTC prices for fiat value
              enrichment. No personal data is sent; only date ranges are queried.
            </li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Shared records</h2>
          <p>
            If you choose to share your records using the share feature, a snapshot of your selected
            data is published to a public GitHub repository and may be accessible to anyone with the
            link. Only data you explicitly choose to share is included. While you may request
            deletion, previously accessed or copied data may remain available elsewhere.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Contact</h2>
          <p>
            Questions about privacy can be directed to the project maintainer via{" "}
            <a
              href="https://github.com/JoseGouveia9/RewardTrackr/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Issues
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
