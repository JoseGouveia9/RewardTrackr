import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { createPortal } from "react-dom";
import "./support-button.css";
import { CheckIcon, CloseIcon, CopyIcon, HeartIcon } from "@/components/icons";

function KofiMobileButton() {
  const { t } = useTranslation();
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
        {t("support.supportProject")}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="support-kofi-overlay"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <motion.div
                className="support-kofi-popup"
                onClick={(event) => event.stopPropagation()}
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: [0.92, 1.03, 1], y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.24, ease: "easeInOut" }}
              >
                <button
                  type="button"
                  className="support-kofi-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <CloseIcon width={16} height={16} />
                </button>
                <iframe
                  src="https://ko-fi.com/moustachio/?hidefeed=true&widget=true&embed=true&preview=true"
                  className="support-kofi-iframe"
                  height="712"
                  title="moustachio"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

const ADDRESSES = [
  {
    label: "GOMINING TOKEN (GMT) · BNB Network (BEP-20) / Ethereum Network (ERC-20)",
    value: "0x191Cc26ef2892bCe37800Ec97Bb2862A296Db00B",
  },
  {
    label: "GOMINING TOKEN (GMT) · SOL Network",
    value: "3DUa4jLZ9RTuW53om812k5Gwbnr31g8UssRnYcMzHhzu",
  },
  {
    label: "GOMINING TOKEN (GMT) · TON Network",
    value: "UQCfBtTGiUg4VZLZKsVzUYuPXedNQfmSIjFo4JO_aYgp_Mdo",
  },
  { label: "BITCOIN · BTC Network", value: "bc1q6pu0f5q67qvv5tmedr2kswrv2duuf4p7zhczq0" },
  { label: "BITCOIN · Lightning Network", value: "moustachio@blink.sv" },
];

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, copy] = useCopyToClipboard(1500);

  return (
    <button
      type="button"
      className="support-copy-button"
      onClick={() => copy(value)}
      aria-label={t("support.copyAddress")}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

declare global {
  interface Window {
    kofiWidgetOverlay?: {
      draw: (username: string, options: Record<string, string>) => void;
    };
  }
}

export const SupportButton = memo(function SupportButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEscapeKey(() => setOpen(false), open);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (window.innerWidth <= 640) return;
    const script = document.createElement("script");
    script.src = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
    script.async = true;
    script.onload = () => {
      window.kofiWidgetOverlay?.draw("moustachio", {
        type: "floating-chat",
        "floating-chat.donateButton.text": "Support the project",
        "floating-chat.donateButton.background-color": "#F7931A",
        "floating-chat.donateButton.text-color": "#fff",
      });
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="support-button"
        onClick={() => setOpen(true)}
        aria-label={t("support.supportProject")}
      >
        <HeartIcon className="support-heart-icon" />
        <span className="support-button-label">{t("support.supportProject")}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="support-overlay"
            onClick={() => setOpen(false)}
            aria-modal="true"
            role="dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <motion.div
              className="support-modal"
              onClick={(event) => event.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: [0.92, 1.03, 1], y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.24, ease: "easeInOut" }}
            >
              <div className="support-modal-header">
                <div className="support-modal-title-row">
                  <HeartIcon filled size={20} />
                  <span className="support-modal-title">{t("support.supportProject")}</span>
                </div>
                <button
                  type="button"
                  className="support-modal-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </div>

              <p className="support-modal-subtitle">{t("support.tipsDescription")}</p>

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
                <p className="support-kofi-label">{t("support.orTipViaKofi")}</p>
                <KofiMobileButton />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
