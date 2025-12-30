import React, { useMemo, useState } from 'react';

import type { FilterParams } from '../../api';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../forms/AddPaymentForm';
import type { Payment, Policy } from '../../types';
import { FilterBar } from '../FilterBar';
import { PanelMessage } from '../PanelMessage';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  TABLE_ACTIONS_CLASS_ROW,
  TABLE_CELL_CLASS_LG,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { formatCurrencyRu, formatDateRu } from '../../utils/formatting';
import { PaymentModal } from '../payments/PaymentModal';
import { usePaymentModal } from '../../hooks/usePaymentModal';
import { FinancialRecordModal } from '../financialRecords/FinancialRecordModal';
import { useFinancialRecordModal } from '../../hooks/useFinancialRecordModal';

type CommissionSortKey = 'actualDate' | 'scheduledDate' | 'amount' | 'expense';

const COMMISSION_SORT_OPTIONS = [
  { value: '-actualDate', label: 'Фактическая дата (новые)' },
  { value: 'actualDate', label: 'Фактическая дата (старые)' },
  { value: '-scheduledDate', label: 'Плановая дата (новые)' },
  { value: 'scheduledDate', label: 'Плановая дата (старые)' },
  { value: '-amount', label: 'Комиссия (больше)' },
  { value: 'amount', label: 'Комиссия (меньше)' },
  { value: '-expense', label: 'Расходы (больше)' },
  { value: 'expense', label: 'Расходы (меньше)' },
];

interface CommissionsViewProps {
  payments: Payment[];
  policies: Policy[];
  onAddPayment: (values: AddPaymentFormValues) => Promise<void>;
  onUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord: (recordId: string, values: AddFinancialRecordFormValues) => Promise<void>;
}

const buildPaymentExpenses = (payment: Payment): number => {
  const records = payment.financialRecords ?? [];
  return records.reduce((sum, record) => {
    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount >= 0) {
      return sum;
    }
    return sum + Math.abs(amount);
  }, 0);
};

