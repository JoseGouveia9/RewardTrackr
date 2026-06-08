import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import extensionSyncImg from "../../assets/extension-sync.webp";
import extensionSuccessImg from "../../assets/extension-success.webp";
import { useUserStats } from "../../hooks/use-user-stats";
import { useEscapeKey } from "@/hooks/use-escape-key";
import "./auth-panel.css";

const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/hglbdmgkgidakkjbgndjebipocbgggkh?utm_source=item-share-cb";

interface AuthPanelProps {
  onSync: () => void;
  showManualTokenInput?: boolean;
  onManualTokenSubmit?: (token: string) => void;
}

function HowToModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  useEscapeKey(onClose, true);

  return (
    <div
      className="auth-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("auth.howToUseExtension")}
    >
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h3>{t("auth.howToUseExtension")}</h3>
          <button className="auth-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="auth-modal-body">
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
        </div>
      </div>
    </div>
  );
}

export const AuthPanel = memo(function AuthPanel({
  onSync: _onSync,
  showManualTokenInput = false,
  onManualTokenSubmit,
}: AuthPanelProps) {
  const { t } = useTranslation();
  const [manualToken, setManualToken] = useState("");
  const [showHowTo, setShowHowTo] = useState(false);
  const userCount = useUserStats();

  const handleManualSubmit = (): void => {
    if (!onManualTokenSubmit) return;
    onManualTokenSubmit(manualToken);
    setManualToken("");
  };

  const openHowTo = useCallback(() => setShowHowTo(true), []);
  const closeHowTo = useCallback(() => setShowHowTo(false), []);

  return (
    <>
      <section className="panel-glass panel-auth">
        <div className="auth-header">
          <div className="auth-header-top">
            <h2>{t("auth.connectViaBrowserExtension")}</h2>
            {userCount !== null && userCount > 0 && (
              <p className="auth-user-count">
                <span className="auth-user-count-dot" />
                {t("auth.trustedBy", { count: userCount })}
              </p>
            )}
          </div>
          <button className="auth-howto-btn" onClick={openHowTo}>
            <span className="auth-howto-btn-icon">?</span>
            {t("auth.howToUseExtension")}
          </button>
        </div>

        <a
          className="btn-primary btn-primary-large auth-install-btn"
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 2v10M9 12l-3.5-3.5M9 12l3.5-3.5" />
            <path d="M2 15h14" />
          </svg>
          {t("auth.installExtension")}
        </a>

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

      {showHowTo && <HowToModal onClose={closeHowTo} />}
    </>
  );
});
