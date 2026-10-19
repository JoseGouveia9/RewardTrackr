import { Fragment } from "react";
import { formatCompact } from "../../utils/format";

function formatChartPercent(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

type LinePoint = { positionX: number; positionY: number };

/**
 * Maps values to SVG coordinates inside the padded area, stretching min..max over the usable
 * height.
 */
function buildLinePoints(
  values: number[],
  width: number,
  height: number,
  paddingX: number,
  paddingTop: number,
  paddingBottom: number,
): LinePoint[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const usableW = Math.max(1, width - paddingX * 2);
  const usableH = Math.max(1, height - paddingTop - paddingBottom);
  const span = max - min || 1;

  return values.map((value, index) => {
    const positionX = paddingX + (usableW * index) / Math.max(1, values.length - 1);
    const positionY = paddingTop + usableH - ((value - min) / span) * usableH;
    return { positionX, positionY };
  });
}

function pointsToLinePath(points: LinePoint[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.positionX.toFixed(2)} ${point.positionY.toFixed(2)}`,
    )
    .join(" ");
}

function pointsToAreaPath(points: LinePoint[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const line = pointsToLinePath(points);
  return `${line} L${last.positionX.toFixed(2)} ${baselineY.toFixed(2)} L${first.positionX.toFixed(2)} ${baselineY.toFixed(2)} Z`;
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
  const paddingX = 32;
  const paddingTop = 20;
  const paddingBottom = 28;
  const renderValues = values.length === 1 ? [values[0], values[0]] : values;
  const points = buildLinePoints(renderValues, width, height, paddingX, paddingTop, paddingBottom);
  const linePath = pointsToLinePath(points);
  const areaPath = pointsToAreaPath(points, height - paddingBottom + 6);
  const last = values[values.length - 1] ?? 0;
  const priorValues = values.slice(0, -1);
  const bestIndex = priorValues.length > 0 ? priorValues.indexOf(Math.max(...priorValues)) : -1;
  const bestLabel = bestIndex >= 0 ? (labels[bestIndex] ?? "") : "";
  const bestValue = bestIndex >= 0 ? priorValues[bestIndex] : 0;
  const diff = last - bestValue;
  const isPercent = pointSuffix === "%";
  const formatValue = isPercent ? formatChartPercent : formatCompact;
  const differenceText = `${diff > 0 ? "+" : ""}${formatValue(diff)}${suffix}`;
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
            {differenceText} vs BC {bestLabel}
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
          {points.map((point, index) => (
            <Fragment key={index}>
              <circle cx={point.positionX} cy={point.positionY} r={3.5} fill="#0ea5e9" />
              <text
                x={point.positionX}
                y={Math.max(12, point.positionY - 10)}
                fontSize={11}
                fontWeight={700}
                fill={primaryText}
                textAnchor="middle"
              >
                {`${formatValue(renderValues[index])}${pointSuffix}`}
              </text>
              <text
                x={point.positionX}
                y={height - 8}
                fontSize={10}
                fontWeight={600}
                fill={mutedText}
                textAnchor="middle"
              >
                {labels[index] ?? ""}
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
