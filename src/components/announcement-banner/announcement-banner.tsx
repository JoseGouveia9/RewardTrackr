import { AnimatePresence, motion } from "framer-motion";
import "./announcement-banner.css";

function NewBadge() {
  return (
    <svg className="ann-badge" viewBox="0 0 100 100" width="46" height="46" aria-hidden="true">
      <defs>
        <linearGradient id="ann-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe566" />
          <stop offset="50%" stopColor="#f7b733" />
          <stop offset="100%" stopColor="#c97d10" />
        </linearGradient>
      </defs>
      {}
      <polygon
        points="50,4 60.1,12.3 73,10.2 77.6,22.4 89.8,27 87.7,39.9 96,50 87.7,60.1 89.8,73 77.6,77.6 73,89.8 60.1,87.7 50,96 39.9,87.7 27,89.8 22.4,77.6 10.2,73 12.3,60.1 4,50 12.3,39.9 10.2,27 22.4,22.4 27,10.2 39.9,12.3"
        fill="url(#ann-gold-grad)"
      />
      <text
        x="50"
        y="53"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontFamily="'Space Grotesk', sans-serif"
        fontSize="23"
        fontWeight="800"
        letterSpacing="1"
      >
        NEW
      </text>
    </svg>
  );
}

const SPARKLE = (
  <svg width="1em" height="1em" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
    <path d="M4 0 L4.6 3.4 L8 4 L4.6 4.6 L4 8 L3.4 4.6 L0 4 L3.4 3.4 Z" />
  </svg>
);

const DISMISS_ICON = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

interface AnnouncementBannerProps {
  visible: boolean;
  message: string;
  onDismiss: () => void;
}

export function AnnouncementBanner({ visible, message, onDismiss }: AnnouncementBannerProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="ann-banner"
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.2, ease: "easeIn" }}
        >
          <span className="ann-sparkle ann-sparkle-1">{SPARKLE}</span>
          <span className="ann-sparkle ann-sparkle-2">{SPARKLE}</span>
          <span className="ann-sparkle ann-sparkle-3">{SPARKLE}</span>
          <span className="ann-sparkle ann-sparkle-4">{SPARKLE}</span>
          <NewBadge />
          <span className="ann-message">{message}</span>
          <button
            type="button"
            className="ann-dismiss"
            aria-label="Dismiss announcement"
            onClick={onDismiss}
          >
            {DISMISS_ICON}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
