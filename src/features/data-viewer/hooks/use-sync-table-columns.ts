import { useLayoutEffect, useRef, type RefObject } from "react";

// Measures each column's min-content width from both the totals and data header
// rows so that column allocation is stable regardless of which body rows are
// currently visible. Both tables are temporarily shrunk to 1 px before
// measuring so cells report their natural content width rather than the
// inflated auto-layout width caused by empty columns absorbing spare space.
// Applies the max per column as percentage widths (always summing to 100%) so
// both tables fill the wrapper exactly and stay aligned.
// Col 0 (date) is ratcheted upward across renders: once the datetime format
// has been measured it never shrinks, keeping the date column the same width
// regardless of whether group-by-day is active.
// Special-case: 2-column tables always use 50/50.
// Only active on mobile (≤640 px); on wider screens CSS fixed layout handles it
// and any previously-applied inline styles are cleared.
export function useSyncTableColumns(
  totalsRef: RefObject<HTMLTableElement | null>,
  dataRef: RefObject<HTMLTableElement | null>,
) {
  // Tracks the maximum date-column (col 0) width seen across renders so that
  // toggling group-by-day never narrows the column below the datetime format width.
  const maxCol0Ref = useRef(0);

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

    const headerRow = data.tHead?.rows[0];
    if (!headerRow || headerRow.cells.length === 0) return;

    const colCount = headerRow.cells.length;

    // --- 2-column tables: always 50 / 50 ---
    if (colCount === 2) {
      const applyHalf = (table: HTMLTableElement) => {
        table.querySelectorAll<HTMLElement>("col").forEach((col) => {
          col.style.width = "50%";
        });
        table.style.tableLayout = "fixed";
      };
      applyHalf(totals);
      applyHalf(data);
      return;
    }

    // --- Measure both tables at min-content width ---
    // Setting width:1px forces each cell to report its natural content width
    // (longest unbreakable token + padding). This makes measurements stable:
    // they don't change when the user switches currency filters or navigates
    // pages, because we're not reading the inflated auto-layout widths.
    totals.style.width = "1px";
    data.style.width = "1px";

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

    const dataWidths: number[] = [];
    for (let i = 0; i < colCount; i++) {
      dataWidths.push(headerRow.cells[i].getBoundingClientRect().width);
    }

    // Restore CSS-driven widths
    totals.style.width = "";
    data.style.width = "";

    // Per-column max so neither table clips its content
    const maxWidths = dataWidths.map((dw, i) => Math.max(dw, totalsWidths[i]));

    // Ratchet col 0 (date) to the maximum seen across renders so the date column
    // never shrinks when the user toggles group-by-day. The datetime format is
    // wider than the date-only format; once measured it becomes the floor.
    maxWidths[0] = Math.max(maxWidths[0], maxCol0Ref.current);
    maxCol0Ref.current = maxWidths[0];

    const totalMaxWidth = maxWidths.reduce((sum, w) => sum + w, 0);
    if (totalMaxWidth === 0) return;

    // tableWidth ≥ viewport so narrow tables always fill the screen;
    // if content requirements exceed the viewport the table is slightly wider
    // and the wrapper scrolls a small amount.
    const tableWidth = Math.max(totalMaxWidth, window.innerWidth);

    // Divide by totalMaxWidth (not tableWidth) so percentages always sum to
    // 100% — every column gets a fair proportional share of the viewport and
    // the browser has no leftover space to dump arbitrarily into one column.
    const applyFixed = (table: HTMLTableElement) => {
      table.querySelectorAll<HTMLElement>("col").forEach((col, i) => {
        if (i < maxWidths.length) {
          col.style.width = `${((maxWidths[i] / totalMaxWidth) * 100).toFixed(3)}%`;
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
