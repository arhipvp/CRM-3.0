import React from 'react';
import type { Deal, FinancialRecord, Payment, Policy } from '../../../../types';
import {
  FinancialRecordCreationContext,
  formatCurrency,
  formatDate,
  PolicySortKey,
} from '../helpers';
import { VehicleDetails } from '../../../common/VehicleDetails';

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
  onSortChange: (key: PolicySortKey) => void;
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
  onSortChange,
}) => {
  if (!selectedDeal) {
    return null;
  }

  const renderPolicyHeaderCell = (label: string, key: PolicySortKey) => (
    <th
      scope="col"
      className="px-4 py-3 cursor-pointer select-none text-left text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-700"
      onClick={() => onSortChange(key)}
      aria-sort={
        policySortKey === key ? (policySortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[0.55rem] text-slate-400">
          {policySortKey === key ? (policySortOrder === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );


  const paymentsByPolicy = sortedPolicies.map((policy) => ({
    policy,
    payments: relatedPayments.filter((payment) => payment.policyId === policy.id),
  }));

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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-slate-800">Полисы</h3>
        <button
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className="px-3 py-2 text-sm font-semibold text-sky-600 hover:text-sky-800"
        >
          + Создать полис
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {renderPolicyHeaderCell('Номер', 'number')}
              {renderPolicyHeaderCell('Компания', 'insuranceCompany')}
              {renderPolicyHeaderCell('Клиент', 'client')}
              {renderPolicyHeaderCell('Канал продаж', 'salesChannel')}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Сумма
              </th>
              {renderPolicyHeaderCell('Тип', 'insuranceType')}
              {renderPolicyHeaderCell('Начало', 'startDate')}
              {renderPolicyHeaderCell('Окончание', 'endDate')}
              {renderPolicyHeaderCell('Автомобиль', 'transport')}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Действие
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortedPolicies.map((policy) => (
              <tr key={policy.id} className="transition hover:bg-slate-50 focus-within:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{policy.number}</td>
                <td className="px-4 py-3">{policy.insuranceCompany || '—'}</td>
                <td className="px-4 py-3">{policy.clientName || '—'}</td>
                <td className="px-4 py-3">{policy.salesChannel || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(policy.paymentsPaid)} / {formatCurrency(policy.paymentsTotal)}
                  </div>
                  <div className="text-[11px] text-slate-400">оплачено / начислено</div>
                </td>
                <td className="px-4 py-3">{policy.insuranceType || '—'}</td>
                <td className="px-4 py-3">{formatDate(policy.startDate)}</td>
                <td className="px-4 py-3">{formatDate(policy.endDate)}</td>
                <td className="px-4 py-3 text-slate-600">
                  <VehicleDetails
                    brand={policy.brand}
                    model={policy.model}
                    vin={policy.vin}
                    placeholder="—"
                  />
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-400 transition hover:text-sky-600"
                    onClick={() => onRequestEditPolicy(policy)}
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition"
                    onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-slate-800">Платежи</h3>
          <p className="text-xs text-slate-500">Платежи полиса с доходами и расходами.</p>
        </div>
        <div className="space-y-4">
          {paymentsByPolicy.map(({ policy, payments }) => (
            <section
              key={policy.id}
              className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Полис №{policy.number || policy.id}
                  </p>
                  <p className="text-xs text-slate-500">
                    {policy.insuranceType || '-'} · {policy.clientName || '-'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{policy.status || '-'}</span>
                  <button
                    onClick={() => {
                      setEditingPaymentId('new');
                      setCreatingPaymentPolicyId(policy.id);
                    }}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-sky-600 transition hover:border-slate-300"
                  >
                    + Добавить платёж
                  </button>
                </div>
              </div>
              {payments.length === 0 ? (
                <p className="text-sm text-slate-500">Платежей пока нет.</p>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => {
                    const incomes =
                      payment.financialRecords?.filter((record) => record.recordType === 'income') ||
                      [];
                    const expenses =
                      payment.financialRecords?.filter((record) => record.recordType === 'expense') ||
                      [];

                    return (
                      <article
                        key={payment.id}
                        className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
                      >
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              {formatCurrency(payment.amount)}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              {payment.note || payment.description || 'Без описания'}
                            </p>
                          </div>
                          <div className="grid text-[11px] text-slate-500 text-left sm:text-right">
                            <span className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                              План
                            </span>
                            <span className="font-semibold text-slate-900">
                              {formatDate(payment.scheduledDate)}
                            </span>
                            <span className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                              Факт
                            </span>
                            <span className="font-semibold text-slate-900">
                              {formatDate(payment.actualDate)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setCreatingPaymentPolicyId(null);
                                setEditingPaymentId(payment.id);
                              }}
                              className="text-xs text-sky-600 hover:text-sky-800 font-semibold"
                            >
                              Изменить
                            </button>
                          </div>
                        </div>
                        <div className="border-t border-slate-100 bg-slate-50 p-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
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
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
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
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
