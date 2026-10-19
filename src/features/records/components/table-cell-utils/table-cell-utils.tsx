import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { DateRange } from "../../types";
import { formatDate, formatDateTime, getDateBounds } from "../../utils";
import { DateRangeFilter } from "../date-range-filter/date-range-filter";
import { InfoIcon, TrendDeltaIcon } from "@/components/icons";
import { FiatIcon, UsdIcon } from "@/components/icons/currency-icons";

const INFO_ICON = <InfoIcon className="dv-info-icon" />;

export function TrendArrow({
  current,
  previous,
  integer,
}: {
  current: number | undefined;
  previous: number | undefined;
  integer?: boolean;
}) {
  if (current == null || previous == null) return null;
  const currentValue = integer ? Math.round(current) : current;
  const previousValue = integer ? Math.round(previous) : previous;
  const delta = currentValue - previousValue;
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <TrendDeltaIcon up={up} className={`dv-trend${up ? " dv-trend--up" : " dv-trend--down"}`} />
  );
}

export function Fraction({
  numerator,
  denominator,
}: {
  numerator: ReactNode;
  denominator: ReactNode;
}) {
  return (
    <span className="dv-math-frac">
      <span className="dv-math-num">{numerator}</span>
      <span className="dv-math-den">{denominator}</span>
    </span>
  );
}

export function InfoTooltip({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: "center" | "right" | "left";
}) {
  const modifierClass =
    align === "right"
      ? " dv-formula-tooltip--right"
      : align === "left"
        ? " dv-formula-tooltip--left"
        : "";
  return (
    <span className="dv-info-wrap">
      {INFO_ICON}
      <span className={`dv-formula-tooltip${modifierClass}`}>{children}</span>
    </span>
  );
}

export function TableEmptyState({
  isFetching,
  emptyMessage,
}: {
  isFetching: boolean;
  emptyMessage?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="dv-empty">
      {isFetching ? (
        <span className="dv-loading-inline">
          <span className="dv-spinner" aria-hidden="true" />
          <span>{t("dataViewer.fetchingData")}</span>
        </span>
      ) : (
        (emptyMessage ?? t("dataViewer.noData"))
      )}
    </div>
  );
}

export function ViewIcon({
  view,
  fiatCode,
  native = null,
}: {
  view: string;
  fiatCode: string;
  native?: ReactNode;
}) {
  if (view === "USD") return <UsdIcon />;
  if (view === "FIAT") return <FiatIcon code={fiatCode} />;
  return <>{native}</>;
}

export function IconValue({ text, icon }: { text: string; icon: ReactNode }) {
  return (
    <span className="dv-cell-with-icon">
      {text}
      {icon}
    </span>
  );
}

export function TotalCell({
  label,
  text,
  icon,
  accent,
}: {
  label?: string;
  text: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <>
      {label !== undefined && <span className="dv-total-cell-label">{label}</span>}
      <span
        className={`dv-total-cell-value${accent ? " dv-total-cell-value--accent" : ""} dv-cell-with-icon`}
      >
        {text}
        {icon}
      </span>
    </>
  );
}

export function DateCell({ date, groupByDay }: { date: string; groupByDay: boolean }) {
  return <td className="dv-cell-date">{groupByDay ? formatDate(date) : formatDateTime(date)}</td>;
}

export function DateHeaderCell({
  rows,
  value,
  onChange,
}: {
  rows: Array<{ date: string }>;
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);
  const rowDates = useMemo(() => rows.map((row) => row.date.slice(0, 10)), [rows]);
  return (
    <th>
      <DateRangeFilter value={value} onChange={onChange} {...dateBounds} dates={rowDates} />
    </th>
  );
}
