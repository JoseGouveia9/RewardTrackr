import { memo, useEffect } from "react";
import "./donate-section.css";

declare global {
  interface Window {
    kofiWidgetOverlay?: {
      draw: (username: string, options: Record<string, string>) => void;
    };
  }
}

export const DonateSection = memo(function DonateSection() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
    script.async = true;
    script.onload = () => {
      window.kofiWidgetOverlay?.draw("moustachio", {
        type: "floating-chat",
        "floating-chat.donateButton.text": "Support the project",
        "floating-chat.donateButton.background-color": "#7a4df6",
        "floating-chat.donateButton.text-color": "#fff",
      });
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <section className="donate-section">
      <p className="donate-title">Support the project</p>
      <p className="donate-sub">
        Tips help cover API costs and keep this tool free and unrestricted.
        <br />
        You can tip via crypto below or use the button in the corner to support with fiat.
      </p>
      <div className="donate-addresses">
        <div className="donate-group">
          <span className="donate-label">GOMINING Token / GMT · BEP-20 / ERC-20</span>
          <code className="donate-addr">0x02B80404866B5177d78D1178E910Ea4788656088</code>
        </div>
        <div className="donate-group">
          <span className="donate-label">GOMINING Token / GMT · TON</span>
          <code className="donate-addr">UQAaNd7PzffMT7PY0wJNSOqp9wld2oDmxcSGWHQrnDlt1DIN</code>
        </div>
        <div className="donate-group">
          <span className="donate-label">GOMINING Token / GMT · SOL</span>
          <code className="donate-addr">2BmjP1zawQ1iHe5a5NtT4MUz4EojLkj7DcZQE52pAAPs</code>
        </div>
        <div className="donate-group">
          <span className="donate-label">BTC</span>
          <code className="donate-addr">bc1qkfftx7v669cqk7jr68fnkp73wmlq9pvp3fvu3s</code>
        </div>
        <div className="donate-group">
          <span className="donate-label">Bitcoin · Lightning</span>
          <code className="donate-addr">moustachio@blink.sv</code>
        </div>
      </div>
    </section>
  );
});
