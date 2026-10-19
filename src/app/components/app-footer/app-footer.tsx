import { Link } from "react-router";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { LAYOUT_SPRING } from "@/lib/motion";

export function AppFooter() {
  const { t } = useTranslation();

  return (
    <motion.p className="copyright" layout transition={LAYOUT_SPRING}>
      <Link className="copyright-link" to="/about">
        {t("footer.about")}
      </Link>
      {" · "}
      <Link className="copyright-link" to="/privacy">
        {t("footer.privacy")}
      </Link>
      {" · "}
      <Link className="copyright-link" to="/terms">
        {t("footer.terms")}
      </Link>
      {" · "}
      <a
        className="copyright-link"
        href="https://docs.google.com/forms/d/e/1FAIpQLSe98CKOga2pnoXh2SdXu0uxOBd9OOIDm1JsR6ludeGH5HOoLg/viewform"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("app.feedbackSuggestions")}
      </a>
      <br />© 2026 José Gouveia · Moustachio
    </motion.p>
  );
}
