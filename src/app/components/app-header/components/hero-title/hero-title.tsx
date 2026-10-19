import { useCallback, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import logo from "/logo.webp";

interface HeroTitleProps {
  signedIn: boolean;
  displayAlias: string;
  dark: boolean;
  homePath: string;
}

export function HeroTitle({ signedIn, displayAlias, dark, homePath }: HeroTitleProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const goHome = useCallback(() => {
    void navigate(homePath);
  }, [homePath, navigate]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        goHome();
      }
    },
    [goHome],
  );

  const labelStyle = signedIn
    ? { fontSize: "0.65rem", letterSpacing: "0.08em", marginBottom: "2px" }
    : { fontSize: "1.35rem", letterSpacing: "0.06em", marginBottom: "0px" };
  const labelColor = { color: signedIn ? "#6d7589" : dark ? "#ffffff" : "#22283a" };

  return (
    <div
      className="hero-title-row"
      role="button"
      tabIndex={0}
      onClick={goHome}
      onKeyDown={handleKeyDown}
      aria-label={t("app.goToMain")}
    >
      <img src={logo} alt="RewardTrackr logo" className="hero-logo" />
      <div>
        <motion.span
          className="hero-label"
          initial={labelStyle}
          animate={labelStyle}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.span
            className="hero-label-main"
            initial={labelColor}
            animate={labelColor}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            REWARD
          </motion.span>
          <span className="hero-label-accent">TRACKR</span>
        </motion.span>
        <AnimatePresence>
          {signedIn && (
            <motion.h1
              key="greeting"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {t("common.greeting", { name: displayAlias })}
            </motion.h1>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
