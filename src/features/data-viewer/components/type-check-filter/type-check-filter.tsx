import { ColFilterWrap } from "../col-filter-wrap/col-filter-wrap";

export function TypeCheckFilter({
  label,
  types,
  selected,
  onChange,
}: {
  label: string;
  types: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <ColFilterWrap label={label} active={selected.length > 0}>
      <div className="dv-filter-checks">
        {types.map((t) => (
          <label key={t} className="dv-filter-check-label">
            <input
              type="checkbox"
              className="dv-filter-checkbox"
              checked={selected.includes(t)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, t] : selected.filter((x) => x !== t))
              }
            />
            {t}
          </label>
        ))}
      </div>
      <button
        type="button"
        className="dv-filter-clear-button"
        onClick={() => onChange([])}
        disabled={selected.length === 0}
      >
        Clear
      </button>
    </ColFilterWrap>
  );
}
