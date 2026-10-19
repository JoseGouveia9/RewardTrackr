import { useTranslation } from "react-i18next";

const SIZE = 92;
const STROKE = 8;
const CENTER = SIZE / 2;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Arc({ color, percent }: { color: string; percent: number }) {
  const dash = (percent / 100) * CIRCUMFERENCE;
  return (
    <circle
      cx={CENTER}
      cy={CENTER}
      r={RADIUS}
      stroke={color}
      strokeWidth={STROKE}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={`${dash} ${Math.max(0, CIRCUMFERENCE - dash)}`}
      transform={`rotate(-90 ${CENTER} ${CENTER})`}
    />
  );
}

export function RingSvg({
  percent,
  trackColor,
  className,
}: {
  percent: number | null;
  trackColor: string;
  className: string;
}) {
  const safePercent = percent != null ? Math.max(0, Math.min(100, percent)) : 0;
  const overflowPercent = percent != null ? Math.max(0, Math.min(100, percent - 100)) : 0;
  return (
    <svg width={SIZE} height={SIZE} className={className} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        stroke={trackColor}
        strokeWidth={STROKE}
        fill="none"
      />
      <Arc color="#f7931a" percent={safePercent} />
      {overflowPercent > 0 && <Arc color="#22c55e" percent={overflowPercent} />}
    </svg>
  );
}

export function TargetRing({
  percent,
  classPrefix,
}: {
  percent: number | null;
  classPrefix: "minerwars-panel" | "clan-view";
}) {
  const { t } = useTranslation();
  return (
    <div className={`${classPrefix}-ring-wrap`}>
      <RingSvg
        percent={percent}
        trackColor="rgba(148,163,184,0.24)"
        className={`${classPrefix}-ring-svg`}
      />
      <div className={`${classPrefix}-ring-center`}>
        <span className={`${classPrefix}-ring-pct`}>
          {percent != null ? `${percent.toFixed(1)}%` : "\u2014"}
        </span>
        <span className={`${classPrefix}-ring-label`}>{t("cycleTracker.target")}</span>
      </div>
    </div>
  );
}
