import { motion } from "framer-motion";
import { CheckCircleIcon, ClockIcon, CrossCircleIcon } from "@/components/icons";

/**
 * Splits text into plain strings and links, turning `[label](url)` markdown into new-tab anchors.
 */
function parseParts(text: string) {
  return text.split(/(\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    return match ? (
      <a key={index} href={match[2]} target="_blank" rel="noopener noreferrer">
        {match[1]}
      </a>
    ) : (
      part
    );
  });
}

/**
 * Classifies a status message by English keywords: error, success, otherwise in-progress
 * (loading).
 */
function getMessageType(message: string): "success" | "error" | "loading" {
  const lower = message.toLowerCase();
  if (
    lower.includes("invalid") ||
    lower.includes("expired") ||
    lower.includes("no token") ||
    lower.includes("error") ||
    lower.includes("fail")
  ) {
    return "error";
  }
  if (
    lower.includes("successfully") ||
    lower.includes("synced") ||
    lower.includes("cleared") ||
    lower.includes("downloaded") ||
    lower.includes("done") ||
    lower.includes("welcome") ||
    lower.includes("complete") ||
    lower.includes("up to date")
  ) {
    return "success";
  }
  return "loading";
}

interface MessageBannerProps {
  message: string;
  onClose?: () => void;
}

export function MessageBanner({ message, onClose }: MessageBannerProps) {
  const type = getMessageType(message);
  const canClose = type === "success" || type === "error";

  const icon =
    type === "success" ? (
      <CheckCircleIcon className="message-icon" />
    ) : type === "error" ? (
      <CrossCircleIcon className="message-icon" />
    ) : (
      <ClockIcon className="message-icon" />
    );

  const newlineIndex = message.indexOf("\n");
  const mainMessage = newlineIndex === -1 ? message : message.slice(0, newlineIndex);
  const hintMessage = newlineIndex === -1 ? null : message.slice(newlineIndex + 1);

  return (
    <motion.div
      className={`message message-${type}`}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.93 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      {icon}
      <span className="message-body">
        <span>{parseParts(mainMessage)}</span>
        {hintMessage && <span className="message-hint">{hintMessage}</span>}
      </span>
      {canClose && onClose ? (
        <button
          type="button"
          className="message-close"
          onClick={onClose}
          aria-label="Close message"
        >
          ×
        </button>
      ) : null}
    </motion.div>
  );
}
