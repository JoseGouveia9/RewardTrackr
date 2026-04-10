import { useLayoutEffect, type RefObject } from "react";

// Measures each column's natural auto-layout width from both the totals table
// and the data table, then sets every <col> to max(totalsWidth, dataWidth) so
// the two tables share identical column widths and stay aligned.
// Only active on mobile (≤640 px); on wider screens CSS fixed layout handles it
// and any previously-applied inline widths are cleared.
export function useSyncTableColumns(
  totalsRef: RefObject<HTMLTableElement | null>,
  dataRef: RefObject<HTMLTableElement | null>,
) {
  useLayoutEffect(() => {
    const totals = totalsRef.current;
    const data = dataRef.current;
    if (!totals || !data) return;

    // Reset inline widths first so tables lay out naturally
    const resetCols = (table: HTMLTableElement) =>
      table.querySelectorAll<HTMLElement>("col").forEach((col) => {
        col.style.width = "";
      });
    resetCols(totals);
    resetCols(data);

    // On desktop let CSS handle column widths
    if (!window.matchMedia("(max-width: 640px)").matches) return;

    // Measure natural column widths.
    // getBoundingClientRect() forces a synchronous reflow so the reset above
    // is fully applied before we read the dimensions.
    const colCount = totals.rows[0]?.cells.length ?? 0;
    if (colCount === 0) return;

    const maxWidths = new Array<number>(colCount).fill(0);

    // Totals table – scan every row (some tabs have multiple totals rows)
    for (const row of Array.from<HTMLTableRowElement>(totals.rows)) {
      for (let i = 0; i < row.cells.length; i++) {
        maxWidths[i] = Math.max(maxWidths[i], row.cells[i].getBoundingClientRect().width);
      }
    }

    // Data table – use the header row
    const headerRow = data.tHead?.rows[0];
    if (headerRow) {
      for (let i = 0; i < headerRow.cells.length; i++) {
        maxWidths[i] = Math.max(maxWidths[i], headerRow.cells[i].getBoundingClientRect().width);
      }
    }

    // Apply max widths to <col> elements in both tables
    const applyCols = (table: HTMLTableElement) =>
      table.querySelectorAll<HTMLElement>("col").forEach((col, i) => {
        if (i < maxWidths.length && maxWidths[i] > 0) {
          col.style.width = `${maxWidths[i]}px`;
        }
      });
    applyCols(totals);
    applyCols(data);
  }); // no deps – re-run after every render so widths stay current
}
