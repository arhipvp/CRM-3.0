import React, { useMemo, useState } from 'react';

import type { FilterParams } from '../../api';
import type { Payment, Policy } from '../../types';
import { FilterBar } from '../FilterBar';
import { PanelMessage } from '../PanelMessage';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  TABLE_CELL_CLASS_LG,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { formatCurrencyRu, formatDateRu } from '../../utils/formatting';

type IncomeExpenseSortKey = 'actualDate' | 'scheduledDate' | 'payment' | 'record';

const INCOME_EXPENSE_SORT_OPTIONS = [
  { value: '-actualDate', label: 'Фактическая дата (новые)' },
  { value: 'actualDate', label: 'Фактическая дата (старые)' },
  { value: '-scheduledDate', label: 'Плановая дата (новые)' },
  { value: 'scheduledDate', label: 'Плановая дата (старые)' },
  { value: '-payment', label: 'Платеж (больше)' },
  { value: 'payment', label: 'Платеж (меньше)' },
  { value: '-record', label: 'Расход/доход (больше)' },
  { value: 'record', label: 'Расход/доход (меньше)' },
];

interface CommissionsViewProps {
  payments: Payment[];
  policies: Policy[];
}

const buildPaymentTotals = (payment: Payment): { income: number; expense: number } => {
  const records = payment.financialRecords ?? [];
  return records.reduce(
    (acc, record) => {
      const amount = Number(record.amount);
      if (!Number.isFinite(amount) || amount === 0) {
        return acc;
      }
      if (amount > 0) {
        return { ...acc, income: acc.income + amount };
      }
      return { ...acc, expense: acc.expense + Math.abs(amount) };
    },
    { income: 0, expense: 0 }
  );
};

export const CommissionsView: React.FC<CommissionsViewProps> = ({
  payments,
  policies,
}) => {
  const [filters, setFilters] = useState<FilterParams>({});

  const policiesById = useMemo(
    () => new Map(policies.map((policy) => [policy.id, policy])),
    [policies]
  );

  const totalsByPaymentId = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    payments.forEach((payment) => {
      map.set(payment.id, buildPaymentTotals(payment));
    });
    return map;
  }, [payments]);

  const filteredPayments = useMemo(() => {
    let result = [...payments];
    const search = (filters.search ?? '').toString().toLowerCase().trim();

    if (search) {
      result = result.filter((payment) => {
        const policyNumber =
          payment.policyNumber ??
          policiesById.get(payment.policyId ?? '')?.number ??
          '';
        const haystack = [
          payment.policyInsuranceType,
          policyNumber,
          payment.dealTitle,
          payment.dealClientName,
          payment.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    const ordering = (filters.ordering as string) || '-actualDate';
    const direction = ordering.startsWith('-') ? -1 : 1;
    const field = (ordering.replace(/^-/, '') as IncomeExpenseSortKey) || 'actualDate';

    const resolveSortValue = (payment: Payment): number => {
      switch (field) {
        case 'payment':
          return Number(payment.amount) || 0;
        case 'record': {
          const totals = totalsByPaymentId.get(payment.id) ?? { income: 0, expense: 0 };
          return totals.income - totals.expense;
        }
        case 'scheduledDate':
          return payment.scheduledDate ? new Date(payment.scheduledDate).getTime() : 0;
        case 'actualDate':
        default:
          return payment.actualDate ? new Date(payment.actualDate).getTime() : 0;
      }
    };

    result.sort((a, b) => (resolveSortValue(a) - resolveSortValue(b)) * direction);
    return result;
  }, [filters, payments, policiesById, totalsByPaymentId]);

  return (
    <section aria-labelledby="commissionsViewHeading" className="app-panel p-6 shadow-none space-y-4">
      <h1 id="commissionsViewHeading" className="sr-only">
        Доходы и расходы
      </h1>
      <FilterBar
        onFilterChange={setFilters}
        searchPlaceholder="Поиск по полису, сделке или клиенту..."
        sortOptions={INCOME_EXPENSE_SORT_OPTIONS}
      />

      <div className="app-panel shadow-none overflow-hidden">
        <div className="overflow-x-auto bg-white">
          <table className="deals-table min-w-full border-collapse text-left text-sm" aria-label="Доходы и расходы">
            <thead className={TABLE_THEAD_CLASS}>
              <tr>
                <TableHeadCell className="min-w-[260px]">ФИО клиента</TableHeadCell>
                <TableHeadCell className="min-w-[160px]">Номер полиса</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Полис</TableHeadCell>
                <TableHeadCell className="min-w-[160px]">Платеж</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Расход/доход</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Дата оплаты</TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredPayments.map((payment) => {
                const policyNumber =
                  payment.policyNumber ??
                  policiesById.get(payment.policyId ?? '')?.number ??
                  '-';
                const policyType =
                  payment.policyInsuranceType ??
                  policiesById.get(payment.policyId ?? '')?.insuranceType ??
                  '-';
                const clientName = payment.dealClientName ?? '-';
                const dealTitle = payment.dealTitle ?? '-';
                const totals = totalsByPaymentId.get(payment.id) ?? { income: 0, expense: 0 };
                const incomeLabel =
                  totals.income > 0 ? `Доход ${formatCurrencyRu(totals.income)}` : 'Доход —';
                const expenseLabel =
                  totals.expense > 0 ? `Расход ${formatCurrencyRu(totals.expense)}` : 'Расход —';
                const actualDate = payment.actualDate ? formatDateRu(payment.actualDate) : null;
                const scheduledDate = payment.scheduledDate ? formatDateRu(payment.scheduledDate) : null;

                return (
                  <tr key={payment.id} className={TABLE_ROW_CLASS}>
                    <td className={TABLE_CELL_CLASS_LG}>
                      <p className="text-base font-semibold text-slate-900">{clientName}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {dealTitle} · {clientName}
                      </p>
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      {policyNumber}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>{policyType}</td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700 font-semibold`}>
                      {formatCurrencyRu(payment.amount)}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      <p className="text-sm font-semibold text-emerald-700">{incomeLabel}</p>
                      <p className="text-sm font-semibold text-rose-700">{expenseLabel}</p>
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      <p className="text-sm text-slate-900">
                        {actualDate ?? scheduledDate ?? formatDateRu(undefined)}
                      </p>
                      {actualDate && scheduledDate && actualDate !== scheduledDate && (
                        <p className="text-xs text-slate-500">План: {scheduledDate}</p>
                      )}
                      {!actualDate && scheduledDate && (
                        <p className="text-xs text-slate-500">Плановая дата</p>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredPayments.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="border border-slate-200 px-6 py-10 text-center text-slate-600"
                  >
                    <PanelMessage>Записей пока нет</PanelMessage>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
