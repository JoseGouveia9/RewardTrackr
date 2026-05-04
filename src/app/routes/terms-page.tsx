import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import "./legal-page.css";

export function TermsPage() {
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
        <h1 className="legal-title">{t("terms.title")}</h1>
        <p className="legal-meta">{t("terms.lastUpdated")}</p>
      </div>

      <div className="legal-divider" />

      <div className="legal-body">
        <div className="legal-section">
          <h2 className="legal-section-title">{t("terms.acceptanceTitle")}</h2>
          <p>{t("terms.acceptanceP1")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("terms.unofficialTitle")}</h2>
          <p>{t("terms.unofficialP1")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("terms.noWarrantyTitle")}</h2>
          <p>{t("terms.noWarrantyP1")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("terms.noAdviceTitle")}</h2>
          <p>{t("terms.noAdviceP1")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("terms.apiDependencyTitle")}</h2>
          <p>{t("terms.apiDependencyP1")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("terms.fairUseTitle")}</h2>
          <p>{t("terms.fairUseP1")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("terms.responsibilityTitle")}</h2>
          <p>{t("terms.responsibilityP1")}</p>
          <p>{t("terms.responsibilityP2")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("terms.liabilityTitle")}</h2>
          <p>{t("terms.liabilityP1")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("terms.changesTitle")}</h2>
          <p>{t("terms.changesP1")}</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">{t("terms.governingLawTitle")}</h2>
          <p>{t("terms.governingLawP1")}</p>
        </div>
      </div>
    </div>
  );
}
