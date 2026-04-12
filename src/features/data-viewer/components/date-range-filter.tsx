import { useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "../types";
import { EMPTY_DATE_RANGE, DATE_PRESETS } from "../utils/constants";
import { isDateRangeActive } from "../utils";
import { useFilterDropdownPos } from "../hooks/use-filter-dropdown-pos";
import { MiniCalendar, CAL_MONTHS } from "./mini-calendar";

// A styled custom dropdown matching the fiat-dropdown look, for small option sets.
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

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="dv-cal-sel-wrap">
      <button type="button" className="dv-cal-sel-trigger" onClick={() => setOpen((p) => !p)}>
        <span>{selectedLabel}</span>
        <span className={`dv-cal-sel-caret${open ? " open" : ""}`}>⌃</span>
      </button>
      {open && (
        <div className="dv-cal-sel-menu">
          {options.map((o) => (
            <div
              key={o.value}
              className={`dv-cal-sel-option${o.value === value ? " selected" : ""}${o.disabled ? " disabled" : ""}`}
              onClick={() => {
                if (!o.disabled) {
                  onChange(o.value);
                  setOpen(false);
                }
              }}
            >
              {o.label}
              {o.value === value && <span className="dv-cal-sel-check">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Renders a date-range filter button that opens a calendar picker with presets and apply/clear actions.
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
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState("");
  const today = useMemo(() => new Date(), []);
  const initDate = maxDate ? new Date(maxDate + "T00:00:00") : today;
  const [calYear, setCalYear] = useState(initDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initDate.getMonth());
  const ref = useRef<HTMLDivElement>(null);
  const { btnRef, dropRef, style: dropStyle, capturePos } = useFilterDropdownPos(open, () => setOpen(false));

  // Derive available years and year-month combos from entry dates when provided
  const availableYearMonths = useMemo<Set<string>>(() => {
    if (!dates?.length) return new Set();
    const s = new Set<string>();
    for (const d of dates) s.add(d.slice(0, 7)); // "YYYY-MM"
    return s;
  }, [dates]);

  const yearOptions = useMemo(() => {
    if (availableYearMonths.size > 0) {
      const ys = [...new Set([...availableYearMonths].map((ym) => Number(ym.slice(0, 4))))].sort();
      return ys.map((y) => ({ label: String(y), value: y }));
    }
    return Array.from({ length: 8 }, (_, i) => today.getFullYear() - 5 + i).map((y) => ({
      label: String(y),
      value: y,
    }));
  }, [availableYearMonths, today]);

  const monthOptions = useMemo(() => {
    return CAL_MONTHS.map((m, i) => {
      const ym = `${calYear}-${String(i + 1).padStart(2, "0")}`;
      const disabled = availableYearMonths.size > 0 && !availableYearMonths.has(ym);
      return { label: m, value: i, disabled };
    });
  }, [availableYearMonths, calYear]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Captures the button position and opens the date picker with the current value pre-loaded.
  function openPicker() {
    capturePos();
    setPending({ ...value });
    setPicking(false);
    setHover("");
    setOpen(true);
  }

  // Commits the pending range selection and notifies the parent.
  function handleApply() {
    onChange(pending);
    setPicking(false);
  }

  // Resets the range filter to empty and notifies the parent.
  function handleClear() {
    onChange(EMPTY_DATE_RANGE);
    setPending(EMPTY_DATE_RANGE);
    setPicking(false);
    setHover("");
  }

  // Applies a preset date range to the pending selection and navigates the calendar to the end date.
  function handlePreset(p: (typeof DATE_PRESETS)[0]) {
    const to = p.to();
    setPending({ from: p.from(), to });
    setPicking(false);
    setHover("");
    if (to) {
      const d = new Date(to + "T00:00:00");
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
    }
  }

  // Handles a calendar day click, setting the range start on first click and end on second.
  function handleDayClick(d: string) {
    if (!picking) {
      setPending({ from: d, to: "" });
      setPicking(true);
      setHover(d);
    } else {
      const from = pending.from;
      setPending(d < from ? { from: d, to: from } : { from, to: d });
      setPicking(false);
      setHover("");
    }
  }

  const activePreset =
    DATE_PRESETS.find((p) => p.from() === pending.from && p.to() === pending.to)?.label ?? null;

  return (
    <div ref={ref} className="dv-col-filter">
      <button
        ref={btnRef}
        type="button"
        className={`dv-col-filter-btn${isDateRangeActive(value) ? " dv-col-filter-btn--active" : ""}`}
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
        Date
      </button>

      {open && (
        <div ref={dropRef} className="dv-col-filter-dropdown" style={dropStyle}>
          <div className="dv-filter-date-layout">
            {/* Left: presets + actions */}
            <div className="dv-filter-date-presets">
              <div className="dv-filter-presets-list">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={`dv-filter-preset-btn${activePreset === p.label ? " dv-filter-preset-btn--active" : ""}`}
                    onClick={() => handlePreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="dv-filter-actions">
                <button type="button" className="dv-filter-apply-btn" onClick={handleApply}>
                  Apply
                </button>
                <button type="button" className="dv-filter-clear-btn" onClick={handleClear}>
                  Clear
                </button>
              </div>
            </div>

            {/* Right: single calendar with selects */}
            <div className="dv-filter-cals">
              <div className="dv-cal-header">
                <CalSelect value={calMonth} options={monthOptions} onChange={setCalMonth} />
                <CalSelect value={calYear} options={yearOptions} onChange={setCalYear} />
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
