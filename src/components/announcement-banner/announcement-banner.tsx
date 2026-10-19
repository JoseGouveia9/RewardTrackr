import { AnimatePresence, motion } from "framer-motion";
import "./announcement-banner.css";
import { CloseIcon, NewBadgeIcon, SparkleIcon } from "@/components/icons";

function NewBadge() {
  return <NewBadgeIcon className="ann-badge" />;
}

const SPARKLE = <SparkleIcon />;

const DISMISS_ICON = <CloseIcon width={13} height={13} />;

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
