import type { User } from '../../../types';
import { IconButton } from '../../common/Button';
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
}: DealsListHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/70 px-4 py-3 xl:flex-nowrap">
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">Сделки</span>
        <span className="text-sm text-slate-500 whitespace-nowrap">
          Сделок всего {totalCount}, показано {visibleCount}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 whitespace-nowrap">
          <input
            id="dealShowClosed"
            type="checkbox"
            checked={showClosed}
            onChange={(event) => onShowClosedChange(event.target.checked)}
            className="check"
          />
          Закрытые
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 whitespace-nowrap">
          <input
            id="dealShowDeleted"
            type="checkbox"
            checked={showDeleted}
            onChange={(event) => onShowDeletedChange(event.target.checked)}
            className="check"
          />
          Удалённые
        </label>
        <div className="flex min-w-[200px] items-center gap-2">
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

      <div className="ml-auto min-w-[240px] flex-1 xl:max-w-sm">
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
          <div className="relative min-w-0 flex-1">
            <input
              id="dealSearch"
              type="text"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Поиск по сделкам"
              className="field field-input pr-10"
            />
            {search && (
              <IconButton
                type="button"
                icon="close"
                label="Очистить поиск сделок"
                size="sm"
                onClick={() => onSearchSubmit('')}
                className="search-clear-btn"
              />
            )}
          </div>
          <IconButton type="submit" size="sm" icon="search" label="Найти сделки" />
          <IconButton
            type="button"
            size="sm"
            icon="refresh"
            label={isRefreshing ? 'Обновляем сделки' : 'Обновить сделки'}
            onClick={() => void onRefresh?.()}
            disabled={!onRefresh || isRefreshing}
          />
        </form>
      </div>
    </div>
  );
}
