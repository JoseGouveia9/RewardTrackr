import { Fragment } from "react";

// Web port of mobile's ShareCard/LineTrend.tsx SVG line+area trend chart.

function fmtCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2,
  }).format(value);
}

function fmtChartPercent(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

type LinePoint = { x: number; y: number };

function buildLinePoints(
  values: number[],
  width: number,
  height: number,
  padX: number,
  padTop: number,
  padBottom: number,
): LinePoint[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const usableW = Math.max(1, width - padX * 2);
  const usableH = Math.max(1, height - padTop - padBottom);
  const span = max - min || 1;

  return values.map((value, idx) => {
    const x = padX + (usableW * idx) / Math.max(1, values.length - 1);
    const y = padTop + usableH - ((value - min) / span) * usableH;
    return { x, y };
  });
}

function pointsToLinePath(points: LinePoint[]): string {
  return points
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

function pointsToAreaPath(points: LinePoint[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const line = pointsToLinePath(points);
  return `${line} L${last.x.toFixed(2)} ${baselineY.toFixed(2)} L${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

export function MinerWarsLineTrend({
  title,
  values,
  labels,
  suffix,
  pointSuffix = "",
  light,
}: {
  title: string;
  values: number[];
  labels: string[];
  suffix: string;
  pointSuffix?: string;
  light: boolean;
}) {
  const width = 925;
  const height = 104;
  const padX = 32;
  const padTop = 20;
  const padBottom = 28;
  const renderValues = values.length === 1 ? [values[0], values[0]] : values;
  const points = buildLinePoints(renderValues, width, height, padX, padTop, padBottom);
  const linePath = pointsToLinePath(points);
  const areaPath = pointsToAreaPath(points, height - padBottom + 6);
  const last = values[values.length - 1] ?? 0;
  const priorValues = values.slice(0, -1);
  const bestIdx = priorValues.length > 0 ? priorValues.indexOf(Math.max(...priorValues)) : -1;
  const bestLabel = bestIdx >= 0 ? (labels[bestIdx] ?? "") : "";
  const bestValue = bestIdx >= 0 ? priorValues[bestIdx] : 0;
  const diff = last - bestValue;
  const isPercent = pointSuffix === "%";
  const fmtValue = isPercent ? fmtChartPercent : fmtCompact;
  const diffText = `${diff > 0 ? "+" : ""}${fmtValue(diff)}${suffix}`;
  const gradientId = `mwpc-trend-fade-${title.replace(/[^a-zA-Z0-9]/g, "")}`;
  const primaryText = light ? "#14161c" : "#f0f0f0";
  const mutedText = light ? "#6b7280" : "#9aa3af";

  return (
    <div className="mwpc-line-card">
      <div className="mwpc-line-card-header">
        <span className="mwpc-line-card-title">{title}</span>
        {bestLabel ? (
          <span
            className={`mwpc-line-diff-tag ${diff < 0 ? "mwpc-line-diff-tag--neg" : "mwpc-line-diff-tag--pos"}`}
          >
            {diffText} vs BC {bestLabel}
          </span>
        ) : null}
      </div>
      {values.length > 0 ? (
        <svg width={width} height={height} className="mwpc-line-svg">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0ea5e9" stopOpacity={0.35} />
              <stop offset="1" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path
            d={linePath}
            stroke="#0ea5e9"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, idx) => (
            <Fragment key={idx}>
              <circle cx={p.x} cy={p.y} r={3.5} fill="#0ea5e9" />
              <text
                x={p.x}
                y={Math.max(12, p.y - 10)}
                fontSize={11}
                fontWeight={700}
                fill={primaryText}
                textAnchor="middle"
              >
                {`${fmtValue(renderValues[idx])}${pointSuffix}`}
              </text>
              <text
                x={p.x}
                y={height - 8}
                fontSize={10}
                fontWeight={600}
                fill={mutedText}
                textAnchor="middle"
              >
                {labels[idx] ?? ""}
              </text>
            </Fragment>
          ))}
        </svg>
      ) : (
        <div className="mwpc-line-fallback">No trend data</div>
      )}
    </div>
  );
}
