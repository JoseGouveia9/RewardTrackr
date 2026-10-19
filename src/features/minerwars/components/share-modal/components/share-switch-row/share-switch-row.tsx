export function ShareSwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="mwsm-switch-row">
      <span className="mwsm-control-label">{label}</span>
      <input
        type="checkbox"
        className="mwsm-switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
