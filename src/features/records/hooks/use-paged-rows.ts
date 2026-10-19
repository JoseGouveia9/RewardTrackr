import { useMemo } from "react";
import { PAGE_SIZE } from "../utils/constants";

/** Slices rows for a zero-based page, falling back to the default PAGE_SIZE when none is given. */
export function usePagedRows<T>(rows: T[], page: number, pageSize?: number) {
  const effectivePageSize = pageSize ?? PAGE_SIZE;
  const pageRows = useMemo(
    () => rows.slice(page * effectivePageSize, (page + 1) * effectivePageSize),
    [rows, page, effectivePageSize],
  );
  return { pageRows, effectivePageSize };
}
