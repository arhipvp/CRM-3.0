import React from 'react';
import type { Deal, FinancialRecord, Payment, Policy } from '../../../../types';
import {
  FinancialRecordCreationContext,
  formatCurrency,
  formatDate,
  PolicySortKey,
} from '../helpers';
import { ColoredLabel } from '../../../common/ColoredLabel';

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
  if (!selectedDeal) {
    return null;
  }

  const sortLabel = POLICY_SORT_LABELS[policySortKey] ?? policySortKey;
  const sortOrderSymbol = policySortOrder === 'asc' ? '↑' : '↓';

  const renderRecordRows = (records: FinancialRecord[], recordType: 'income' | 'expense') => {
    if (!records.length) {
      return (
        <tr>
          <td colSpan={4} className="px-2 py-2 text-[11px] text-center text-slate-400">
            Записей нет
          </td>
        </tr>
      );
    }

    return records.map((record) => {
      const amountValue = Math.abs(Number(record.amount) || 0);
      const sign = recordType === 'income' ? '+' : '-';

      return (
        <tr key={record.id} className="border-t border-slate-100">
          <td className="px-2 py-2 text-[11px] text-slate-600">{record.description || 'Без описания'}</td>
          <td className="px-2 py-2 text-[11px] text-slate-600">{formatDate(record.date)}</td>
          <td className="px-2 py-2 text-right font-semibold text-[11px] text-slate-900">
            <span className={recordType === 'income' ? 'text-emerald-600' : 'text-red-600'}>
              {sign}
              {formatCurrency(amountValue.toString())}
            </span>
          </td>
          <td className="px-2 py-2 text-right text-[11px] text-slate-600 space-x-2">
            <button
              onClick={() => setEditingFinancialRecordId(record.id)}
              className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold"
            >
              Изменить
            </button>
            <button
              onClick={() => onDeleteFinancialRecord(record.id).catch(() => undefined)}
              className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold"
            >
              Удалить
            </button>
          </td>
        </tr>
      );
    });
  };

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
              <div className="grid gap-3 px-3 py-3 text-[11px] text-slate-500 sm:grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_1fr]">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400">Номер</p>
                  <p className="font-semibold text-slate-900">{policy.number || '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400">Компания</p>
                  <ColoredLabel
                    value={policy.insuranceCompany}
                    fallback="—"
                    showDot
                    className="font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400">Клиент</p>
                  <p className="font-semibold text-slate-800">
                    {(policy.insuredClientName ?? policy.clientName) || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400">Канал</p>
                  <ColoredLabel
                    value={policy.salesChannel}
                    fallback="—"
                    showDot
                    className="font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400">Сумма</p>
                  <p className="font-semibold text-slate-900">
                    {formatCurrency(policy.paymentsPaid)} / {formatCurrency(policy.paymentsTotal)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400">Действие</p>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-400 hover:text-sky-600"
                      onClick={() => onRequestEditPolicy(policy)}
                    >
                      Ред.
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                      onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                    >
                      Уд.
                    </button>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 sm:flex sm:items-center sm:justify-between">
                <div className="flex flex-wrap text-sm text-slate-600 gap-4">
                  <span>Тип: {policy.insuranceType || '—'}</span>
                  <span>Марка: {policy.brand || '—'}</span>
                  <span>Модель: {policy.model || '—'}</span>
                  <span>VIN: {policy.vin || '—'}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
                  <span>Начало: {formatDate(policy.startDate)}</span>
                  <span>Окончание: {formatDate(policy.endDate)}</span>
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                  <div>Платежи</div>
                  <button
                    onClick={() => {
                      setEditingPaymentId('new');
                      setCreatingPaymentPolicyId(policy.id);
                    }}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                  >
                    + Добавить платёж
                  </button>
                </div>
                {payments.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">Платежей пока нет.</p>
                ) : (
                  <div className="mt-2 space-y-2 text-[11px] text-slate-600">
                    {payments.map((payment) => {
                      const incomes =
                        payment.financialRecords?.filter(
                          (record) => record.recordType === 'Доход'
                        ) || [];
                      const expenses =
                        payment.financialRecords?.filter(
                          (record) => record.recordType === 'Расход'
                        ) || [];

                      return (
                        <div
                          key={payment.id}
                          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900 text-sm">
                                {formatCurrency(payment.amount)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {payment.note || payment.description || 'Без описания'}
                              </p>
                            </div>
                            <div className="flex gap-4 text-[11px] text-slate-500">
                              <div>
                                <p className="uppercase tracking-[0.3em]">План</p>
                                <p className="font-semibold text-slate-900">
                                  {formatDate(payment.scheduledDate)}
                                </p>
                              </div>
                              <div>
                                <p className="uppercase tracking-[0.3em]">Факт</p>
                                <p className="font-semibold text-slate-900">
                                  {formatDate(payment.actualDate)}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setCreatingPaymentPolicyId(null);
                                setEditingPaymentId(payment.id);
                              }}
                              className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                            >
                              Изменить
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                                <span>Доходы</span>
                                <button
                                  onClick={() =>
                                    setCreatingFinancialRecordContext({
                                      paymentId: payment.id,
                                      recordType: 'income',
                                    })
                                  }
                                  className="text-[10px] font-semibold text-sky-600 hover:text-sky-800"
                                >
                                  Добавить
                                </button>
                              </div>
                              <div className="mt-2 overflow-x-auto">
                                <table className="min-w-full text-[11px] text-slate-600">
                                  <thead>
                                    <tr className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                                      <th className="px-2 py-1 text-left">Описание</th>
                                      <th className="px-2 py-1 text-left">Дата</th>
                                      <th className="px-2 py-1 text-right">Сумма</th>
                                      <th className="px-2 py-1 text-right">Действия</th>
                                    </tr>
                                  </thead>
                                  <tbody>{renderRecordRows(incomes, 'income')}</tbody>
                                </table>
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                                <span>Расходы</span>
                                <button
                                  onClick={() =>
                                    setCreatingFinancialRecordContext({
                                      paymentId: payment.id,
                                      recordType: 'expense',
                                    })
                                  }
                                  className="text-[10px] font-semibold text-sky-600 hover:text-sky-800"
                                >
                                  Добавить
                                </button>
                              </div>
                              <div className="mt-2 overflow-x-auto">
                                <table className="min-w-full text-[11px] text-slate-600">
                                  <thead>
                                    <tr className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                                      <th className="px-2 py-1 text-left">Описание</th>
                                      <th className="px-2 py-1 text-left">Дата</th>
                                      <th className="px-2 py-1 text-right">Сумма</th>
                                      <th className="px-2 py-1 text-right">Действия</th>
                                    </tr>
                                  </thead>
                                  <tbody>{renderRecordRows(expenses, 'expense')}</tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
