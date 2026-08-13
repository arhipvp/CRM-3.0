import type { User } from '../../../types';
import { Button } from '../../common/Button';
import { getUserDisplayName } from './helpers';

interface DealsListHeaderProps {
  totalCount: number;
  visibleCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (value?: string) => void;
  onRefresh?: () => Promise<void>;
  isRefreshing: boolean;
  executorFilter: string;
  onExecutorFilterChange: (value: string) => void;
  showDeleted: boolean;
  onShowDeletedChange: (value: boolean) => void;
  showClosed: boolean;
  onShowClosedChange: (value: boolean) => void;
  users: User[];
  isSelectionBlocked: boolean;
}

export function DealsListHeader({
  totalCount,
  visibleCount,
  search,
  onSearchChange,
  onSearchSubmit,
  onRefresh,
  isRefreshing,
  executorFilter,
  onExecutorFilterChange,
  showDeleted,
  onShowDeletedChange,
  showClosed,
  onShowClosedChange,
  users,
  isSelectionBlocked,
}: DealsListHeaderProps) {
  return (
    <>
      <div className="bg-gradient-to-r from-slate-50 via-white to-blue-50/70 px-4 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">Сделки</span>
            <span className="text-sm text-slate-500 whitespace-nowrap">
              Сделок всего {totalCount}, показано {visibleCount}
            </span>
          </div>
          <div className="w-full max-w-md">
            <label htmlFor="dealSearch" className="sr-only">
              Поиск по сделкам
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSearchSubmit();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  id="dealSearch"
                  type="text"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Поиск по сделкам"
                  className="field field-input pr-10"
                />
                {search && (
                  <Button
                    type="button"
                    onClick={() => onSearchSubmit('')}
                    aria-label="Очистить поиск сделок"
                    className="search-clear-btn"
                  >
                    ×
                  </Button>
                )}
              </div>
              <Button type="submit" variant="quiet" size="sm">
                Найти
              </Button>
              <Button
                type="button"
                variant="quiet"
                size="sm"
                onClick={() => void onRefresh?.()}
                disabled={!onRefresh || isRefreshing}
              >
                {isRefreshing ? 'Обновляем...' : 'Обновить'}
              </Button>
            </form>
          </div>
        </div>
      </div>
      <div className="border-b border-slate-200/80 bg-white px-4 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <input
              id="dealShowClosed"
              type="checkbox"
              checked={showClosed}
              onChange={(event) => onShowClosedChange(event.target.checked)}
              className="check"
            />
            Показать закрытые сделки
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <input
              id="dealShowDeleted"
              type="checkbox"
              checked={showDeleted}
              onChange={(event) => onShowDeletedChange(event.target.checked)}
              className="check"
            />
            Показать удалённые сделки
          </label>
          <div className="flex min-w-[220px] items-center gap-2">
            <label
              htmlFor="dealExecutorFilter"
              className="text-xs font-semibold text-slate-500 whitespace-nowrap"
            >
              Исполнитель
            </label>
            <select
              id="dealExecutorFilter"
              value={executorFilter}
              onChange={(event) => onExecutorFilterChange(event.target.value)}
              aria-label="Фильтр по исполнителю"
              className="field field-select"
            >
              <option value="">Все</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {getUserDisplayName(user)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {isSelectionBlocked && (
          <p className="mt-3 text-xs font-semibold text-rose-700">
            Подтвердите продолжение учета времени, чтобы переключиться на другую сделку.
          </p>
        )}
      </div>
    </>
  );
}
