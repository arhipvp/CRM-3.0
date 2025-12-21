import { useMemo, useState } from 'react';
import type { Deal, FinancialRecordCreationContext, Payment, Policy } from '../../../../types';
import {
  PolicySortKey,
  policyHasUnpaidActivity,
} from '../helpers';
import { usePoliciesExpansionState } from '../../../../hooks/usePoliciesExpansionState';
import { PolicyCard } from '../../../policies/PolicyCard';

const POLICY_SORT_LABELS: Record<PolicySortKey, string> = {
  number: 'Номер',
  insuranceCompany: 'Компания',
  insuranceType: 'Тип',
  client: 'Клиент',
  salesChannel: 'Канал продаж',
  startDate: 'Начало',
  endDate: 'Окончание',
  transport: 'Авто',
};

interface PoliciesTabProps {
  selectedDeal: Deal | null;
  sortedPolicies: Policy[];
  relatedPayments: Payment[];
  policySortKey: PolicySortKey;
  policySortOrder: 'asc' | 'desc';
  setEditingPaymentId: (value: string | null) => void;
  setCreatingPaymentPolicyId: (value: string | null) => void;
  setCreatingFinancialRecordContext: React.Dispatch<
    React.SetStateAction<FinancialRecordCreationContext | null>
  >;
  setEditingFinancialRecordId: React.Dispatch<React.SetStateAction<string | null>>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onRequestAddPolicy: (dealId: string) => void;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onRequestEditPolicy: (policy: Policy) => void;
}

export const PoliciesTab: React.FC<PoliciesTabProps> = ({
  selectedDeal,
  sortedPolicies,
  relatedPayments,
  policySortKey,
  policySortOrder,
  setEditingPaymentId,
  setCreatingPaymentPolicyId,
  setCreatingFinancialRecordContext,
  setEditingFinancialRecordId,
  onDeleteFinancialRecord,
  onRequestAddPolicy,
  onDeletePolicy,
  onRequestEditPolicy,
}) => {
  const {
    paymentsExpanded,
    setPaymentsExpanded,
    recordsExpandedAll,
    setRecordsExpandedAll,
  } = usePoliciesExpansionState();
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);

  const paymentsByPolicyMap = useMemo(() => {
    const map = new Map<string, Payment[]>();
    relatedPayments.forEach((payment) => {
      const policyId = payment.policyId;
      if (!policyId) {
        return;
      }
      const current = map.get(policyId) ?? [];
      current.push(payment);
      map.set(policyId, current);
    });
    return map;
  }, [relatedPayments]);

  const allFinancialRecords = useMemo(
    () => relatedPayments.flatMap((payment) => payment.financialRecords ?? []),
    [relatedPayments]
  );

  const visiblePolicies = useMemo(() => {
    if (!showUnpaidOnly) {
      return sortedPolicies;
    }
    return sortedPolicies.filter((policy) =>
      policyHasUnpaidActivity(policy.id, paymentsByPolicyMap, allFinancialRecords)
    );
  }, [showUnpaidOnly, sortedPolicies, paymentsByPolicyMap, allFinancialRecords]);

  if (!selectedDeal) {
    return null;
  }

  const renderStatusMessage = (message: string) => (
    <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">{message}</div>
  );

  const sortLabel = POLICY_SORT_LABELS[policySortKey] ?? policySortKey;
  const sortOrderSymbol = policySortOrder === 'asc' ? '↑' : '↓';

  if (!sortedPolicies.length) {
    return (
      <section className="app-panel p-6 shadow-none space-y-4">
        {renderStatusMessage('Для сделки пока нет полисов.')}
        <button
          type="button"
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className="btn btn-primary rounded-xl self-start"
        >
          Создать полис
        </button>
      </section>
    );
  }

  return (
    <section className="app-panel p-6 shadow-none space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="app-label">Полисы</p>
          <span className="text-xs text-slate-500">
            Сортировка: {sortLabel} {sortOrderSymbol}
          </span>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="check"
              checked={showUnpaidOnly}
              onChange={(event) => setShowUnpaidOnly(event.target.checked)}
            />
            Только неоплаченные
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onRequestAddPolicy(selectedDeal.id)}
            className="btn btn-secondary btn-sm rounded-xl"
          >
            + Создать полис
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm rounded-xl"
            onClick={() => {
              setPaymentsExpanded((prev) => {
                const next = { ...prev };
                visiblePolicies.forEach((policy) => {
                  next[policy.id] = true;
                });
                return next;
              });
              setRecordsExpandedAll(true);
            }}
          >
            Раскрыть все
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm rounded-xl"
            onClick={() => {
              setPaymentsExpanded((prev) => {
                const next = { ...prev };
                visiblePolicies.forEach((policy) => {
                  next[policy.id] = false;
                });
                return next;
              });
              setRecordsExpandedAll(false);
            }}
          >
            Скрыть все
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {visiblePolicies.map((policy) => {
          const payments = paymentsByPolicyMap.get(policy.id) ?? [];
          const expanded = paymentsExpanded[policy.id] ?? false;

          return (
            <PolicyCard
              key={policy.id}
              policy={policy}
              payments={payments}
              recordsExpandedAll={recordsExpandedAll}
              isPaymentsExpanded={expanded}
              onTogglePaymentsExpanded={() =>
                setPaymentsExpanded((prev) => ({
                  ...prev,
                  [policy.id]: !expanded,
                }))
              }
              actions={[
                {
                  key: 'edit',
                  label: 'Редактировать',
                  onClick: () => onRequestEditPolicy(policy),
                  variant: 'secondary',
                },
                {
                  key: 'delete',
                  label: 'Удалить',
                  onClick: () => onDeletePolicy(policy.id).catch(() => undefined),
                  variant: 'danger',
                },
              ]}
              onRequestAddPayment={() => {
                setEditingPaymentId('new');
                setCreatingPaymentPolicyId(policy.id);
              }}
              onEditPayment={(paymentId) => {
                setCreatingPaymentPolicyId(null);
                setEditingPaymentId(paymentId);
              }}
              onRequestAddRecord={(paymentId, recordType) => {
                setCreatingFinancialRecordContext({ paymentId, recordType });
                setEditingFinancialRecordId(null);
              }}
              onEditFinancialRecord={(recordId) => setEditingFinancialRecordId(recordId)}
              onDeleteFinancialRecord={onDeleteFinancialRecord}
            />
          );
        })}
      </div>
    </section>
  );
};
