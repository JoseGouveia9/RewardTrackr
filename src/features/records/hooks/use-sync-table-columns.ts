import { useLayoutEffect, useRef } from "react";

/**
 * On mobile (<=640px) gives the totals and data tables identical column widths so they line up.
 * Widths only grow for column 0; 2-column tables split 50/50, and column 1 absorbs spare space.
 */
export function useSyncTableColumns() {
  const totalsRef = useRef<HTMLTableElement>(null);
  const dataRef = useRef<HTMLTableElement>(null);
  const maxFirstColumnWidthRef = useRef(0);

  useLayoutEffect(() => {
    const totals = totalsRef.current;
    const data = dataRef.current;
    if (!totals || !data) return;

    const resetTable = (table: HTMLTableElement) => {
      table.style.tableLayout = "";
      table.style.minWidth = "";
      table.querySelectorAll<HTMLElement>("col").forEach((columnElement) => {
        columnElement.style.width = "";
      });
    };
    resetTable(totals);
    resetTable(data);

    if (!window.matchMedia("(max-width: 640px)").matches) return;

    const headerRow = data.tHead?.rows[0];
    if (!headerRow || headerRow.cells.length === 0) return;

    const columnCount = headerRow.cells.length;

    if (columnCount === 2) {
      const applyHalf = (table: HTMLTableElement) => {
        table.querySelectorAll<HTMLElement>("col").forEach((columnElement) => {
          columnElement.style.width = "50%";
        });
        table.style.tableLayout = "fixed";
      };
      applyHalf(totals);
      applyHalf(data);
      return;
    }

    totals.style.width = "1px";
    data.style.width = "1px";

    const totalsWidths = new Array<number>(columnCount).fill(0);
    for (const row of Array.from<HTMLTableRowElement>(totals.rows)) {
      for (let index = 0; index < Math.min(row.cells.length, columnCount); index++) {
        totalsWidths[index] = Math.max(
          totalsWidths[index],
          row.cells[index].getBoundingClientRect().width,
        );
      }
    }

    const dataWidths: number[] = [];
    for (let index = 0; index < columnCount; index++) {
      dataWidths.push(headerRow.cells[index].getBoundingClientRect().width);
    }

    totals.style.width = "";
    data.style.width = "";

    const maxWidths = dataWidths.map((dataWidth, index) =>
      Math.max(dataWidth, totalsWidths[index]),
    );

    maxWidths[0] = Math.max(maxWidths[0], maxFirstColumnWidthRef.current);
    maxFirstColumnWidthRef.current = maxWidths[0];

    const totalMaxWidth = maxWidths.reduce((sum, width) => sum + width, 0);
    if (totalMaxWidth === 0) return;

    const availableWidth =
      (data.parentElement?.clientWidth ?? window.innerWidth) || window.innerWidth;
    const tableWidth = Math.max(totalMaxWidth, availableWidth);

    const columnWidths = [...maxWidths];
    if (totalMaxWidth <= availableWidth && columnCount > 2) {
      const otherTotal = columnWidths.reduce(
        (sum, width, index) => (index !== 1 ? sum + width : sum),
        0,
      );
      columnWidths[1] = Math.max(columnWidths[1], availableWidth - otherTotal);
    }

    const applyFixed = (table: HTMLTableElement) => {
      table.querySelectorAll<HTMLElement>("col").forEach((columnElement, index) => {
        if (index < columnWidths.length) {
          columnElement.style.width = `${((columnWidths[index] / tableWidth) * 100).toFixed(3)}%`;
        }
      });
      table.style.tableLayout = "fixed";
      if (tableWidth > availableWidth) {
        table.style.minWidth = `${tableWidth}px`;
      }
    };
    applyFixed(totals);
    applyFixed(data);
  });

  return { totalsRef, dataRef };
}
