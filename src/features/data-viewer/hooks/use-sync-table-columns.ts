import { useLayoutEffect, type RefObject } from "react";

// Per column: takes max(data-header width, totals min-content width).
// The totals table is temporarily shrunk to 1 px so each cell reports its
// natural content width rather than the inflated auto-layout width caused by
// empty columns absorbing redistribution space.
// Column widths are stored as percentages of the final table width so they
// always fill the table exactly. Wide tables (mining, --wide) keep their CSS
// pixel widths and overflow the wrapper naturally via min-width.
// Only active on mobile (≤640 px); on wider screens CSS fixed layout handles it
// and any previously-applied inline styles are cleared.
export function useSyncTableColumns(
  totalsRef: RefObject<HTMLTableElement | null>,
  dataRef: RefObject<HTMLTableElement | null>,
) {
  useLayoutEffect(() => {
    const totals = totalsRef.current;
    const data = dataRef.current;
    if (!totals || !data) return;

    // Reset inline overrides so tables fall back to CSS-driven layout
    const resetTable = (table: HTMLTableElement) => {
      table.style.tableLayout = "";
      table.style.minWidth = "";
      table.querySelectorAll<HTMLElement>("col").forEach((col) => {
        col.style.width = "";
      });
    };
    resetTable(totals);
    resetTable(data);

    // On desktop let CSS handle column widths
    if (!window.matchMedia("(max-width: 640px)").matches) return;

    // --- Step 1: Measure data table header column widths (CSS-driven auto layout) ---
    // getBoundingClientRect() forces a synchronous reflow after the reset above.
    const headerRow = data.tHead?.rows[0];
    if (!headerRow || headerRow.cells.length === 0) return;

    const colCount = headerRow.cells.length;
    const dataWidths: number[] = [];
    for (let i = 0; i < colCount; i++) {
      dataWidths.push(headerRow.cells[i].getBoundingClientRect().width);
    }

    // --- Step 2: Measure totals at min-content width ---
    // Setting width:1px forces each cell to report its natural content width
    // (longest unbreakable token) rather than the inflated auto-layout width
    // that results from empty columns absorbing redistribution space.
    totals.style.width = "1px";
    const totalsWidths = new Array<number>(colCount).fill(0);
    for (const row of Array.from<HTMLTableRowElement>(totals.rows)) {
      for (let i = 0; i < Math.min(row.cells.length, colCount); i++) {
        // getBoundingClientRect forces reflow with the 1 px width in effect
        totalsWidths[i] = Math.max(
          totalsWidths[i],
          row.cells[i].getBoundingClientRect().width,
        );
      }
    }
    totals.style.width = ""; // restore

    // --- Step 3: Per-column max and final table width ---
    const maxWidths = dataWidths.map((dw, i) => Math.max(dw, totalsWidths[i]));
    const totalMaxWidth = maxWidths.reduce((sum, w) => sum + w, 0);
    if (totalMaxWidth === 0) return;

    // tableWidth is at least the viewport so narrow tables always fill the screen;
    // if content requirements exceed the viewport (e.g. very long BTC values) the
    // table is slightly wider and the wrapper scrolls a tiny amount.
    const tableWidth = Math.max(totalMaxWidth, window.innerWidth);

    // --- Step 4: Apply ---
    // Percentage widths ensure columns fill the table exactly regardless of
    // whether it equals the viewport or is a few pixels wider.
    const applyFixed = (table: HTMLTableElement) => {
      table.querySelectorAll<HTMLElement>("col").forEach((col, i) => {
        if (i < maxWidths.length) {
          col.style.width = `${((maxWidths[i] / tableWidth) * 100).toFixed(3)}%`;
        }
      });
      table.style.tableLayout = "fixed";
      if (tableWidth > window.innerWidth) {
        table.style.minWidth = `${tableWidth}px`;
      }
    };
    applyFixed(totals);
    applyFixed(data);
  }); // no deps – re-run after every render so widths stay current
}
