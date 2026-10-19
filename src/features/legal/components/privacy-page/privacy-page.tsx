import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import "../../assets/legal-page.css";
import { BackIcon } from "@/components/icons";

export function PrivacyPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="legal-page">
      <button type="button" className="legal-back" onClick={() => void navigate("/")}>
        <BackIcon width={14} height={14} />
        {t("common.back")}
      </button>

      <div className="legal-header">
        <h1 className="legal-title">{t("privacy.title")}</h1>
        <p className="legal-meta">{t("privacy.lastUpdated")}</p>
      </div>

      <div className="legal-divider" />

      <div className="legal-body">
        <div className="legal-section">
          <h2 className="legal-section-title">{t("privacy.noCollectionTitle")}</h2>
          <p>{t("privacy.noCollectionP1")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("privacy.browserStorageTitle")}</h2>
          <p>{t("privacy.browserStorageP1")}</p>
          <p>
            <strong>{t("privacy.sessionStorageLabel")}</strong>
          </p>
          <ul>
            <li>{t("privacy.sessionItem1")}</li>
          </ul>
          <p>
            <strong>{t("privacy.localStorageLabel")}</strong>
          </p>
          <ul>
            <li>{t("privacy.localItem1")}</li>
            <li>{t("privacy.localItem2")}</li>
            <li>{t("privacy.localItem3")}</li>
            <li>{t("privacy.localItem4")}</li>
            <li>{t("privacy.localItem5")}</li>
          </ul>
          <p>{t("privacy.browserStorageP2")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("privacy.securityTitle")}</h2>
          <p>{t("privacy.securityP1")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("privacy.externalRequestsTitle")}</h2>
          <p>{t("privacy.externalRequestsP1")}</p>
          <ul>
            <li>{t("privacy.externalItem1")}</li>
            <li>{t("privacy.externalItem2")}</li>
            <li>{t("privacy.externalItem3")}</li>
            <li>{t("privacy.externalItem4")}</li>
            <li>{t("privacy.externalItem5")}</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("privacy.sharedRecordsTitle")}</h2>
          <p>{t("privacy.sharedRecordsP1")}</p>
          <p>{t("privacy.sharedRecordsP2")}</p>
          <p>{t("privacy.sharedRecordsP3")}</p>
          <p>{t("privacy.sharedRecordsP4")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("privacy.contactTitle")}</h2>
          <p>
            {t("privacy.contactP1")}{" "}
            <a
              href="https://github.com/JoseGouveia9/RewardTrackr/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("privacy.issuesOnGitHub")}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
