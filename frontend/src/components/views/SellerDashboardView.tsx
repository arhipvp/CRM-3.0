import React, { useMemo } from 'react';
import type { Deal, Payment, Policy, User } from '../../types';
import { formatCurrencyRu, formatDateRu, RU_LOCALE } from '../../utils/formatting';
import { parseNumericAmount } from '../../utils/parseNumericAmount';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  TABLE_CELL_CLASS_MD,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';

interface SellerDashboardViewProps {
  policies: Policy[];
  payments: Payment[];
  deals: Deal[];
  currentUser: User | null;
}

const isPaymentPaid = (payment: Payment) => Boolean((payment.actualDate ?? '').trim());

const getPaidAmount = (payment: Payment) => {
  const amount = parseNumericAmount(payment.amount);
  return Number.isFinite(amount) ? amount : 0;
};

const isDateInCurrentMonth = (value?: string | null) => {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

export const SellerDashboardView: React.FC<SellerDashboardViewProps> = ({
  policies,
  payments,
  deals,
  currentUser,
}) => {
  const monthLabel = useMemo(
    () =>
      new Date().toLocaleDateString(RU_LOCALE, {
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  const dealsById = useMemo(() => {
    const map = new Map<string, Deal>();
    deals.forEach((deal) => {
      map.set(deal.id, deal);
    });
    return map;
  }, [deals]);

  const policiesForMonth = useMemo(() => {
    const currentUserId = currentUser?.id;
    if (!currentUserId) {
      return [];
    }
    return policies.filter((policy) => {
      const deal = dealsById.get(policy.dealId);
      if (!deal || deal.seller !== currentUserId) {
        return false;
      }
      return isDateInCurrentMonth(policy.startDate);
    });
  }, [currentUser?.id, dealsById, policies]);

  const paidPaymentsByPolicy = useMemo(() => {
    const map = new Map<string, number>();
    policiesForMonth.forEach((policy) => {
      map.set(policy.id, 0);
    });
    payments.forEach((payment) => {
      const policyId = payment.policyId;
      if (!policyId || !map.has(policyId) || !isPaymentPaid(payment)) {
        return;
      }
      map.set(policyId, (map.get(policyId) ?? 0) + getPaidAmount(payment));
    });
    return map;
  }, [payments, policiesForMonth]);

  const totalPaidAmount = useMemo(() => {
    let total = 0;
    paidPaymentsByPolicy.forEach((amount) => {
      total += amount;
    });
    return total;
  }, [paidPaymentsByPolicy]);

  const sortedPolicies = useMemo(() => {
    const list = [...policiesForMonth];
    list.sort((a, b) => {
      const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
      return bTime - aTime;
    });
    return list;
  }, [policiesForMonth]);

  const isEmpty = currentUser ? sortedPolicies.length === 0 : true;

  return (
    <section aria-labelledby="sellerDashboardHeading" className="space-y-6">
      <div className="app-panel p-6 shadow-none space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Дашборд продавца
            </p>
            <h1 id="sellerDashboardHeading" className="text-2xl font-semibold text-slate-900">
              Продажи за {monthLabel}
            </h1>
          </div>
          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
              Сумма оплаченных платежей
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatCurrencyRu(totalPaidAmount, '—')}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Учитываются только полисы с датой начала в текущем месяце и только оплаченные платежи.
        </p>
      </div>

      <section className="app-panel p-6 shadow-none space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Полисы текущего месяца</h2>
        {isEmpty ? (
          <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
            {currentUser
              ? 'В этом месяце у вас нет полисов с началом в текущем месяце.'
              : 'Нужен активный пользователь, чтобы показать продажи.'}
          </div>
        ) : (
          <div className="app-panel shadow-none overflow-hidden">
            <div className="overflow-x-auto bg-white">
              <table className="deals-table w-full table-fixed border-collapse text-left text-sm">
                <thead className={TABLE_THEAD_CLASS}>
                  <tr>
                    <TableHeadCell padding="md" className="w-[20%]">Полис</TableHeadCell>
                    <TableHeadCell padding="md" className="w-[26%]">Клиент</TableHeadCell>
                    <TableHeadCell padding="md" className="w-[20%]">Дата начала</TableHeadCell>
                    <TableHeadCell padding="md" align="right" className="w-[20%]">
                      Оплачено
                    </TableHeadCell>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {sortedPolicies.map((policy) => {
                    const paidAmount = paidPaymentsByPolicy.get(policy.id) ?? 0;
                    const clientLabel =
                      policy.insuredClientName ?? policy.clientName ?? '—';

                    return (
                      <tr key={policy.id} className={`${TABLE_ROW_CLASS} border-t border-slate-200`}>
                        <td className={TABLE_CELL_CLASS_MD}>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900 break-all">
                              {policy.number || '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {policy.insuranceCompany}
                            </p>
                          </div>
                        </td>
                        <td className={TABLE_CELL_CLASS_MD}>
                          <p className="text-sm font-semibold text-slate-900 break-words">{clientLabel}</p>
                          <p className="text-xs text-slate-500">{policy.insuranceType}</p>
                        </td>
                        <td className={TABLE_CELL_CLASS_MD}>
                          <p className="text-sm text-slate-700">{formatDateRu(policy.startDate)}</p>
                        </td>
                        <td className={`${TABLE_CELL_CLASS_MD} text-right`}>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrencyRu(paidAmount, '—')}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </section>
  );
};
