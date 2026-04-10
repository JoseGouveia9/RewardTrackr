import { useLayoutEffect, type RefObject } from "react";

// Reads each column's rendered width from the data table's header row (which
// already reflects auto-layout sizing for all content in that column), then
// applies those widths to both the totals table and the data table so their
// columns stay visually aligned.
//
// Wide/scroll tables (mining, simple-earn) keep their CSS pixel widths and
// scroll naturally via overflow-x on the wrapper – no min-width override needed.
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

    // Read the data table's header column widths after the CSS-driven reflow.
    // With table-layout: auto (set by CSS on mobile), these widths account for
    // the widest content in each column across all body rows.
    // getBoundingClientRect() forces a synchronous reflow after the reset above.
    const headerRow = data.tHead?.rows[0];
    if (!headerRow || headerRow.cells.length === 0) return;

    const colWidths: number[] = [];
    for (let i = 0; i < headerRow.cells.length; i++) {
      colWidths.push(headerRow.cells[i].getBoundingClientRect().width);
    }

    if (colWidths.every((w) => w === 0)) return;

    // Apply the data table's column widths to both tables and switch to fixed
    // layout so the browser honours them exactly. Both tables end up the same
    // width as the data table, keeping columns visually aligned without
    // inflating the total width beyond what the content actually needs.
    const applyFixed = (table: HTMLTableElement) => {
      table.querySelectorAll<HTMLElement>("col").forEach((col, i) => {
        if (i < colWidths.length && colWidths[i] > 0) {
          col.style.width = `${colWidths[i]}px`;
        }
      });
      table.style.tableLayout = "fixed";
    };
    applyFixed(totals);
    applyFixed(data);
  }); // no deps – re-run after every render so widths stay current
}
