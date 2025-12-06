import React, { useState } from 'react';
import type { Deal, Payment, Policy } from '../../../../types';
import {
  FinancialRecordCreationContext,
  formatCurrency,
  formatDate,
  PolicySortKey,
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
  const [paymentsExpanded, setPaymentsExpanded] = useState<Record<string, boolean>>({});

  if (!selectedDeal) {
    return null;
  }

  const sortLabel = POLICY_SORT_LABELS[policySortKey] ?? policySortKey;
  const sortOrderSymbol = policySortOrder === 'asc' ? '↑' : '↓';

  if (!sortedPolicies.length) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Для сделки пока нет полисов.</p>
        <button
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700"
        >
          Создать полис
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-slate-800">Полисы</h3>
        <button
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className="px-3 py-2 text-sm font-semibold text-sky-600 hover:text-sky-800"
        >
          + Создать полис
        </button>
      </div>
      <div className="text-xs text-slate-400">Сортировка: {sortLabel} {sortOrderSymbol}</div>
      <div className="space-y-4">
        {sortedPolicies.map((policy) => {
          const payments =
            relatedPayments.filter((payment) => payment.policyId === policy.id) || [];

          return (
            <section
              key={policy.id}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="px-3 py-3 text-sm text-slate-500 space-y-4">
                <div className="grid gap-4 sm:grid-cols-[1.1fr_auto]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">?????</p>
                    <p className="font-semibold text-slate-900">{policy.number || '-'}</p>
                  </div>
                  <div className="flex justify-end">
                    <div className="flex items-start justify-end gap-3 text-[9px] uppercase tracking-[0.35em] text-slate-400">
                      <div>
                        <p>????????</p>
                        <div className="flex gap-2 text-xs text-slate-600">
                          <button
                            type="button"
                            className="font-semibold text-slate-500 hover:text-sky-600"
                            onClick={() => onRequestEditPolicy(policy)}
                          >
                            ???.
                          </button>
                          <button
                            type="button"
                            className="font-semibold text-rose-500 hover:text-rose-600"
                            onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                          >
                            ??.
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-6">
                  <LabelValuePair
                    label="Клиент"
                    value={(policy.insuredClientName ?? policy.clientName) || '-'}
                    className="min-w-[180px]"
                  />
                  <LabelValuePair
                    label="Компания"
                    value={
                      <ColoredLabel
                        value={policy.insuranceCompany}
                        fallback="-"
                        showDot
                        className="font-semibold text-slate-900"
                      />
                    }
                    className="min-w-[160px]"
                  />
                  <LabelValuePair
                    label="Канал"
                    value={policy.salesChannel || '-'}
                    className="min-w-[220px]"
                  />
                  <LabelValuePair
                    label="Сумма"
                    value={`${formatCurrency(policy.paymentsPaid)} / ${formatCurrency(policy.paymentsTotal)}`}
                  />
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 space-y-3">
                <div className="flex flex-wrap gap-6">
                  <LabelValuePair label="Тип" value={policy.insuranceType || '-'} />
                  <LabelValuePair label="Марка" value={policy.brand || '-'} />
                  <LabelValuePair label="Модель" value={policy.model || '-'} />
                  <LabelValuePair label="VIN" value={policy.vin || '-'} />
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-slate-500">
                  <LabelValuePair label="Начало" value={formatDate(policy.startDate)} className="text-sm text-slate-500" />
                  <LabelValuePair label="Окончание" value={formatDate(policy.endDate)} className="text-sm text-slate-500" />
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-4 text-sm font-semibold text-slate-800">
                  <div className="flex items-center gap-2">
                    <span>Платежи</span>
                    {payments.length > 0 && (
                      <span className="text-[11px] text-slate-500">{payments.length} запись{payments.length === 1 ? '' : 'ей'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        setEditingPaymentId('new');
                        setCreatingPaymentPolicyId(policy.id);
                      }}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                    >
                      + Добавить платёж
                    </button>
                    {payments.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentsExpanded((prev) => ({
                            ...prev,
                            [policy.id]: !prev[policy.id],
                          }))
                        }
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                      >
                        {(paymentsExpanded[policy.id] ?? false) ? 'Скрыть' : 'Показать'}
                      </button>
                    )}
                  </div>
                </div>
                {payments.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">Платежей пока нет.</p>
                ) : paymentsExpanded[policy.id] ? (
                  <div className="mt-2 space-y-2 text-sm text-slate-600">
                    {payments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
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
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
