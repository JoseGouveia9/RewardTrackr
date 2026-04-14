import { memo } from "react";
import extensionSyncImg from "../assets/extension-sync.webp";
import extensionSuccessImg from "../assets/extension-success.webp";
import "./auth-panel.css";

const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/hglbdmgkgidakkjbgndjebipocbgggkh?utm_source=item-share-cb";

interface AuthPanelProps {
  onSync: () => void;
}

// Renders the step-by-step instructions panel for connecting via the RewardTrackr browser extension.
export const AuthPanel = memo(function AuthPanel({ onSync }: AuthPanelProps) {
  return (
    <section className="panel-glass panel-auth">
      <h2>Connect via Browser Extension</h2>

      <div className="auth-steps">
        <div className="auth-step">
          <span className="auth-step-num">1</span>
          <span>
            Install the{" "}
            <a
              className="auth-store-link"
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>RewardTrackr</strong>
            </a>{" "}
            browser extension
            <span className="auth-step-sub">
              Compatible with Chrome, Opera and Orion (Mobile iOS).
            </span>
          </span>
        </div>
        <div className="auth-step">
          <span className="auth-step-num">2</span>
          <span>Open GoMining and click the extension icon</span>
        </div>
        <img
          src={extensionSyncImg}
          alt="Extension ready to sync"
          className="auth-preview-img auth-preview-img--wide"
          loading="lazy"
        />
        <div className="auth-step">
          <span className="auth-step-num">3</span>
          <span>
            Click <strong>"Sync to Exporter"</strong> when the extension shows{" "}
            <strong>"Ready to sync."</strong>
          </span>
        </div>
        <div className="auth-step">
          <span className="auth-step-num">4</span>
          <span>
            Once synced, the extension shows <strong>"Hello [name] 👋"</strong> and{" "}
            <strong>"Profile synced."</strong>
          </span>
        </div>
        <img
          src={extensionSuccessImg}
          alt="Extension profile synced"
          className="auth-preview-img"
          loading="lazy"
        />
        <div className="auth-step">
          <span className="auth-step-num">5</span>
          <span>
            Click <strong>"Open Exporter"</strong> and you will be redirected here
          </span>
        </div>
      </div>

      <button className="btn-primary btn-primary-large" onClick={onSync}>
        I've synced, open exporter
      </button>
    </section>
  );
});
