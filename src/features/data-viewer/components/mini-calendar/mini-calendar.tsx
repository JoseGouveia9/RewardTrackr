import { useTranslation } from "react-i18next";
import type { DateRange } from "../../types";
import { buildIsoDate } from "../../utils";

// pt-PT Intl returns full day/month names for 'short'; use pt-BR which gives proper abbreviations
const CAL_LOCALE_MAP: Record<string, string> = { "pt-PT": "pt-BR" };
function calLocale(lang: string) {
  return CAL_LOCALE_MAP[lang] ?? lang;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getLocalizedMonths(locale: string): string[] {
  const l = calLocale(locale);
  return Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(l, { month: "long" }).format(new Date(2024, i, 1)),
  );
}

export function MiniCalendar({
  year,
  month,
  pending,
  picking,
  hover,
  minDate,
  maxDate,
  onDayClick,
  onDayHover,
}: {
  year: number;
  month: number;
  pending: DateRange;
  picking: boolean;
  hover: string;
  minDate?: string;
  maxDate?: string;
  onDayClick: (iso: string) => void;
  onDayHover: (iso: string) => void;
}) {
  const { i18n } = useTranslation();
  // Jan 6, 2025 is a Monday — generate 7 short day names starting from Monday
  const dayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(calLocale(i18n.language), { weekday: "short" }).format(
      new Date(2025, 0, 6 + i),
    ),
  );
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const prevMonthDays = new Date(year, month, 0).getDate();

  const rangeEnd = picking && hover ? hover : pending.to;
  const rangeStart =
    pending.from && rangeEnd ? (pending.from <= rangeEnd ? pending.from : rangeEnd) : pending.from;
  const rangeEndNorm =
    pending.from && rangeEnd ? (pending.from <= rangeEnd ? rangeEnd : pending.from) : pending.from;

  const cells: { day: number; iso: string; out: boolean }[] = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ day: d, iso: buildIsoDate(py, pm, d), out: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: buildIsoDate(year, month, d), out: false });
  }
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ day: d, iso: buildIsoDate(ny, nm, d), out: true });
  }

  return (
    <div className="dv-cal-grid">
      {dayNames.map((d) => (
        <span key={d} className="dv-cal-dow">
          {d}
        </span>
      ))}
      {cells.map(({ day, iso: cellIso, out }) => {
        const isDisabled =
          out || (!!minDate && cellIso < minDate) || (!!maxDate && cellIso > maxDate);
        const isSel = !isDisabled && (cellIso === pending.from || cellIso === pending.to);
        const isInRange =
          !isDisabled &&
          !!rangeStart &&
          !!rangeEndNorm &&
          cellIso > rangeStart &&
          cellIso < rangeEndNorm;
        const hasRange = !!rangeStart && !!rangeEndNorm && rangeStart !== rangeEndNorm;
        const isSelStart = hasRange && !isDisabled && cellIso === rangeStart;
        const isSelEnd = hasRange && !isDisabled && cellIso === rangeEndNorm;
        return (
          <button
            key={cellIso + (out ? "o" : "")}
            type="button"
            className={`dv-cal-day${isDisabled ? " dv-cal-day--out" : ""}${isSel ? " dv-cal-day--sel" : ""}${isSelStart ? " dv-cal-day--sel-start" : ""}${isSelEnd ? " dv-cal-day--sel-end" : ""}${isInRange ? " dv-cal-day--in-range" : ""}`}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onDayClick(cellIso);
            }}
            onMouseEnter={() => {
              if (!isDisabled) onDayHover(cellIso);
            }}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}
