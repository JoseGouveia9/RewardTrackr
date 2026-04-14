import { AnimatePresence, motion } from "framer-motion";

export function AnimatedLoadingRow({ show, colSpan }: { show: boolean; colSpan: number }) {
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.tr
          key="dv-loading-row"
          className="dv-loading-row"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <td className="dv-loading-cell" colSpan={colSpan}>
            <span className="dv-loading-inline">
              <span className="dv-spinner" aria-hidden="true" />
              <span>Fetching data...</span>
            </span>
          </td>
        </motion.tr>
      ) : null}
    </AnimatePresence>
  );
}
