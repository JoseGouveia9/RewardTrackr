import { useLayoutEffect, type RefObject } from "react";

// For each column, takes max(data-header width, totals-row width) so neither
// table clips its content. Then proportionally scales the result to the wider
// table's natural width, which keeps the total from exceeding the viewport for
// tables that already fit without scrolling.
//
// Wide tables (mining, --wide) keep their CSS pixel widths and overflow the
// wrapper naturally; no min-width override is needed here.
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

    // getBoundingClientRect() forces a synchronous reflow after the reset above
    // so we read the freshly-laid-out CSS-driven dimensions.

    // --- Measure data table header column widths ---
    const headerRow = data.tHead?.rows[0];
    if (!headerRow || headerRow.cells.length === 0) return;

    const colCount = headerRow.cells.length;
    const dataWidths = new Array<number>(colCount).fill(0);
    for (let i = 0; i < colCount; i++) {
      dataWidths[i] = headerRow.cells[i].getBoundingClientRect().width;
    }

    // --- Measure totals table – max per column across all rows ---
    const totalsWidths = new Array<number>(colCount).fill(0);
    for (const row of Array.from<HTMLTableRowElement>(totals.rows)) {
      for (let i = 0; i < Math.min(row.cells.length, colCount); i++) {
        totalsWidths[i] = Math.max(
          totalsWidths[i],
          row.cells[i].getBoundingClientRect().width,
        );
      }
    }

    // Per-column max so neither table clips its content
    const maxWidths = dataWidths.map((dw, i) => Math.max(dw, totalsWidths[i]));
    const totalMaxWidth = maxWidths.reduce((sum, w) => sum + w, 0);
    if (totalMaxWidth === 0) return;

    // Natural width of each table (≈ viewport for narrow tables; ≈ 750 px for mining)
    const dataTotal = dataWidths.reduce((sum, w) => sum + w, 0);
    const totalsTotal = totalsWidths.reduce((sum, w) => sum + w, 0);
    const targetWidth = Math.max(dataTotal, totalsTotal);

    // Scale maxWidths proportionally so they sum to targetWidth.
    // This preserves relative proportions while ensuring we never inflate the
    // table beyond what the content actually needs, keeping narrow tables within
    // the viewport and wide tables (mining) within their CSS pixel width.
    const scale = targetWidth / totalMaxWidth;
    const finalWidths = maxWidths.map((w) => Math.round(w * scale));

    // Apply the same column widths to both tables and switch to fixed layout
    // so the browser honours them exactly and both tables stay aligned.
    const applyFixed = (table: HTMLTableElement) => {
      table.querySelectorAll<HTMLElement>("col").forEach((col, i) => {
        if (i < finalWidths.length && finalWidths[i] > 0) {
          col.style.width = `${finalWidths[i]}px`;
        }
      });
      table.style.tableLayout = "fixed";
    };
    applyFixed(totals);
    applyFixed(data);
  }); // no deps – re-run after every render so widths stay current
}
