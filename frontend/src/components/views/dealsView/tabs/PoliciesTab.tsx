import { useEffect, useMemo, useState } from 'react';
import type { Deal, Payment, Policy } from '../../../../types';
import {
  FinancialRecordCreationContext,
  formatCurrency,
  PolicySortKey,
  policyHasUnpaidActivity,
} from '../helpers';
import { ColoredLabel } from '../../../common/ColoredLabel';
import { LabelValuePair } from '../../../common/LabelValuePair';
import { PaymentCard } from '../../../policies/PaymentCard';

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
  const [paymentsExpanded, setPaymentsExpanded] = useState<Record<string, boolean>>(
    {}
  );
  const [recordsExpandedAll, setRecordsExpandedAll] = useState(false);
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const STORAGE_PAYMENTS_KEY = 'crm:policies:payments-expanded';
  const STORAGE_RECORDS_KEY = 'crm:policies:records-expanded';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedPayments = window.localStorage.getItem(STORAGE_PAYMENTS_KEY);
    if (storedPayments) {
      try {
        const parsed = JSON.parse(storedPayments);
        if (parsed && typeof parsed === 'object') {
          setPaymentsExpanded(parsed);
        }
      } catch {
        // ignore parse error
      }
    }
    const storedRecords = window.localStorage.getItem(STORAGE_RECORDS_KEY);
    if (storedRecords) {
      setRecordsExpandedAll(storedRecords === 'true');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      STORAGE_PAYMENTS_KEY,
      JSON.stringify(paymentsExpanded)
    );
  }, [paymentsExpanded]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      STORAGE_RECORDS_KEY,
      recordsExpandedAll ? 'true' : 'false'
    );
  }, [recordsExpandedAll]);

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

  const sortLabel = POLICY_SORT_LABELS[policySortKey] ?? policySortKey;
  const sortOrderSymbol = policySortOrder === 'asc' ? '↑' : '↓';

  if (!sortedPolicies.length) {
    return (
      <section className="app-panel p-6 shadow-none space-y-4">
        <p className="text-sm text-slate-600">Для сделки пока нет полисов.</p>
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
        <div className="flex items-center gap-3">
          <p className="app-label">Полисы</p>
          <span className="text-xs text-slate-500">
            Сортировка: {sortLabel} {sortOrderSymbol}
          </span>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-slate-300 text-sky-600 focus:ring-sky-500"
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
            <section key={policy.id} className="rounded-2xl border border-slate-200 bg-white">
              <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="app-label">Номер</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {policy.number || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm rounded-xl"
                      onClick={() => onRequestEditPolicy(policy)}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm rounded-xl"
                      onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <LabelValuePair
                    label="Клиент"
                    value={(policy.insuredClientName ?? policy.clientName) || '—'}
                  />
                  <LabelValuePair
                    label="Компания"
                    value={
                      <ColoredLabel
                        value={policy.insuranceCompany}
                        fallback="—"
                        showDot
                        className="font-semibold text-slate-900"
                      />
                    }
                  />
                  <LabelValuePair label="Канал" value={policy.salesChannel || '—'} />
                  <LabelValuePair
                    label="Сумма"
                    value={`${formatCurrency(policy.paymentsPaid)} / ${formatCurrency(
                      policy.paymentsTotal
                    )}`}
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/70 p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <LabelValuePair label="Тип" value={policy.insuranceType || '—'} />
                  <LabelValuePair label="Марка" value={policy.brand || '—'} />
                  <LabelValuePair label="Модель" value={policy.model || '—'} />
                  <LabelValuePair label="VIN" value={policy.vin || '—'} />
                </div>
              </div>

              <div className="border-t border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="app-label">Платежи</p>
                    {payments.length > 0 && (
                      <span className="text-xs text-slate-500">
                        {payments.length} запись{payments.length === 1 ? '' : 'ей'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPaymentId('new');
                        setCreatingPaymentPolicyId(policy.id);
                      }}
                      className="btn btn-secondary btn-sm rounded-xl"
                    >
                      + Добавить платёж
                    </button>
                    {payments.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentsExpanded((prev) => ({
                            ...prev,
                            [policy.id]: !expanded,
                          }))
                        }
                        className="btn btn-quiet btn-sm rounded-xl"
                      >
                        {expanded ? 'Скрыть' : 'Показать'}
                      </button>
                    )}
                  </div>
                </div>

                {payments.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">Платежей пока нет.</p>
                ) : expanded ? (
                  <div className="mt-3 space-y-2">
                    {payments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        recordsExpandedOverride={recordsExpandedAll}
                        onEditPayment={(paymentId) => {
                          setCreatingPaymentPolicyId(null);
                          setEditingPaymentId(paymentId);
                        }}
                        onRequestAddRecord={(paymentId, recordType) => {
                          setCreatingFinancialRecordContext({ paymentId, recordType });
                          setEditingFinancialRecordId(null);
                        }}
                        onEditFinancialRecord={(recordId) =>
                          setEditingFinancialRecordId(recordId)
                        }
                        onDeleteFinancialRecord={onDeleteFinancialRecord}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
};

