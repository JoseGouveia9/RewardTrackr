import { useLayoutEffect, useRef, type RefObject } from "react";

// Measures each column's min-content width from both the totals and data header
// rows. Both tables are temporarily shrunk to 1 px so cells report their
// natural content width rather than the inflated auto-layout width.
//
// Column width strategy (mobile only, ≤640 px):
//   • 2-column tables always use 50 / 50.
//   • Scrolling tables (total min-content > viewport): every column gets its
//     exact proportional min-content share.
//   • Tables that fit the viewport: col 0 (date) and all columns from index 2
//     onward get their exact min-content width; col 1 (type / asset) absorbs
//     all remaining viewport space so the table fills 100% exactly. This keeps
//     uniform 8 px cell padding throughout — every inter-column gap is 16 px
//     (8 right + 8 left), matching the outer gaps.
//
// Col 0 is ratcheted upward across renders so toggling group-by-day never
// shrinks the date column below the datetime format width.
export function useSyncTableColumns(
  totalsRef: RefObject<HTMLTableElement | null>,
  dataRef: RefObject<HTMLTableElement | null>,
) {
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
    totals.style.width = "1px";
    data.style.width = "1px";

    const totalsWidths = new Array<number>(colCount).fill(0);
    for (const row of Array.from<HTMLTableRowElement>(totals.rows)) {
      for (let i = 0; i < Math.min(row.cells.length, colCount); i++) {
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

    totals.style.width = "";
    data.style.width = "";

    // Per-column max so neither table clips its content
    const maxWidths = dataWidths.map((dw, i) => Math.max(dw, totalsWidths[i]));

    // Ratchet col 0 (date) upward so it never shrinks when group-by-day toggles
    maxWidths[0] = Math.max(maxWidths[0], maxCol0Ref.current);
    maxCol0Ref.current = maxWidths[0];

    const totalMaxWidth = maxWidths.reduce((sum, w) => sum + w, 0);
    if (totalMaxWidth === 0) return;

    const viewport = window.innerWidth;
    const tableWidth = Math.max(totalMaxWidth, viewport);

    // Build final column widths.
    // When the table fits the viewport, give all spare space to col 1 so the
    // table fills 100% and every inter-column gap stays equal (8 px + 8 px).
    const colWidths = [...maxWidths];
    if (totalMaxWidth <= viewport && colCount > 2) {
      const otherTotal = colWidths.reduce((s, w, i) => (i !== 1 ? s + w : s), 0);
      colWidths[1] = Math.max(colWidths[1], viewport - otherTotal);
    }

    const applyFixed = (table: HTMLTableElement) => {
      table.querySelectorAll<HTMLElement>("col").forEach((col, i) => {
        if (i < colWidths.length) {
          col.style.width = `${((colWidths[i] / tableWidth) * 100).toFixed(3)}%`;
        }
      });
      table.style.tableLayout = "fixed";
      if (tableWidth > viewport) {
        table.style.minWidth = `${tableWidth}px`;
      }
    };
    applyFixed(totals);
    applyFixed(data);
  }); // no deps – re-run after every render so widths stay current
}
