import { ColFilterWrap } from "./col-filter-wrap";

/** Renders a checkbox list filter inside a ColFilterWrap for selecting one or more type values. */
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
            {t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <button type="button" className="dv-filter-clear-link" onClick={() => onChange([])}>
          Clear
        </button>
      )}
    </ColFilterWrap>
  );
}
