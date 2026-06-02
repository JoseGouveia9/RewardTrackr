import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import extensionSyncImg from "../../assets/extension-sync.webp";
import extensionSuccessImg from "../../assets/extension-success.webp";
import "./auth-panel.css";

const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/hglbdmgkgidakkjbgndjebipocbgggkh?utm_source=item-share-cb";

interface AuthPanelProps {
  onSync: () => void;
  showManualTokenInput?: boolean;
  onManualTokenSubmit?: (token: string) => void;
}

export const AuthPanel = memo(function AuthPanel({
  onSync,
  showManualTokenInput = false,
  onManualTokenSubmit,
}: AuthPanelProps) {
  const { t } = useTranslation();
  const [manualToken, setManualToken] = useState("");

  const handleManualSubmit = (): void => {
    if (!onManualTokenSubmit) return;
    onManualTokenSubmit(manualToken);
    setManualToken("");
  };

  return (
    <section className="panel-glass panel-auth">
      <h2>{t("auth.connectViaBrowserExtension")}</h2>

      <div className="auth-steps">
        <div className="auth-step">
          <span className="auth-step-num">1</span>
          <span>
            <a
              className="auth-store-link"
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>{t("auth.installExtension")}</strong>
            </a>
            <span className="auth-step-sub">{t("auth.compatible")}</span>
          </span>
        </div>
        <div className="auth-step">
          <span className="auth-step-num">2</span>
          <span>{t("auth.step1")}</span>
        </div>
        <img
          src={extensionSyncImg}
          alt="Extension ready to sync"
          className="auth-preview-img auth-preview-img--wide"
          loading="lazy"
        />
        <div className="auth-step">
          <span className="auth-step-num">3</span>
          <span>{t("auth.step2")}</span>
        </div>
        <div className="auth-step">
          <span className="auth-step-num">4</span>
          <span>{t("auth.step3")}</span>
        </div>
        <img
          src={extensionSuccessImg}
          alt="Extension profile synced"
          className="auth-preview-img"
          loading="lazy"
        />
        <div className="auth-step">
          <span className="auth-step-num">5</span>
          <span>{t("auth.step4")}</span>
        </div>
      </div>

      <button className="btn-primary btn-primary-large" onClick={onSync}>
        {t("auth.iVeSynced")}
      </button>

      {showManualTokenInput && onManualTokenSubmit ? (
        <div className="auth-manual-token">
          <p className="auth-manual-token-label">Dev only: paste JWT token manually</p>
          <textarea
            className="auth-manual-token-input"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            rows={3}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn-secondary auth-manual-token-btn" onClick={handleManualSubmit}>
            Use token
          </button>
        </div>
      ) : null}

      <p className="auth-update-hint">
        {t("auth.havingIssues")}{" "}
        <a
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="auth-store-link"
        >
          {t("auth.latestVersion")}
        </a>
      </p>
    </section>
  );
});
