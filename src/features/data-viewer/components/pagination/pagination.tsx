import type { MouseEvent } from "react";
import { PAGE_SIZE } from "../../utils/constants";

export function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pageCount = Math.ceil(total / PAGE_SIZE);
  if (pageCount <= 1) return null;

  function goPrev(e: MouseEvent<HTMLButtonElement>) {
    e.currentTarget.blur();
    onChange(Math.max(0, page - 1));
  }

  function goNext(e: MouseEvent<HTMLButtonElement>) {
    e.currentTarget.blur();
    onChange(Math.min(pageCount - 1, page + 1));
  }

  return (
    <div className="dv-pagination">
      <button
        type="button"
        className="dv-pagination-button"
        onClick={goPrev}
        disabled={page === 0}
        aria-label="Previous page"
      >
        ‹
      </button>
      <span className="dv-pagination-info">
        {page + 1} / {pageCount}
      </span>
      <button
        type="button"
        className="dv-pagination-button"
        onClick={goNext}
        disabled={page >= pageCount - 1}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}
