import { useNavigate } from "react-router";
import "./legal-page.css";

export function TermsPage() {
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
        <h1 className="legal-title">Terms of Use</h1>
        <p className="legal-meta">Last updated: April 2026</p>
      </div>

      <div className="legal-divider" />

      <div className="legal-body">
        <div className="legal-section">
          <h2 className="legal-section-title">Acceptance</h2>
          <p>
            By using RewardTrackr you agree to these terms. If you do not agree, please do not use
            the tool.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Unofficial tool</h2>
          <p>
            RewardTrackr is an independent, community-built tool. It is not affiliated with,
            endorsed by, or officially connected to GoMining, Bitfufu, or any of their related
            entities. Use of the GoMining API through this tool is subject to GoMining's own terms
            of service.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">No warranty</h2>
          <p>
            RewardTrackr is provided "as is" without warranty of any kind. The author makes no
            guarantees regarding the accuracy, completeness, or availability of the tool or the data
            it retrieves. Exported data should be independently verified before being used for tax,
            financial, or legal purposes.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Your responsibility</h2>
          <p>
            You are solely responsible for keeping your GoMining API access token secure. Do not
            share your token with others. RewardTrackr stores it locally in your browser and uses it
            only to make API requests on your behalf.
          </p>
          <p>
            You agree not to use RewardTrackr in any way that violates GoMining's terms of service
            or applicable law.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, the author of RewardTrackr shall not be liable
            for any direct, indirect, incidental, or consequential damages arising from your use of
            the tool, including but not limited to data loss, export errors, or API changes made by
            GoMining.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">Changes</h2>
          <p>
            These terms may be updated at any time. Continued use of RewardTrackr after changes are
            posted constitutes acceptance of the updated terms.
          </p>
        </div>
      </div>
    </div>
  );
}
