import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon } from "@/components/icons";

export function ShareActions({
  isUpdate,
  publishing,
  canPublish,
  onPublish,
  onGenerateImage,
  onClose,
}: {
  isUpdate: boolean;
  publishing: boolean;
  canPublish: boolean;
  onPublish: () => void;
  onGenerateImage: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);

  if (confirmingUpdate) {
    return (
      <div className="share-modal-update-warning">
        <span>{t("share.updateWarning")}</span>
        <div className="share-modal-update-warning-actions">
          <button
            type="button"
            className="share-modal-button share-modal-button--primary"
            onClick={() => {
              setConfirmingUpdate(false);
              onPublish();
            }}
          >
            {t("share.confirmUpdate")}
          </button>
          <button
            type="button"
            className="share-modal-button share-modal-button--ghost"
            onClick={() => setConfirmingUpdate(false)}
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="share-modal-actions">
      <button
        type="button"
        className="share-modal-button share-modal-button--primary"
        onClick={isUpdate ? () => setConfirmingUpdate(true) : onPublish}
        disabled={!canPublish}
      >
        {publishing ? t("share.publishing") : isUpdate ? t("share.updateData") : t("common.share")}
      </button>
      {import.meta.env.DEV && (
        <button
          type="button"
          className="share-modal-button share-modal-button--ghost"
          onClick={onGenerateImage}
          disabled={publishing}
        >
          <ImageIcon />
          {t("share.generateImage")}
        </button>
      )}
      <button
        type="button"
        className="share-modal-button share-modal-button--ghost"
        onClick={onClose}
        disabled={publishing}
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}
