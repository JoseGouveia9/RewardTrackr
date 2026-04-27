import { memo } from "react";
import { useTranslation } from "react-i18next";
import extensionSyncImg from "../../assets/extension-sync.webp";
import extensionSuccessImg from "../../assets/extension-success.webp";
import "./auth-panel.css";

const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/hglbdmgkgidakkjbgndjebipocbgggkh?utm_source=item-share-cb";

interface AuthPanelProps {
  onSync: () => void;
}

export const AuthPanel = memo(function AuthPanel({ onSync }: AuthPanelProps) {
  const { t } = useTranslation();
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
