import React from 'react';
import type { Deal, FinancialRecord, Payment, Policy } from '../../../types';
import { FinancialRecordCreationContext, formatCurrency, formatDate } from '../helpers';

interface PaymentsTabProps {
  selectedDeal: Deal | null;
  relatedPolicies: Policy[];
  relatedPayments: Payment[];
  setEditingPaymentId: (value: string | null) => void;
  setCreatingPaymentPolicyId: (value: string | null) => void;
  setCreatingFinancialRecordContext: React.Dispatch<React.SetStateAction<FinancialRecordCreationContext | null>>;
  setEditingFinancialRecordId: React.Dispatch<React.SetStateAction<string | null>>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({
  selectedDeal,
  relatedPolicies,
  relatedPayments,
  setEditingPaymentId,
  setCreatingPaymentPolicyId,
  setCreatingFinancialRecordContext,
  setEditingFinancialRecordId,
  onDeleteFinancialRecord,
}) => {
  if (!selectedDeal) {
    return null;
  }

  if (!relatedPolicies.length) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Для сделки пока нет полисов, добавьте их на вкладке «Полисы».</p>
        <button
          onClick={() => setCreatingPaymentPolicyId(null)}
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700"
        >
          Добавить полис
        </button>
      </div>
    );
  }

  const paymentsByPolicy = relatedPolicies.map((policy) => ({
    policy,
    payments: relatedPayments.filter((p) => p.policyId === policy.id),
  }));

  const renderRecordRows = (records: FinancialRecord[], recordType: 'income' | 'expense') => {
    if (!records.length) {
      return (
        <tr>
          <td colSpan={4} className="px-4 py-2 text-[11px] text-center text-slate-400">
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
          <td className="px-4 py-2 text-xs text-slate-600">{record.description || 'Без описания'}</td>
          <td className="px-4 py-2 text-xs text-slate-600">{formatDate(record.date)}</td>
          <td className="px-4 py-2 text-right font-semibold text-sm text-slate-900">
            <span className={recordType === 'income' ? 'text-emerald-600' : 'text-red-600'}>
              {sign}
              {formatCurrency(amountValue.toString())}
            </span>
          </td>
          <td className="px-4 py-2 text-right text-xs text-slate-600 space-x-2">
            <button
              onClick={() => setEditingFinancialRecordId(record.id)}
              className="text-xs text-sky-600 hover:text-sky-800 font-semibold"
            >
              Редактировать
            </button>
            <button
              onClick={() => onDeleteFinancialRecord(record.id).catch(() => undefined)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold"
            >
              Удалить
            </button>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-800">Платежи</h3>
        <p className="text-sm text-slate-500">Платежи полиса с доходами и расходами по каждому из них.</p>
      </div>

      <div className="space-y-5">
        {paymentsByPolicy.map(({ policy, payments }) => (
          <section
            key={policy.id}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Полис №{policy.number || policy.id}</p>
                <p className="text-xs text-slate-500">
                  {policy.insuranceType || '—'} · {policy.clientName || '—'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{policy.status || '—'}</span>
                <button
                  onClick={() => {
                    setEditingPaymentId('new');
                    setCreatingPaymentPolicyId(policy.id);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-sky-600 hover:text-sky-800"
                >
                  + Создать платеж
                </button>
              </div>
            </div>

            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">Платежей по этому полису ещё нет.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50">
                <table className="min-w-full text-sm text-left text-slate-600">
                  <thead className="bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-right">Сумма</th>
                      <th className="px-4 py-3">План</th>
                      <th className="px-4 py-3">Факт</th>
                      <th className="px-4 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {payments.map((payment) => {
                      const incomes = payment.financialRecords?.filter((record) => record.recordType === 'Доход') || [];
                      const expenses = payment.financialRecords?.filter((record) => record.recordType === 'Расход') || [];

                      return (
                        <React.Fragment key={payment.id}>
                          <tr className="group hover:bg-slate-50">
                            <td className="px-4 py-4 text-right">
                              <p className="text-lg font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
                              <p className="text-[11px] text-slate-500 mt-1">
                                {payment.note || payment.description || 'Нет примечания'}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-slate-600">{formatDate(payment.scheduledDate)}</td>
                            <td className="px-4 py-4 text-slate-600">{formatDate(payment.actualDate)}</td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setCreatingPaymentPolicyId(null);
                                    setEditingPaymentId(payment.id);
                                  }}
                                  className="text-xs text-sky-600 hover:text-sky-800 font-medium"
                                >
                                  Редактировать
                                </button>
                              </div>
                            </td>
                          </tr>
                          <tr className="bg-slate-50">
                            <td colSpan={6} className="px-4 py-4">
                              <div className="grid gap-5 md:grid-cols-2">
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
                                  <div className="mt-3 overflow-x-auto">
                                    <table className="min-w-full text-[11px] text-slate-600">
                                      <thead>
                                        <tr className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                                          <th className="px-3 py-2 text-left">Описание</th>
                                          <th className="px-3 py-2 text-left">Дата</th>
                                          <th className="px-3 py-2 text-right">Сумма</th>
                                          <th className="px-3 py-2 text-right">Действия</th>
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
                                  <div className="mt-3 overflow-x-auto">
                                    <table className="min-w-full text-[11px] text-slate-600">
                                      <thead>
                                        <tr className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                                          <th className="px-3 py-2 text-left">Описание</th>
                                          <th className="px-3 py-2 text-left">Дата</th>
                                          <th className="px-3 py-2 text-right">Сумма</th>
                                          <th className="px-3 py-2 text-right">Действия</th>
                                        </tr>
                                      </thead>
                                      <tbody>{renderRecordRows(expenses, 'expense')}</tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};
