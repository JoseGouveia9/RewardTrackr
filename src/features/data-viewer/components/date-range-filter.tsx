import { useEffect, useRef, useState } from "react";
import type { DateRange } from "../types";
import { EMPTY_DATE_RANGE, DATE_PRESETS } from "../utils/constants";
import { isDateRangeActive } from "../utils";
import { useFilterDropdownPos } from "../hooks/use-filter-dropdown-pos";
import { MiniCalendar, CAL_MONTHS } from "./mini-calendar";

/** Renders a date-range filter button that opens a calendar picker with presets and apply/clear actions. */
export function DateRangeFilter({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState("");
  const today = new Date();
  const initDate = maxDate ? new Date(maxDate + "T00:00:00") : today;
  const [calYear, setCalYear] = useState(initDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initDate.getMonth());
  const ref = useRef<HTMLDivElement>(null);
  const years = Array.from({ length: 8 }, (_, i) => today.getFullYear() - 5 + i);
  const { btnRef, style: dropStyle, capturePos } = useFilterDropdownPos(open);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /** Captures the button position and opens the date picker with the current value pre-loaded. */
  function openPicker() {
    capturePos();
    setPending({ ...value });
    setPicking(false);
    setHover("");
    setOpen(true);
  }

  /** Commits the pending range selection and notifies the parent. */
  function handleApply() {
    onChange(pending);
    setPicking(false);
  }

  /** Resets the range filter to empty and notifies the parent. */
  function handleClear() {
    onChange(EMPTY_DATE_RANGE);
    setPending(EMPTY_DATE_RANGE);
    setPicking(false);
    setHover("");
  }

  /** Applies a preset date range to the pending selection. */
  function handlePreset(p: (typeof DATE_PRESETS)[0]) {
    setPending({ from: p.from(), to: p.to() });
    setPicking(false);
    setHover("");
  }

  /** Handles a calendar day click, setting the range start on first click and end on second. */
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
        <div className="dv-col-filter-dropdown" style={dropStyle}>
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
                <select
                  className="dv-cal-select"
                  value={calMonth}
                  onChange={(e) => setCalMonth(Number(e.target.value))}
                >
                  {CAL_MONTHS.map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  className="dv-cal-select"
                  value={calYear}
                  onChange={(e) => setCalYear(Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
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
