import { useTranslation } from "react-i18next";
import { CheckIcon, CopyIcon } from "@/components/icons";

export function ShareLinkRow({
  link,
  copied,
  onCopy,
  disabled,
}: {
  link: string;
  copied: boolean;
  onCopy: (link: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const copyLabel = copied ? t("common.copied") : t("share.copyLink");

  return (
    <div className="share-modal-link-row">
      <input
        type="text"
        className="share-modal-link-input"
        value={link}
        readOnly
        onClick={(event) => (event.target as HTMLInputElement).select()}
      />
      <button
        type="button"
        className={`share-modal-icon-button${copied ? " share-modal-icon-button--done" : ""}`}
        onClick={() => onCopy(link)}
        disabled={disabled}
        aria-label={copyLabel}
        title={copyLabel}
      >
        {copied ? <CheckIcon /> : <CopyIcon strokeWidth={2.2} />}
      </button>
    </div>
  );
}
