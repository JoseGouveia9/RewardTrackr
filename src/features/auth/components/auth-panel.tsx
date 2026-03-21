import { memo } from "react";
import extensionSyncImg from "../assets/extension-sync.webp";
import extensionSuccessImg from "../assets/extension-success.webp";
import "./auth-panel.css";

interface AuthPanelProps {
  onSync: () => void;
}

export const AuthPanel = memo(function AuthPanel({ onSync }: AuthPanelProps) {
  return (
    <section className="panel panel-auth">
      <h2>Connect via Browser Extension</h2>

      <div className="auth-steps">
        <div className="auth-step">
          <span className="auth-step-num">1</span>
          <span>
            Install the <strong>GoMining Exporter</strong> browser extension
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
            Once synced, the extension shows <strong>"Welcome [name]!"</strong> and{" "}
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
