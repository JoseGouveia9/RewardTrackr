import { motion } from "framer-motion";

function getMessageType(msg: string): "success" | "error" | "loading" {
  const lower = msg.toLowerCase();
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
    lower.includes("welcome")
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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="message-icon"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ) : type === "error" ? (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="message-icon"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ) : (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="message-icon"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );

  const parts = message.split(/(\[[^\]]+\]\([^)]+\))/g);
  const content = parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      return (
        <a key={i} href={match[2]} target="_blank" rel="noopener noreferrer">
          {match[1]}
        </a>
      );
    }
    return part;
  });

  return (
    <motion.div
      className={`message message-${type}`}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.93 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      {icon}
      <span>{content}</span>
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
