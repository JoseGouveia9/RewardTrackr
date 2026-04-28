import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DateRange } from "../../types";
import { EMPTY_DATE_RANGE, DATE_PRESETS } from "../../utils/constants";
import { isDateRangeActive } from "../../utils";
import { MiniCalendar, getLocalizedMonths } from "../mini-calendar/mini-calendar";
import { useOutsideClick } from "../../hooks/use-outside-click";

function CalSelect({
  value,
  options,
  onChange,
}: {
  value: number;
  options: { label: string; value: number; disabled?: boolean }[];
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? String(value);
  useOutsideClick(wrapRef, () => setOpen(false), open);

  return (
    <div ref={wrapRef} className="dv-cal-sel-wrap">
      <button type="button" className="dv-cal-sel-trigger" onClick={() => setOpen((p) => !p)}>
        <span>{selectedLabel}</span>
        <span className={`dv-cal-sel-caret${open ? " dv-cal-sel-caret--open" : ""}`}>⌃</span>
      </button>
      {open && (
        <div className="dv-cal-sel-menu">
          {options.map((o) => (
            <div
              key={o.value}
              className={`dv-cal-sel-option${o.value === value ? " dv-cal-sel-option--selected" : ""}${o.disabled ? " dv-cal-sel-option--disabled" : ""}`}
              onClick={() => {
                if (!o.disabled) {
                  onChange(o.value);
                  setOpen(false);
                }
              }}
            >
              {o.label}
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
  onChange: (v: DateRange) => void;
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
  const [calYear, setCalYear] = useState(initDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initDate.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  const availableYearMonths = useMemo<Set<string>>(() => {
    if (!dates?.length) return new Set();
    const s = new Set<string>();
    for (const d of dates) s.add(d.slice(0, 7));
    return s;
  }, [dates]);

  const dateSet = useMemo(() => new Set(dates ?? []), [dates]);

  const availablePresets = useMemo(() => {
    if (!dates?.length) return DATE_PRESETS;
    return DATE_PRESETS.filter((p) => {
      const from = p.from();
      const to = p.to();
      return [...dateSet].some((d) => d >= from && d <= to);
    });
  }, [dateSet, dates]);

  const yearOptions = useMemo(() => {
    if (availableYearMonths.size > 0) {
      const ys = [...new Set([...availableYearMonths].map((ym) => Number(ym.slice(0, 4))))].sort();
      return ys.map((y) => ({ label: String(y), value: y }));
    }
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => currentYear - 5 + i).map((y) => ({
      label: String(y),
      value: y,
    }));
  }, [availableYearMonths]);

  const monthOptions = useMemo(() => {
    const all = getLocalizedMonths(i18n.language).map((m, i) => {
      const ym = `${calYear}-${String(i + 1).padStart(2, "0")}`;
      return { label: m, value: i, hasData: availableYearMonths.has(ym) };
    });
    if (availableYearMonths.size === 0) return all.map(({ label, value }) => ({ label, value }));
    const withData = all.filter((o) => o.hasData).map((o) => o.value);
    if (withData.length === 0) return [];
    const min = Math.min(...withData);
    const max = Math.max(...withData);
    return all
      .filter((o) => o.value >= min && o.value <= max)
      .map(({ label, value }) => ({ label, value }));
  }, [availableYearMonths, calYear, i18n.language]);

  useEffect(() => {
    if (monthOptions.length === 0) return;
    if (!monthOptions.some((o) => o.value === calMonth)) {
      setCalMonth(monthOptions[monthOptions.length - 1].value);
    }
  }, [monthOptions, calMonth]);

  useOutsideClick(ref, () => setOpen(false), open);

  function handleYearChange(y: number) {
    setCalYear(y);
    if (availableYearMonths.size > 0) {
      const months = [...availableYearMonths]
        .filter((ym) => ym.startsWith(`${y}-`))
        .map((ym) => Number(ym.slice(5, 7)) - 1);
      if (months.length > 0) setCalMonth(Math.max(...months));
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
  }

  function handleClear() {
    onChange(EMPTY_DATE_RANGE);
    setPending(EMPTY_DATE_RANGE);
    setActivePreset(null);
    setPicking(false);
    setHover("");
  }

  function handlePreset(p: (typeof DATE_PRESETS)[0]) {
    let from = p.from();
    let to = p.to();
    if (minDate && from < minDate) from = minDate;
    if (maxDate && to > maxDate) to = maxDate;
    setPending({ from, to });
    setActivePreset(p.label);
    setPicking(false);
    setHover("");
    const anchor = to || from;
    if (anchor) {
      const d = new Date(anchor + "T00:00:00");
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
    }
  }

  function handleDayClick(d: string) {
    if (!picking) {
      setPending({ from: d, to: "" });
      setActivePreset(null);
      setPicking(true);
      setHover(d);
    } else {
      const from = pending.from;
      setPending(d < from ? { from: d, to: from } : { from, to: d });
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
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {t("dataViewer.date")}
      </button>

      {open && (
        <div className="dv-column-filter-dropdown">
          <div className="dv-filter-date-layout">
            {}
            <div className="dv-filter-date-presets">
              <div className="dv-filter-presets-list">
                {availablePresets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={`dv-filter-preset-button${activePreset === p.label ? " dv-filter-preset-button--active" : ""}`}
                    onClick={() => handlePreset(p)}
                  >
                    {t(p.label)}
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
                <CalSelect value={calMonth} options={monthOptions} onChange={setCalMonth} />
                <CalSelect value={calYear} options={yearOptions} onChange={handleYearChange} />
              </div>
              <MiniCalendar
                year={calYear}
                month={calMonth}
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
