import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DateRange } from "../../types";
import { EMPTY_DATE_RANGE, DATE_PRESETS } from "../../utils/constants";
import { isDateRangeActive } from "../../utils";
import { MiniCalendar, getLocalizedMonths } from "./components/mini-calendar/mini-calendar";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { ChevronDownIcon, FilterIcon } from "@/components/icons";

function CalendarSelect({
  value,
  options,
  onChange,
}: {
  value: number;
  options: { label: string; value: number; disabled?: boolean }[];
  onChange: (nextValue: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? String(value);
  useOutsideClick(wrapRef, () => setOpen(false), open);

  return (
    <div ref={wrapRef} className="dv-cal-sel-wrap">
      <button
        type="button"
        className="dv-cal-sel-trigger"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span>{selectedLabel}</span>
        <ChevronDownIcon
          className={`dv-cal-sel-caret${open ? " dv-cal-sel-caret--open" : ""}`}
          width={9}
          height={6}
        />
      </button>
      {open && (
        <div className="dv-cal-sel-menu">
          {options.map((option) => (
            <div
              key={option.value}
              className={`dv-cal-sel-option${option.value === value ? " dv-cal-sel-option--selected" : ""}${option.disabled ? " dv-cal-sel-option--disabled" : ""}`}
              onClick={() => {
                if (!option.disabled) {
                  onChange(option.value);
                  setOpen(false);
                }
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DateRangeFilter({
  value,
  onChange,
  minDate,
  maxDate,
  dates,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  minDate?: string;
  maxDate?: string;
  dates?: string[];
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const initDate = maxDate ? new Date(maxDate + "T00:00:00") : new Date();
  const [calendarYear, setCalendarYear] = useState(initDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(initDate.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  const availableYearMonths = useMemo<Set<string>>(() => {
    if (!dates?.length) return new Set();
    const yearMonths = new Set<string>();
    for (const date of dates) yearMonths.add(date.slice(0, 7));
    return yearMonths;
  }, [dates]);

  const dateSet = useMemo(() => new Set(dates ?? []), [dates]);

  const availablePresets = useMemo(() => {
    if (!dates?.length) return DATE_PRESETS;
    return DATE_PRESETS.filter((preset) => {
      const from = preset.from();
      const to = preset.to();
      return [...dateSet].some((date) => date >= from && date <= to);
    });
  }, [dateSet, dates]);

  const yearOptions = useMemo(() => {
    if (availableYearMonths.size > 0) {
      const years = [
        ...new Set([...availableYearMonths].map((yearMonth) => Number(yearMonth.slice(0, 4)))),
      ].sort();
      return years.map((year) => ({ label: String(year), value: year }));
    }
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, offset) => currentYear - 5 + offset).map((year) => ({
      label: String(year),
      value: year,
    }));
  }, [availableYearMonths]);

  const monthOptions = useMemo(() => {
    const all = getLocalizedMonths(i18n.language).map((monthName, monthIndex) => {
      const yearMonth = `${calendarYear}-${String(monthIndex + 1).padStart(2, "0")}`;
      return { label: monthName, value: monthIndex, hasData: availableYearMonths.has(yearMonth) };
    });
    if (availableYearMonths.size === 0) return all.map(({ label, value }) => ({ label, value }));
    const withData = all.filter((option) => option.hasData).map((option) => option.value);
    if (withData.length === 0) return [];
    const min = Math.min(...withData);
    const max = Math.max(...withData);
    return all
      .filter((option) => option.value >= min && option.value <= max)
      .map(({ label, value }) => ({ label, value }));
  }, [availableYearMonths, calendarYear, i18n.language]);

  useEffect(() => {
    if (monthOptions.length === 0) return;
    if (!monthOptions.some((option) => option.value === calendarMonth)) {
      setCalendarMonth(monthOptions[monthOptions.length - 1].value);
    }
  }, [monthOptions, calendarMonth]);

  useOutsideClick(ref, () => setOpen(false), open);

  function handleYearChange(year: number) {
    setCalendarYear(year);
    if (availableYearMonths.size > 0) {
      const months = [...availableYearMonths]
        .filter((yearMonth) => yearMonth.startsWith(`${year}-`))
        .map((yearMonth) => Number(yearMonth.slice(5, 7)) - 1);
      if (months.length > 0) setCalendarMonth(Math.max(...months));
    }
  }

  function openPicker() {
    setPending({ ...value });
    setActivePreset(null);
    setPicking(false);
    setHover("");
    setOpen(true);
  }

  function handleApply() {
    onChange(pending);
    setPicking(false);
    setOpen(false);
  }

  function handleClear() {
    onChange(EMPTY_DATE_RANGE);
    setPending(EMPTY_DATE_RANGE);
    setActivePreset(null);
    setPicking(false);
    setHover("");
    setOpen(false);
  }

  function handlePreset(preset: (typeof DATE_PRESETS)[0]) {
    let from = preset.from();
    let to = preset.to();
    if (minDate && from < minDate) from = minDate;
    if (maxDate && to > maxDate) to = maxDate;
    setPending({ from, to });
    setActivePreset(preset.label);
    setPicking(false);
    setHover("");
    const anchor = to || from;
    if (anchor) {
      const anchorDate = new Date(anchor + "T00:00:00");
      setCalendarYear(anchorDate.getFullYear());
      setCalendarMonth(anchorDate.getMonth());
    }
  }

  function handleDayClick(day: string) {
    if (!picking) {
      setPending({ from: day, to: "" });
      setActivePreset(null);
      setPicking(true);
      setHover(day);
    } else {
      const from = pending.from;
      setPending(day < from ? { from: day, to: from } : { from, to: day });
      setActivePreset(null);
      setPicking(false);
      setHover("");
    }
  }

  return (
    <div ref={ref} className="dv-column-filter">
      <button
        type="button"
        className={`dv-column-filter-button${isDateRangeActive(value) ? " dv-column-filter-button--active" : ""}`}
        onClick={openPicker}
      >
        <FilterIcon />
        {t("dataViewer.date")}
      </button>

      {open && (
        <div className="dv-column-filter-dropdown">
          <div className="dv-filter-date-layout">
            {}
            <div className="dv-filter-date-presets">
              <div className="dv-filter-presets-list">
                {availablePresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`dv-filter-preset-button${activePreset === preset.label ? " dv-filter-preset-button--active" : ""}`}
                    onClick={() => handlePreset(preset)}
                  >
                    {t(preset.label)}
                  </button>
                ))}
              </div>
              <div className="dv-filter-actions">
                <button type="button" className="dv-filter-apply-button" onClick={handleApply}>
                  {t("common.apply")}
                </button>
                <button type="button" className="dv-filter-clear-button" onClick={handleClear}>
                  {t("common.clear")}
                </button>
              </div>
            </div>

            {}
            <div className="dv-filter-calendars">
              <div className="dv-cal-header">
                <CalendarSelect
                  value={calendarMonth}
                  options={monthOptions}
                  onChange={setCalendarMonth}
                />
                <CalendarSelect
                  value={calendarYear}
                  options={yearOptions}
                  onChange={handleYearChange}
                />
              </div>
              <MiniCalendar
                year={calendarYear}
                month={calendarMonth}
                pending={pending}
                picking={picking}
                hover={hover}
                minDate={minDate}
                maxDate={maxDate}
                onDayClick={handleDayClick}
                onDayHover={setHover}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
