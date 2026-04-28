import { useTranslation } from "react-i18next";
import { ColFilterWrap } from "../col-filter-wrap/col-filter-wrap";

export function TypeCheckFilter({
  label,
  types,
  selected,
  onChange,
  renderOption,
}: {
  label: string;
  types: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  renderOption?: (type: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <ColFilterWrap label={label} active={selected.length > 0}>
      <div className="dv-filter-checks">
        {types.map((type) => (
          <label key={type} className="dv-filter-check-label">
            <input
              type="checkbox"
              className="dv-filter-checkbox"
              checked={selected.includes(type)}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...selected, type] : selected.filter((x) => x !== type),
                )
              }
            />
            {renderOption ? renderOption(type) : type}
          </label>
        ))}
      </div>
      <button
        type="button"
        className="dv-filter-clear-button"
        onClick={() => onChange([])}
        disabled={selected.length === 0}
      >
        {t("common.clear")}
      </button>
    </ColFilterWrap>
  );
}
