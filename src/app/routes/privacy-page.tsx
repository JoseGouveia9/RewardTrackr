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
            RewardTrackr does not collect, store, or sell your reward data or personal account data.
            There is no account system, no analytics, and no telemetry. Your reward records and
            preferences stay in your browser. Limited technical metadata may be processed for
            rate-limiting purposes, as described below.
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
              Your GoMining API access token, stored in <code>sessionStorage</code> and used solely
              to authenticate requests directly to the GoMining API on your behalf. Cleared
              automatically when the browser tab or session is closed.
            </li>
          </ul>
          <p>
            <strong>Local storage (persistent):</strong>
          </p>
          <ul>
            <li>
              Cached reward records from your last sync, to support faster incremental exports
            </li>
            <li>Export preferences (selected sheets, currency settings)</li>
            <li>UI preferences (theme, language, dismissed notices)</li>
          </ul>
          <p>
            Data remains in your browser unless you explicitly export or share it. You can remove
            stored data at any time by clearing your browser's site data or using the in-app "Clear
            cache" option.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Security notice</h2>
          <p>
            Your API token is stored only in your browser's session storage (sessionStorage) and is
            transmitted solely to the GoMining API. It is never sent to any server operated by this
            project. Browser storage may still be accessible to scripts running on the page or
            anyone with access to your device. Use RewardTrackr only on trusted devices and keep
            your browser secure.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">External requests</h2>
          <p>RewardTrackr makes requests to the following services:</p>
          <ul>
            <li>
              <strong>RewardTrackr rate-limit service (Cloudflare Worker):</strong> when you start
              an export, a request is sent to a Cloudflare Worker operated by this project to
              enforce fair-use limits. A SHA-256 hash derived from your token is used solely as a
              technical identifier for rate limiting; the raw token is never sent. The worker does
              not store your token or reward data; it only records a timestamp to track usage.
            </li>
            <li>
              <strong>GoMining API:</strong> fetches your reward records using your access token.
              Subject to GoMining's own privacy policy.
            </li>
            <li>
              <strong>CoinGecko API:</strong> retrieves historical BTC prices for fiat value
              enrichment. No personal data is sent; only date ranges are queried.
            </li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Shared records</h2>
          <p>
            If you choose to use the share feature, RewardTrackr will create a JSON snapshot
            containing only the data you explicitly select and publish it to a public GitHub
            repository. A unique shareable link is then generated, which can be used to view that
            snapshot inside RewardTrackr.
          </p>
          <p>
            Anyone with the share link can access the shared snapshot. Because the underlying
            repository is public, shared snapshots may also be discoverable by others or indexed by
            third parties.
          </p>
          <p>
            Shared snapshots can be deleted at any time using the delete option in the share
            feature, which removes the JSON file from the public repository. However, copies, forks,
            caches, or previously accessed versions may remain available elsewhere.
          </p>
          <p>
            Only data you explicitly choose to share is included. You should only share information
            you are comfortable making public.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Contact</h2>
          <p>
            Questions about privacy can be directed to the project maintainer through{" "}
            <a
              href="https://github.com/JoseGouveia9/RewardTrackr/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              issues on GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
