import { RingSvg } from "@/features/minerwars/components/ring/ring";

export function ShareRing({ percent, light }: { percent: number | null; light: boolean }) {
  return (
    <div className="mwpc-ring-wrap">
      <RingSvg
        percent={percent}
        trackColor={light ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)"}
        className="mwpc-ring-svg"
      />
      <span className="mwpc-ring-pct">{percent != null ? `${percent.toFixed(1)}%` : "—"}</span>
      <span className="mwpc-ring-label">TARGET</span>
    </div>
  );
}
