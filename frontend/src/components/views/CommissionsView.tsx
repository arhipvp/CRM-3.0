import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

type IncomeExpenseSortKey = 'recordDate' | 'payment' | 'record';

const INCOME_EXPENSE_SORT_OPTIONS = [
  { value: '-recordDate', label: 'Дата оплаты (новые)' },
  { value: 'recordDate', label: 'Дата оплаты (старые)' },
  { value: '-payment', label: 'Платеж (больше)' },
  { value: 'payment', label: 'Платеж (меньше)' },
  { value: '-record', label: 'Расход/доход (больше)' },
  { value: 'record', label: 'Расход/доход (меньше)' },
];

interface CommissionsViewProps {
  payments: Payment[];
  policies: Policy[];
  onDealSelect?: (dealId: string) => void;
  onRequestEditPolicy?: (policy: Policy) => void;
  onUpdateFinancialRecord?: (recordId: string, values: { date?: string | null }) => Promise<void>;
}

type IncomeExpenseRow = {
  key: string;
  payment: Payment;
  recordId: string;
  recordAmount: number;
  recordDate?: string | null;
  recordDescription?: string;
  recordNote?: string;
};

export const CommissionsView: React.FC<CommissionsViewProps> = ({
  payments,
  policies,
  onDealSelect,
  onRequestEditPolicy,
  onUpdateFinancialRecord,
}) => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterParams>({});

  const policiesById = useMemo(
    () => new Map(policies.map((policy) => [policy.id, policy])),
    [policies]
  );

  const rows = useMemo<IncomeExpenseRow[]>(() => {
    const result: IncomeExpenseRow[] = [];
    payments.forEach((payment) => {
      const records = payment.financialRecords ?? [];
      records.forEach((record) => {
        const amount = Number(record.amount);
        if (!Number.isFinite(amount) || amount === 0) {
          return;
        }
        result.push({
          key: `${payment.id}-${record.id}`,
          payment,
          recordId: record.id,
          recordAmount: amount,
          recordDate: record.date ?? null,
          recordDescription: record.description,
          recordNote: record.note,
        });
      });
    });
    return result;
  }, [payments]);

  const filteredRows = useMemo(() => {
    let result = [...rows];
    const search = (filters.search ?? '').toString().toLowerCase().trim();

    if (search) {
      result = result.filter((row) => {
        const payment = row.payment;
        const policyNumber =
          payment.policyNumber ??
          policiesById.get(payment.policyId ?? '')?.number ??
          '';
        const salesChannel =
          policiesById.get(payment.policyId ?? '')?.salesChannelName ??
          policiesById.get(payment.policyId ?? '')?.salesChannel ??
          '';
        const haystack = [
          payment.policyInsuranceType,
          policyNumber,
          salesChannel,
          payment.dealTitle,
          payment.dealClientName,
          payment.description,
          row.recordDescription,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    const ordering = (filters.ordering as string) || '-recordDate';
    const direction = ordering.startsWith('-') ? -1 : 1;
    const field = (ordering.replace(/^-/, '') as IncomeExpenseSortKey) || 'recordDate';

    const resolveSortValue = (row: IncomeExpenseRow): number => {
      switch (field) {
        case 'payment':
          return Number(row.payment.amount) || 0;
        case 'record':
          return Math.abs(row.recordAmount) || 0;
        case 'recordDate':
        default:
          return row.recordDate ? new Date(row.recordDate).getTime() : 0;
      }
    };

    result.sort((a, b) => (resolveSortValue(a) - resolveSortValue(b)) * direction);
    return result;
  }, [filters, policiesById, rows]);

  const handleOpenDeal = useCallback(
    (dealId: string | undefined) => {
      if (!dealId) {
        return;
      }
      onDealSelect?.(dealId);
      navigate('/deals');
    },
    [navigate, onDealSelect]
  );

  const handleRecordDateChange = useCallback(
    async (recordId: string, value: string) => {
      if (!onUpdateFinancialRecord) {
        return;
      }
      await onUpdateFinancialRecord(recordId, { date: value || null });
    },
    [onUpdateFinancialRecord]
  );

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
                <TableHeadCell className="min-w-[180px]">Канал продаж</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Платеж</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Расход/доход</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Дата оплаты</TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredRows.map((row) => {
                const payment = row.payment;
                const policyNumber =
                  payment.policyNumber ??
                  policiesById.get(payment.policyId ?? '')?.number ??
                  '-';
                const policyEntity = payment.policyId
                  ? policiesById.get(payment.policyId) ?? null
                  : null;
                const policyType =
                  payment.policyInsuranceType ??
                  policiesById.get(payment.policyId ?? '')?.insuranceType ??
                  '-';
                const salesChannelLabel =
                  policiesById.get(payment.policyId ?? '')?.salesChannelName ??
                  policiesById.get(payment.policyId ?? '')?.salesChannel ??
                  '-';
                  '-';
                const clientName = payment.dealClientName ?? '-';
                const dealTitle = payment.dealTitle ?? '-';
                const paymentActualDate = payment.actualDate ? formatDateRu(payment.actualDate) : null;
                const paymentScheduledDate = payment.scheduledDate
                  ? formatDateRu(payment.scheduledDate)
                  : null;
                const recordAmount = row.recordAmount;
                const isIncome = recordAmount > 0;
                const recordLabel = isIncome
                  ? `Доход ${formatCurrencyRu(recordAmount)}`
                  : `Расход ${formatCurrencyRu(Math.abs(recordAmount))}`;
                const recordClass = isIncome ? 'text-emerald-700' : 'text-rose-700';
                const recordDateLabel = formatDateRu(row.recordDate);
                const recordNotes = [
                  row.recordDescription,
                  row.recordNote,
                ]
                  .map((value) => value?.toString().trim())
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <tr key={row.key} className={TABLE_ROW_CLASS}>
                    <td className={TABLE_CELL_CLASS_LG}>
                      <p className="text-base font-semibold text-slate-900">{clientName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        {payment.dealId && onDealSelect ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDeal(payment.dealId)}
                            className="link-action text-xs font-semibold"
                          >
                            {dealTitle}
                          </button>
                        ) : (
                          <span>{dealTitle}</span>
                        )}
                        <span>·</span>
                        <span>{clientName}</span>
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      {policyEntity && onRequestEditPolicy ? (
                        <button
                          type="button"
                          onClick={() => onRequestEditPolicy(policyEntity)}
                          className="link-action text-left"
                        >
                          {policyNumber}
                        </button>
                      ) : (
                        policyNumber
                      )}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>{policyType}</td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>{salesChannelLabel}</td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      <p className="text-base font-semibold">{formatCurrencyRu(payment.amount)}</p>
                      {paymentActualDate ? (
                        <p className="text-xs text-slate-500 mt-1">Оплата: {paymentActualDate}</p>
                      ) : paymentScheduledDate ? (
                        <p className="text-xs text-slate-500 mt-1">План: {paymentScheduledDate}</p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1">Оплата: —</p>
                      )}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      <p className={`text-sm font-semibold ${recordClass}`}>{recordLabel}</p>
                      {recordNotes ? (
                        <p className="text-xs text-slate-500 mt-1">{recordNotes}</p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">Примечаний нет</p>
                      )}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      <p className="text-sm text-slate-900">{recordDateLabel}</p>
                      {onUpdateFinancialRecord && (
                        <input
                          type="date"
                          value={row.recordDate ?? ''}
                          onChange={(event) =>
                            handleRecordDateChange(row.recordId, event.target.value)
                          }
                          className="mt-2 w-full max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredRows.length && (
                <tr>
                  <td
                    colSpan={7}
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