export const CommissionsView: React.FC<CommissionsViewProps> = ({
  payments,
  policies,
  onAddPayment,
  onUpdatePayment,
  onAddFinancialRecord,
  onUpdateFinancialRecord,
}) => {
  const [filters, setFilters] = useState<FilterParams>({});

  const policiesById = useMemo(
    () => new Map(policies.map((policy) => [policy.id, policy])),
    [policies]
  );

  const expensesByPaymentId = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((payment) => {
      map.set(payment.id, buildPaymentExpenses(payment));
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
    const field = (ordering.replace(/^-/, '') as CommissionSortKey) || 'actualDate';

    const resolveSortValue = (payment: Payment): number => {
      switch (field) {
        case 'amount':
          return Number(payment.amount) || 0;
        case 'scheduledDate':
          return payment.scheduledDate ? new Date(payment.scheduledDate).getTime() : 0;
        case 'expense':
          return expensesByPaymentId.get(payment.id) ?? 0;
        case 'actualDate':
        default:
          return payment.actualDate ? new Date(payment.actualDate).getTime() : 0;
      }
    };

    result.sort((a, b) => (resolveSortValue(a) - resolveSortValue(b)) * direction);
    return result;
  }, [expensesByPaymentId, filters, payments, policiesById]);

  const allFinancialRecords = useMemo(
    () => payments.flatMap((payment) => payment.financialRecords ?? []),
    [payments]
  );

  const {
    isOpen: isPaymentModalOpen,
    editingPaymentId,
    editingPayment,
    fixedPolicyId,
    openCreatePayment,
    openEditPayment,
    closePaymentModal,
  } = usePaymentModal(payments);

  const {
    isOpen: isFinancialRecordModalOpen,
    paymentId: financialRecordPaymentId,
    defaultRecordType: financialRecordDefaultRecordType,
    editingFinancialRecord,
    editingFinancialRecordId,
    openCreateFinancialRecord,
    closeFinancialRecordModal,
  } = useFinancialRecordModal(allFinancialRecords);

  return (
    <section aria-labelledby="commissionsViewHeading" className="app-panel p-6 shadow-none space-y-4">
      <h1 id="commissionsViewHeading" className="sr-only">
        Комиссии и выплаты
      </h1>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <FilterBar
            onFilterChange={setFilters}
            searchPlaceholder="Поиск по полису, сделке или клиенту..."
            sortOptions={COMMISSION_SORT_OPTIONS}
          />
        </div>
        <button
          type="button"
          onClick={() => openCreatePayment()}
          className="btn btn-primary rounded-xl"
        >
          + Добавить выплату
        </button>
      </div>

      <div className="app-panel shadow-none overflow-hidden">
        <div className="overflow-x-auto bg-white">
          <table className="deals-table min-w-full border-collapse text-left text-sm" aria-label="Комиссии и выплаты">
            <thead className={TABLE_THEAD_CLASS}>
              <tr>
                <TableHeadCell className="min-w-[220px]">Полис</TableHeadCell>
                <TableHeadCell className="min-w-[160px]">Комиссия</TableHeadCell>
                <TableHeadCell className="min-w-[160px]">Расходы</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Дата оплаты</TableHeadCell>
                <TableHeadCell align="right" className="min-w-[220px]">
                  Действия
                </TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredPayments.map((payment) => {
                const policyNumber =
                  payment.policyNumber ??
                  policiesById.get(payment.policyId ?? '')?.number ??
                  '-';
                const policyMeta =
                  payment.dealClientName ??
                  payment.dealTitle ??
                  policiesById.get(payment.policyId ?? '')?.dealTitle ??
                  '-';
                const expenses = expensesByPaymentId.get(payment.id) ?? 0;
                const actualDate = payment.actualDate ? formatDateRu(payment.actualDate) : null;
                const scheduledDate = payment.scheduledDate ? formatDateRu(payment.scheduledDate) : null;

                return (
                  <tr key={payment.id} className={TABLE_ROW_CLASS}>
                    <td className={TABLE_CELL_CLASS_LG}>
                      <p className="text-base font-semibold text-slate-900">{policyNumber}</p>
                      <p className="text-xs text-slate-500 mt-1">{policyMeta}</p>
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700 font-semibold`}>
                      {formatCurrencyRu(payment.amount)}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      {formatCurrencyRu(expenses)}
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
                    <td className={`${TABLE_CELL_CLASS_LG} text-right`}>
                      <div className={TABLE_ACTIONS_CLASS_ROW}>
                        <button
                          type="button"
                          onClick={() => openEditPayment(payment.id)}
                          className="btn btn-secondary btn-sm rounded-xl"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={() => openCreateFinancialRecord(payment.id, 'expense')}
                          className="btn btn-quiet btn-sm rounded-xl"
                        >
                          Добавить расход
                        </button>
                      </div>
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
                    <PanelMessage>Выплат пока нет</PanelMessage>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isPaymentModalOpen && (
        <PaymentModal
          isOpen
          title={editingPaymentId === 'new' ? 'Добавить выплату' : 'Редактировать выплату'}
          payment={editingPayment}
          policies={policies}
          fixedPolicyId={fixedPolicyId}
          onClose={closePaymentModal}
          onSubmit={async (values) => {
            if (editingPaymentId === 'new') {
              await onAddPayment(values);
            } else if (editingPaymentId) {
              await onUpdatePayment(editingPaymentId, values);
            }
            closePaymentModal();
          }}
        />
      )}

      {isFinancialRecordModalOpen && (
        <FinancialRecordModal
          isOpen
          title={editingFinancialRecordId ? 'Изменить расход' : 'Добавить расход'}
          onClose={closeFinancialRecordModal}
          paymentId={financialRecordPaymentId}
          defaultRecordType={financialRecordDefaultRecordType}
          record={editingFinancialRecord}
          onSubmit={async (values) => {
            if (editingFinancialRecordId) {
              await onUpdateFinancialRecord(editingFinancialRecordId, values);
            } else {
              await onAddFinancialRecord(values);
            }
            closeFinancialRecordModal();
          }}
        />
      )}
    </section>
  );
};
