import React, { useMemo, useState } from 'react';
import { Payment } from '../../types';
import { FilterBar } from '../FilterBar';
import { PanelMessage } from '../PanelMessage';
import { TableHeadCell } from '../common/TableHeadCell';
import { FilterParams } from '../../api';

type PaymentSortKey = 'scheduledDate' | 'actualDate' | 'amount';

const PAYMENT_SORT_OPTIONS = [
  { value: '-scheduledDate', label: 'Плановая дата (новые)' },
  { value: 'scheduledDate', label: 'Плановая дата (старые)' },
  { value: '-actualDate', label: 'Фактическая дата (новые)' },
  { value: 'actualDate', label: 'Фактическая дата (старые)' },
  { value: '-amount', label: 'Сумма (большие)' },
  { value: 'amount', label: 'Сумма (меньшие)' },
];

const PAID_STATUS_FILTERS = [
  { value: 'pending', label: 'Ожидают оплаты' },
  { value: 'paid', label: 'Оплаченные' },
];

const getPaymentSortValue = (payment: Payment, key: PaymentSortKey): number => {
  switch (key) {
    case 'amount':
      return Number(payment.amount) || 0;
    case 'actualDate':
      return payment.actualDate ? new Date(payment.actualDate).getTime() : 0;
    case 'scheduledDate':
    default:
      return payment.scheduledDate ? new Date(payment.scheduledDate).getTime() : 0;
  }
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('ru-RU') : '—';

interface PaymentsViewProps {
  payments: Payment[];
  onMarkPaid: (paymentId: string) => Promise<void>;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ payments, onMarkPaid }) => {
  const [filters, setFilters] = useState<FilterParams>({});

  const filteredPayments = useMemo(() => {
    let result = [...payments];

    const search = (filters.search ?? '').toString().toLowerCase().trim();
    if (search) {
      result = result.filter((payment) => {
        const haystack = [
          payment.dealTitle,
          payment.dealClientName,
          payment.policyNumber,
          payment.description,
          payment.note,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    if (filters.paidStatus === 'paid') {
      result = result.filter((payment) => Boolean(payment.actualDate));
    } else if (filters.paidStatus === 'pending') {
      result = result.filter((payment) => !payment.actualDate);
    }

    const ordering = (filters.ordering as string) || '-scheduledDate';
    const direction = ordering.startsWith('-') ? -1 : 1;
    const field = (ordering.replace(/^-/, '') as PaymentSortKey) || 'scheduledDate';

    result.sort((a, b) => (getPaymentSortValue(a, field) - getPaymentSortValue(b, field)) * direction);
    return result;
  }, [filters, payments]);

  return (
    <div className="space-y-4">
      <FilterBar
        onFilterChange={setFilters}
        searchPlaceholder="Поиск по сделке, полису или описанию..."
        sortOptions={PAYMENT_SORT_OPTIONS}
        customFilters={[
          {
            key: 'paidStatus',
            label: 'Статус оплаты',
            type: 'select',
            options: PAID_STATUS_FILTERS,
          },
        ]}
      />
      <div className="app-panel shadow-none overflow-hidden">
        <div className="overflow-x-auto bg-white">
          <table className="deals-table min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/90 backdrop-blur border-b border-slate-200">
              <tr>
                <TableHeadCell className="min-w-[260px]">Сделка</TableHeadCell>
                <TableHeadCell className="min-w-[160px]">Сумма</TableHeadCell>
                <TableHeadCell className="min-w-[170px]">Плановая дата</TableHeadCell>
                <TableHeadCell className="min-w-[170px]">Фактическая дата</TableHeadCell>
                <TableHeadCell align="right" className="min-w-[200px]">
                  Действие
                </TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredPayments.map((payment) => {
                const dealTitle = payment.dealTitle || '-';
                const clientName = payment.dealClientName || '-';

                return (
                  <tr
                    key={payment.id}
                    className="transition-colors even:bg-slate-50/40 border-l-4 border-transparent hover:bg-slate-50/80 hover:border-sky-500"
                  >
                    <td className="border border-slate-200 px-6 py-3">
                      <p className="text-base font-semibold text-slate-900">{dealTitle}</p>
                      <p className="text-xs text-slate-500 mt-1">{clientName}</p>
                    </td>
                    <td className="border border-slate-200 px-6 py-3 text-slate-700 font-semibold">
                      {Number(payment.amount).toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                      })}
                    </td>
                    <td className="border border-slate-200 px-6 py-3 text-slate-700">
                      {formatDate(payment.scheduledDate)}
                    </td>
                    <td className="border border-slate-200 px-6 py-3 text-slate-700">
                      {formatDate(payment.actualDate)}
                    </td>
                    <td className="border border-slate-200 px-6 py-3 text-right">
                      {!payment.actualDate ? (
                        <button
                          type="button"
                          onClick={() => onMarkPaid(payment.id)}
                          className="btn btn-secondary btn-sm rounded-xl"
                        >
                          Отметить оплаченным
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-700 font-semibold">Оплачен</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredPayments.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="border border-slate-200 px-6 py-10 text-center text-slate-600"
                  >
                    <PanelMessage>Платежей пока нет</PanelMessage>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
