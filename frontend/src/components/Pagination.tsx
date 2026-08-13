import { Button } from './common/Button';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalItems, pageSize, onPageChange }: PaginationProps) {
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
        pages.push('...');
      }

      // Show pages around current page
      const startPage = Math.max(2, currentPage - halfWindow);
      const endPage = Math.min(totalPages - 1, currentPage + halfWindow);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Show ellipsis if needed
      if (currentPage < totalPages - halfWindow - 1) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="mt-4 flex items-center justify-between border-t border-[var(--app-border)] px-4 py-3">
      <div className="text-xs text-slate-600">
        Показаны элементы {(currentPage - 1) * pageSize + 1}-
        {Math.min(currentPage * pageSize, totalItems)} из {totalItems}
      </div>

      <nav className="flex items-center gap-2" aria-label="Пагинация">
        <Button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          variant="secondary"
          size="sm"
          icon="chevronLeft"
          aria-label="Предыдущая страница"
        >
          Назад
        </Button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, idx) => (
            <div key={idx}>
              {page === '...' ? (
                <span className="px-2 py-1 text-slate-500" aria-hidden="true">
                  ...
                </span>
              ) : (
                <Button
                  onClick={() => onPageChange(page as number)}
                  aria-current={currentPage === page ? 'page' : undefined}
                  aria-label={`Страница ${page}`}
                  variant={currentPage === page ? 'primary' : 'secondary'}
                  size="sm"
                >
                  {page}
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          variant="secondary"
          size="sm"
          icon="chevronRight"
          iconPosition="end"
          aria-label="Следующая страница"
        >
          Вперёд
        </Button>
      </nav>
    </div>
  );
}
