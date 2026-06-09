import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import "./legal-page.css";

export function AboutPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

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
        {t("common.back")}
      </button>

      <div className="legal-header">
        <h1 className="legal-title">{t("about.title")}</h1>
        <p className="legal-meta">{t("about.subtitle")}</p>
      </div>

      <div className="legal-divider" />

      <div className="legal-body">
        <div className="legal-section">
          <h2 className="legal-section-title">{t("about.whatIsTitle")}</h2>
          <p>{t("about.whatIsP1")}</p>
          <p>{t("about.whatIsP2")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("about.featuresTitle")}</h2>
          <ul>
            <li>{t("about.feature1")}</li>
            <li>{t("about.feature2")}</li>
            <li>{t("about.feature3")}</li>
            <li>{t("about.feature4")}</li>
            <li>{t("about.feature5")}</li>
            <li>{t("about.feature6")}</li>
            <li>{t("about.feature7")}</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("about.licenseTitle")}</h2>
          <p>
            {t("about.licenseP1")}{" "}
            <a
              href="https://github.com/JoseGouveia9/RewardTrackr/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("about.licenseLink")}
            </a>
            {t("about.licenseP1b")}
          </p>
          <p>
            <a
              href="https://github.com/JoseGouveia9/RewardTrackr"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("about.repoLink")}
            </a>
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("about.authorTitle")}</h2>
          <p>{t("about.authorP1")}</p>
        </div>
      </div>
    </div>
  );
}
