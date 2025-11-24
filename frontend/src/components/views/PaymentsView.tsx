import React, { useMemo, useState } from 'react';
import { Payment } from '../../types';
import { FilterBar } from '../FilterBar';
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
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide text-xs">
            <tr>
              <th className="px-5 py-3">Сделка</th>
              <th className="px-5 py-3">Сумма</th>
              <th className="px-5 py-3">Плановая дата</th>
              <th className="px-5 py-3">Фактическая дата</th>
              <th className="px-5 py-3 text-right">Действие</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment) => {
              const dealTitle = payment.dealTitle || '—';
              const clientName = payment.dealClientName || '—';
              return (
                <tr key={payment.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{dealTitle}</p>
                    <p className="text-xs text-slate-500">{clientName}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {Number(payment.amount).toLocaleString('ru-RU', {
                      style: 'currency',
                      currency: 'RUB',
                    })}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(payment.scheduledDate)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(payment.actualDate)}</td>
                  <td className="px-5 py-4 text-right">
                    {!payment.actualDate ? (
                      <button
                        onClick={() => onMarkPaid(payment.id)}
                        className="text-sky-600 font-semibold hover:text-sky-800"
                      >
                        Отметить оплаченным
                      </button>
                    ) : (
                      <span className="text-xs text-green-600 font-semibold">Оплачен</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filteredPayments.length && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                  Платежей пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
