import type { ReactNode, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Pagination } from "../pagination/pagination";
import { AnimatedLoadingRow } from "../animated-loading-row/animated-loading-row";

function ColumnGroup({ columnClasses }: { columnClasses: string[] }) {
  return (
    <colgroup>
      {columnClasses.map((columnClass, index) => (
        <col key={index} className={columnClass} />
      ))}
    </colgroup>
  );
}

function AnimatedTotalsWrapper({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="dv-animated-totals"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TableNoResultsRow({ colSpan }: { colSpan: number }) {
  const { t } = useTranslation();
  return (
    <tr>
      <td colSpan={colSpan} className="dv-loading-cell">
        {t("dataViewer.noFilterResults")}
      </td>
    </tr>
  );
}

interface RecordsTableProps {
  columnClasses: string[];
  wrapClassName?: string;
  totalsRef: RefObject<HTMLTableElement | null>;
  dataRef: RefObject<HTMLTableElement | null>;
  showTotals: boolean;
  totals: ReactNode;
  head: ReactNode;
  rowState: { selectionMode: boolean; showLoadingRow: boolean; showNoResults: boolean };
  pagination: { page: number; total: number; pageSize: number; onChange: (page: number) => void };
  children: ReactNode;
}

/** Shared table frame: animated totals table, header, loading/empty rows and pagination. */
export function RecordsTable({
  columnClasses,
  wrapClassName,
  totalsRef,
  dataRef,
  showTotals,
  totals,
  head,
  rowState,
  pagination,
  children,
}: RecordsTableProps) {
  const { selectionMode, showLoadingRow, showNoResults } = rowState;
  return (
    <>
      <div className={`dv-tables-wrap${wrapClassName ? ` ${wrapClassName}` : ""}`}>
        <AnimatedTotalsWrapper show={showTotals}>
          <table ref={totalsRef} className="dv-table dv-table-totals">
            <ColumnGroup columnClasses={columnClasses} />
            <tbody>{totals}</tbody>
          </table>
        </AnimatedTotalsWrapper>

        <table
          ref={dataRef}
          className={`dv-table dv-table-data${selectionMode ? " dv-selection-mode" : ""}`}
        >
          <ColumnGroup columnClasses={columnClasses} />
          <thead>
            <tr>{head}</tr>
          </thead>
          <tbody>
            <AnimatedLoadingRow show={showLoadingRow} colSpan={columnClasses.length} />
            {showNoResults && <TableNoResultsRow colSpan={columnClasses.length} />}
            {children}
          </tbody>
        </table>
      </div>
      <Pagination
        page={pagination.page}
        total={pagination.total}
        onChange={pagination.onChange}
        pageSize={pagination.pageSize}
      />
    </>
  );
}
