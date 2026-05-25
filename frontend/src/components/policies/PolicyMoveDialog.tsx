import { useEffect, useMemo, useState } from 'react';

import type { Deal, Policy } from '../../types';
import { BTN_SM_QUIET, BTN_SM_SECONDARY } from '../common/buttonStyles';

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
  const targetDeals = useMemo(
    () =>
      deals
        .filter((deal) => deal.id !== policy?.dealId && !deal.deletedAt)
        .sort((left, right) => left.title.localeCompare(right.title, 'ru')),
    [deals, policy?.dealId],
  );
  const [targetDealId, setTargetDealId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetDealId(targetDeals[0]?.id ?? '');
      setError(null);
    }
  }, [isOpen, targetDeals]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Перенести полис</h2>
          <p className="text-sm text-slate-600">{policy.number}</p>
        </div>
        <div className="mt-4 space-y-2">
          <label className="app-label" htmlFor="policy-move-target">
            Новая сделка
          </label>
          <select
            id="policy-move-target"
            className="app-input"
            value={targetDealId}
            onChange={(event) => {
              setTargetDealId(event.target.value);
              setError(null);
            }}
            disabled={isSubmitting || targetDeals.length === 0}
          >
            {targetDeals.length === 0 ? (
              <option value="">Нет доступных сделок</option>
            ) : (
              targetDeals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                  {deal.clientName ? ` · ${deal.clientName}` : ''}
                </option>
              ))
            )}
          </select>
          {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={BTN_SM_QUIET} onClick={onCancel} disabled={isSubmitting}>
            Отмена
          </button>
          <button
            type="button"
            className={BTN_SM_SECONDARY}
            onClick={() => {
              void handleConfirm();
            }}
            disabled={isSubmitting || targetDeals.length === 0}
          >
            {isSubmitting ? 'Перенос...' : 'Перенести'}
          </button>
        </div>
      </div>
    </div>
  );
};
