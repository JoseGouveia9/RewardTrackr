import { useTranslation } from "react-i18next";
import type { DateRange } from "@/features/records/types";
import { buildIsoDate } from "@/features/records/utils";

const CALENDAR_LOCALE_MAP: Record<string, string> = { "pt-PT": "pt-BR" };

/**
 * pt-PT Intl returns full names for "short" formats, so pt-BR is used to get proper
 * abbreviations.
 */
function resolveCalendarLocale(language: string) {
  return CALENDAR_LOCALE_MAP[language] ?? language;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getLocalizedMonths(locale: string): string[] {
  const calendarLocale = resolveCalendarLocale(locale);
  return Array.from({ length: 12 }, (_, monthIndex) =>
    new Intl.DateTimeFormat(calendarLocale, { month: "long" }).format(
      new Date(2024, monthIndex, 1),
    ),
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
  const dayNames = Array.from({ length: 7 }, (_, dayOffset) =>
    new Intl.DateTimeFormat(resolveCalendarLocale(i18n.language), { weekday: "short" }).format(
      new Date(2025, 0, 6 + dayOffset),
    ),
  );
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const previousMonthDays = new Date(year, month, 0).getDate();

  const rangeEnd = picking && hover ? hover : pending.to;
  const rangeStart =
    pending.from && rangeEnd ? (pending.from <= rangeEnd ? pending.from : rangeEnd) : pending.from;
  const rangeEndNormalized =
    pending.from && rangeEnd ? (pending.from <= rangeEnd ? rangeEnd : pending.from) : pending.from;

  const cells: { day: number; iso: string; out: boolean }[] = [];
  for (let offset = firstDow - 1; offset >= 0; offset--) {
    const day = previousMonthDays - offset;
    const previousMonth = month === 0 ? 11 : month - 1;
    const previousYear = month === 0 ? year - 1 : year;
    cells.push({ day, iso: buildIsoDate(previousYear, previousMonth, day), out: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, iso: buildIsoDate(year, month, day), out: false });
  }
  const trailing = 42 - cells.length;
  for (let day = 1; day <= trailing; day++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    cells.push({ day, iso: buildIsoDate(nextYear, nextMonth, day), out: true });
  }

  return (
    <div className="dv-cal-grid">
      {dayNames.map((dayName) => (
        <span key={dayName} className="dv-cal-dow">
          {dayName}
        </span>
      ))}
      {cells.map(({ day, iso: cellIso, out }) => {
        const isDisabled =
          out || (!!minDate && cellIso < minDate) || (!!maxDate && cellIso > maxDate);
        const isSelected = !isDisabled && (cellIso === pending.from || cellIso === pending.to);
        const isInRange =
          !isDisabled &&
          !!rangeStart &&
          !!rangeEndNormalized &&
          cellIso > rangeStart &&
          cellIso < rangeEndNormalized;
        const hasRange = !!rangeStart && !!rangeEndNormalized && rangeStart !== rangeEndNormalized;
        const isSelectedStart = hasRange && !isDisabled && cellIso === rangeStart;
        const isSelectedEnd = hasRange && !isDisabled && cellIso === rangeEndNormalized;
        return (
          <button
            key={cellIso + (out ? "o" : "")}
            type="button"
            className={`dv-cal-day${isDisabled ? " dv-cal-day--out" : ""}${isSelected ? " dv-cal-day--sel" : ""}${isSelectedStart ? " dv-cal-day--sel-start" : ""}${isSelectedEnd ? " dv-cal-day--sel-end" : ""}${isInRange ? " dv-cal-day--in-range" : ""}`}
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
