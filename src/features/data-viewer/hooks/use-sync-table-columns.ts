import { useLayoutEffect, useRef, type RefObject } from "react";

// Syncs column widths between totals and data tables on mobile (≤640 px).
// Measures min-content from both tables; col 1 absorbs spare space so narrow tables fill 100%.
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
        totalsWidths[i] = Math.max(totalsWidths[i], row.cells[i].getBoundingClientRect().width);
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

    // Use wrapper clientWidth (not window.innerWidth) so column % sums to exactly 100% of the table.
    const availableWidth =
      (data.parentElement?.clientWidth ?? window.innerWidth) || window.innerWidth;
    const tableWidth = Math.max(totalMaxWidth, availableWidth);

    // When the table fits, give spare space to col 1 so the table fills 100%.
    const colWidths = [...maxWidths];
    if (totalMaxWidth <= availableWidth && colCount > 2) {
      const otherTotal = colWidths.reduce((s, w, i) => (i !== 1 ? s + w : s), 0);
      colWidths[1] = Math.max(colWidths[1], availableWidth - otherTotal);
    }

    const applyFixed = (table: HTMLTableElement) => {
      table.querySelectorAll<HTMLElement>("col").forEach((col, i) => {
        if (i < colWidths.length) {
          col.style.width = `${((colWidths[i] / tableWidth) * 100).toFixed(3)}%`;
        }
      });
      table.style.tableLayout = "fixed";
      if (tableWidth > availableWidth) {
        table.style.minWidth = `${tableWidth}px`;
      }
    };
    applyFixed(totals);
    applyFixed(data);
  }); // no deps – re-run after every render so widths stay current
}
