import React from "react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) {
    return null;
  }

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 7;
    const halfWindow = Math.floor(maxPagesToShow / 2);

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is less than maxPagesToShow
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Show ellipsis if needed
      if (currentPage > halfWindow + 2) {
        pages.push("...");
      }

      // Show pages around current page
      const startPage = Math.max(2, currentPage - halfWindow);
      const endPage = Math.min(totalPages - 1, currentPage + halfWindow);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Show ellipsis if needed
      if (currentPage < totalPages - halfWindow - 1) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-6 px-5 py-4 border-t border-slate-200">
      <div className="text-sm text-slate-600">
        Показаны элементы {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)} из {totalItems}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Назад
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, idx) => (
            <div key={idx}>
              {page === "..." ? (
                <span className="px-2 py-1 text-slate-500">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(page as number)}
                  className={`px-3 py-1 text-sm border rounded ${
                    currentPage === page
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Вперед →
        </button>
      </div>
    </div>
  );
};
