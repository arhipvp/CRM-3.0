import { useEffect, useMemo, useState } from 'react';

import type { Deal, Policy } from '../../types';
import { BTN_SM_QUIET, BTN_SM_SECONDARY } from '../common/buttonStyles';
import { Modal } from '../Modal';

interface PolicyMoveDialogProps {
  policy: Policy | null;
  deals: Deal[];
  isOpen: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (policyId: string, targetDealId: string) => Promise<void>;
}

export const PolicyMoveDialog: React.FC<PolicyMoveDialogProps> = ({
  policy,
  deals,
  isOpen,
  isSubmitting = false,
  onCancel,
  onConfirm,
}) => {
  const [query, setQuery] = useState('');
  const [targetDealId, setTargetDealId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const targetDeals = useMemo(
    () => deals.filter((deal) => deal.id !== policy?.dealId && !deal.deletedAt),
    [deals, policy?.dealId],
  );

  const filteredDeals = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) {
      return targetDeals;
    }

    return targetDeals
      .map((deal, index) => ({
        deal,
        index,
        rank: getDealSearchRank(deal, normalizedQuery),
      }))
      .filter((item): item is { deal: Deal; index: number; rank: number } => item.rank !== null)
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }
        return left.index - right.index;
      })
      .map((item) => item.deal);
  }, [query, targetDeals]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTargetDealId('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !policy) {
    return null;
  }

  const handleConfirm = async () => {
    if (!targetDealId) {
      setError('Выберите сделку.');
      return;
    }
    await onConfirm(policy.id, targetDealId);
  };

  return (
    <Modal title="Перенести полис" onClose={onCancel} size="lg" zIndex={70}>
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-slate-600">{policy.number}</p>
          <p className="text-xs text-slate-500">
            Выберите сделку, в которую нужно перенести полис.
          </p>
        </div>

        <div className="space-y-2">
          <label className="app-label" htmlFor="policy-move-search">
            Новая сделка
          </label>
          <input
            id="policy-move-search"
            className="field field-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setTargetDealId('');
              setError(null);
            }}
            placeholder="Найти сделку по названию, клиенту или продавцу..."
            autoFocus
            disabled={isSubmitting || targetDeals.length === 0}
          />
        </div>

        <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {targetDeals.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Нет доступных сделок для переноса
            </p>
          ) : filteredDeals.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Ничего не найдено</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredDeals.map((deal) => {
                const isSelected = deal.id === targetDealId;
                return (
                  <li key={deal.id}>
                    <button
                      type="button"
                      className={`flex w-full min-w-0 flex-col gap-1 px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-sky-50 text-sky-950 ring-1 ring-inset ring-sky-200'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        setTargetDealId(deal.id);
                        setError(null);
                      }}
                      disabled={isSubmitting}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold">{deal.title}</span>
                        {deal.clientName && (
                          <span className="truncate text-sm text-slate-500">
                            · {deal.clientName}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-xs text-slate-500">
                        {formatDealMeta(deal)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className={BTN_SM_QUIET} onClick={onCancel} disabled={isSubmitting}>
            Отмена
          </button>
          <button
            type="button"
            className={BTN_SM_SECONDARY}
            onClick={() => {
              void handleConfirm();
            }}
            disabled={isSubmitting || !targetDealId}
          >
            {isSubmitting ? 'Перенос...' : 'Перенести'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase('ru');
}

function getDealSearchRank(deal: Deal, normalizedQuery: string): number | null {
  const title = normalizeSearchValue(deal.title);
  const clientName = normalizeSearchValue(deal.clientName ?? '');
  const secondaryValues = [deal.sellerName, deal.executorName, deal.stageName, deal.status].map(
    (value) => normalizeSearchValue(value ?? ''),
  );

  if (title.startsWith(normalizedQuery) || clientName.startsWith(normalizedQuery)) {
    return 0;
  }
  if (title.includes(normalizedQuery) || clientName.includes(normalizedQuery)) {
    return 1;
  }
  if (secondaryValues.some((value) => value.includes(normalizedQuery))) {
    return 2;
  }
  return null;
}

function formatDealMeta(deal: Deal): string {
  const statusParts = [deal.stageName, deal.status].filter(Boolean);
  const peopleParts = [
    deal.sellerName ? `Продавец: ${deal.sellerName}` : '',
    deal.executorName ? `Исполнитель: ${deal.executorName}` : '',
  ].filter(Boolean);

  return [...statusParts, ...peopleParts].join(' · ') || 'Без дополнительных данных';
}
