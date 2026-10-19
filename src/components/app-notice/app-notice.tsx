import { CloseIcon } from "@/components/icons";

import { AnimatePresence, motion } from "framer-motion";

const DISMISS_ICON = <CloseIcon width={13} height={13} />;

interface AppNoticeProps {
  visible: boolean;
  className?: string;
  icon: React.ReactNode;
  onDismiss: () => void;
  children: React.ReactNode;
}

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
