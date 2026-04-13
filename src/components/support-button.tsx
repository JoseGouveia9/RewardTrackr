import { memo, useEffect, useState } from "react";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { createPortal } from "react-dom";
import "./support-button.css";

// Renders a Ko-fi button that opens an embedded donation iframe in a portal overlay.
function KofiMobileButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="support-kofi-widget">
      <button type="button" className="support-kofi-image-button" onClick={() => setOpen(true)}>
        <img
          src="https://storage.ko-fi.com/cdn/logomarkLogo.png"
          alt=""
          aria-hidden="true"
          className="support-kofi-icon"
        />
        Support the project
      </button>

      {open &&
        createPortal(
          <div className="support-kofi-overlay" onClick={() => setOpen(false)}>
            <div className="support-kofi-popup" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="support-kofi-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <iframe
                src="https://ko-fi.com/moustachio/?hidefeed=true&widget=true&embed=true&preview=true"
                className="support-kofi-iframe"
                height="712"
                title="moustachio"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

const ADDRESSES = [
  {
    label: "GOMINING TOKEN / GMT · BEP-20 / ERC-20",
    value: "0x02B80404866B5177d78D1178E910Ea4788656088",
  },
  {
    label: "GOMINING TOKEN / GMT · TON",
    value: "UQAaNd7PzffMT7PY0wJNSOqp9wld2oDmxcSGWHQrnDlt1DIN",
  },
  { label: "GOMINING TOKEN / GMT · SOL", value: "2BmjP1zawQ1iHe5a5NtT4MUz4EojLkj7DcZQE52pAAPs" },
  { label: "BTC", value: "bc1qkfftx7v669cqk7jr68fnkp73wmlq9pvp3fvu3s" },
  { label: "Bitcoin · Lightning", value: "moustachio@blink.sv" },
];

// Renders an icon button that copies the given value to the clipboard and shows a brief checkmark.
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  // Copies the address to the clipboard and temporarily shows a checkmark.
  const handleCopy = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  return (
    <button
      type="button"
      className="support-copy-button"
      onClick={handleCopy}
      aria-label="Copy address"
    >
      {copied ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

interface SupportButtonProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

// Renders the support heart button and a modal with crypto donation addresses and Ko-fi.
export const SupportButton = memo(function SupportButton({
  open,
  onOpen,
  onClose,
}: SupportButtonProps) {
  useEscapeKey(onClose, open);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="support-button"
        onClick={onOpen}
        aria-label="Support the project"
      >
        <svg
          className="support-heart-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span className="support-button-label">Support the project</span>
      </button>

      {open && (
        <div className="support-overlay" onClick={onClose} aria-modal="true" role="dialog">
          <div className="support-modal" onClick={(e) => e.stopPropagation()}>
            <div className="support-modal-header">
              <div className="support-modal-title-row">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="#e0192a"
                  stroke="#e0192a"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span className="support-modal-title">Support the project</span>
              </div>
              <button
                type="button"
                className="support-modal-close"
                onClick={onClose}
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="support-modal-subtitle">
              Tips help cover API costs and keep this tool free and unrestricted. Tip via crypto
              below.
            </p>

            <div className="support-addresses">
              {ADDRESSES.map(({ label, value }) => (
                <div key={value} className="support-address-group">
                  <span className="support-address-label">{label}</span>
                  <div className="support-address-row">
                    <code className="support-address-value">{value}</code>
                    <CopyButton value={value} />
                  </div>
                </div>
              ))}
            </div>

            <div className="support-kofi-section">
              <p className="support-kofi-label">Or tip via Ko-fi</p>
              <KofiMobileButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
});
