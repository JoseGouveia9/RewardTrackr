import { useTranslation } from "react-i18next";

export function RowSelectionToolbar({
  onSelectAll,
  onSelectNone,
}: {
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <button type="button" className="dv-group-button" onClick={onSelectAll}>
        {t("share.selectAll")}
      </button>
      <button type="button" className="dv-group-button" onClick={onSelectNone}>
        {t("share.selectNone")}
      </button>
    </>
  );
}
