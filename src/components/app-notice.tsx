import { AnimatePresence, motion } from "framer-motion";

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

interface AppNoticeProps {
  visible: boolean;
  className?: string;
  icon: React.ReactNode;
  onDismiss: () => void;
  children: React.ReactNode;
}

/** Renders a dismissible animated notice banner with an icon and arbitrary content. */
export function AppNotice({ visible, className, icon, onDismiss, children }: AppNoticeProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`app-notice${className ? ` ${className}` : ""}`}
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.2, ease: "easeIn" }}
        >
          {icon}
          <span>{children}</span>
          <button
            type="button"
            className="app-notice-dismiss"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            {DISMISS_ICON}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
