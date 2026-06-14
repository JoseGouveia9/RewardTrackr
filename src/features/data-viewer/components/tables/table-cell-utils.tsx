import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

const INFO_ICON = (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="dv-info-icon"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

export function TrendArrow({
  current,
  prev,
  integer,
}: {
  current: number | undefined;
  prev: number | undefined;
  integer?: boolean;
}) {
  if (current == null || prev == null) return null;
  const a = integer ? Math.round(current) : current;
  const b = integer ? Math.round(prev) : prev;
  const delta = a - b;
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <svg
      className={`dv-trend${up ? " dv-trend--up" : " dv-trend--down"}`}
      width="8"
      height="8"
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden="true"
    >
      {up ? <polygon points="5,1 9,9 1,9" /> : <polygon points="1,1 9,1 5,9" />}
    </svg>
  );
}

export function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="dv-math-frac">
      <span className="dv-math-num">{num}</span>
      <span className="dv-math-den">{den}</span>
    </span>
  );
}

export function InfoTooltip({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: "center" | "right" | "left";
}) {
  const mod =
    align === "right"
      ? " dv-formula-tooltip--right"
      : align === "left"
        ? " dv-formula-tooltip--left"
        : "";
  return (
    <span className="dv-info-wrap">
      {INFO_ICON}
      <span className={`dv-formula-tooltip${mod}`}>{children}</span>
    </span>
  );
}

/** Shared empty/loading state shown when a table has no cache entry yet. */
export function TableEmptyState({ isFetching }: { isFetching: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="dv-empty">
      {isFetching ? (
        <span className="dv-loading-inline">
          <span className="dv-spinner" aria-hidden="true" />
          <span>{t("dataViewer.fetchingData")}</span>
        </span>
      ) : (
        t("dataViewer.noData")
      )}
    </div>
  );
}

/** Animated wrapper for the totals table — shared across all data tables. */
export function AnimatedTotalsWrapper({ show, children }: { show: boolean; children: ReactNode }) {
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

/** "No results match the filter" row — shared across all data tables. */
export function TableNoResultsRow({ colSpan }: { colSpan: number }) {
  const { t } = useTranslation();
  return (
    <tr>
      <td colSpan={colSpan} className="dv-loading-cell">
        {t("dataViewer.noFilterResults")}
      </td>
    </tr>
  );
}
