import { useLayoutEffect, type RefObject } from "react";

// Measures each column's natural auto-layout width from both the totals table
// and the data table, then sets every <col> to max(totalsWidth, dataWidth) so
// the two tables share identical column widths and stay aligned.
// Also switches both tables to fixed layout and sets min-width = sum of column
// widths, so content-wide tables overflow the scrollable wrapper on mobile.
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

    // CSS provides table-layout: auto on mobile, so tables are in auto mode now.
    // getBoundingClientRect() forces a synchronous reflow after the reset above
    // so we read the freshly-laid-out dimensions.
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

    const totalWidth = maxWidths.reduce((sum, w) => sum + w, 0);
    if (totalWidth === 0) return;

    // Apply the same column widths to both tables and switch to fixed layout so
    // the browser honours the widths exactly. min-width = totalWidth ensures the
    // table overflows the wrapper (triggering overflow-x scroll) when the content
    // is wider than the viewport; CSS width:100% still lets it fill the screen
    // when there is spare space.
    const applyFixed = (table: HTMLTableElement) => {
      table.querySelectorAll<HTMLElement>("col").forEach((col, i) => {
        if (i < maxWidths.length && maxWidths[i] > 0) {
          col.style.width = `${maxWidths[i]}px`;
        }
      });
      table.style.tableLayout = "fixed";
      table.style.minWidth = `${totalWidth}px`;
    };
    applyFixed(totals);
    applyFixed(data);
  }); // no deps – re-run after every render so widths stay current
}
