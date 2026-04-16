function NativeLabel({ label }: { label: string }) {
  if (label !== "Native") return <>{label}</>;
  return (
    <>
      <span className="dv-label--full">Native</span>
      <span className="dv-label--short">ALL</span>
    </>
  );
}

interface ViewSelectorProps<K extends string> {
  views: { key: K; label: string }[];
  activeKey: K;
  onSelect: (key: K) => void;
}

export function ViewSelector<K extends string>({
  views,
  activeKey,
  onSelect,
}: ViewSelectorProps<K>) {
  return (
    <div className="dv-currency-selector">
      {views.map((v) => (
        <button
          key={v.key}
          type="button"
          className={`dv-currency-button${activeKey === v.key ? " dv-currency-button--active" : ""}`}
          onClick={() => onSelect(v.key)}
        >
          <NativeLabel label={v.label} />
        </button>
      ))}
    </div>
  );
}
