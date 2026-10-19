import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { PAGE_SIZE } from "../../utils/constants";

export function Pagination({
  page,
  total,
  onChange,
  pageSize: pageSizeOverride,
}: {
  page: number;
  total: number;
  onChange: (nextPage: number) => void;
  pageSize?: number;
}) {
  const { t } = useTranslation();
  const pageCount = Math.ceil(total / (pageSizeOverride ?? PAGE_SIZE));
  if (pageCount <= 1) return null;

  function goToPreviousPage(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.blur();
    onChange(Math.max(0, page - 1));
  }

  function goToNextPage(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.blur();
    onChange(Math.min(pageCount - 1, page + 1));
  }

  return (
    <div className="dv-pagination">
      <button
        type="button"
        className="dv-pagination-button"
        onClick={goToPreviousPage}
        disabled={page === 0}
        aria-label={t("dataViewer.previousPage")}
      >
        ‹
      </button>
      <span className="dv-pagination-info">
        {t("dataViewer.pageOf", { page: page + 1, total: pageCount })}
      </span>
      <button
        type="button"
        className="dv-pagination-button"
        onClick={goToNextPage}
        disabled={page >= pageCount - 1}
        aria-label={t("dataViewer.nextPage")}
      >
        ›
      </button>
    </div>
  );
}
