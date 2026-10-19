import { AnimatePresence, motion } from "framer-motion";
import { MessageBanner } from "@/components/message-banner/message-banner";
import { LAYOUT_SPRING } from "@/lib/motion";

interface StatusMessageProps {
  message: string;
  onClose: () => void;
  keyPrefix?: string;
}

/**
 * Banner whose key ignores changing numbers (countdowns, "X/Y") so it doesn't remount on every
 * tick.
 */
export function StatusMessage({ message, onClose, keyPrefix }: StatusMessageProps) {
  return (
    <AnimatePresence mode="popLayout">
      {message ? (
        <motion.div layout transition={LAYOUT_SPRING}>
          <MessageBanner
            key={
              keyPrefix
                ? `${keyPrefix}-${message.replace(/\b\d+s\b/g, "").replace(/\d+\/\d+/g, "")}`
                : undefined
            }
            message={message}
            onClose={onClose}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
