import React, { useEffect, useMemo, useState } from 'react';
import { Client, Payment, Policy } from '../../types';
import { FilterBar } from '../FilterBar';
import { PanelMessage } from '../PanelMessage';
import { FilterParams } from '../../api';
import {
  getPolicyTransportSummary,
  policyHasUnpaidPayments,
  policyHasUnpaidRecords,
} from './dealsView/helpers';
import { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { ColoredLabel } from '../common/ColoredLabel';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  TABLE_CELL_CLASS_MD,
  TABLE_ROW_CLASS,
  TABLE_ROW_CLASS_PLAIN,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { PaymentCard } from '../policies/PaymentCard';
import { buildPolicyCardModel } from '../policies/policyCardModel';
import { POLICY_TEXT } from '../policies/text';
import { getPolicyExpiryBadge } from '../policies/policyIndicators';
import { FinancialRecordModal } from '../financialRecords/FinancialRecordModal';
import { useFinancialRecordModal } from '../../hooks/useFinancialRecordModal';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PolicyNumberButton } from '../policies/PolicyNumberButton';

const POLICY_SORT_OPTIONS = [
  { value: '-start_date', label: 'Начало (убывание)' },
  { value: 'start_date', label: 'Начало (возрастание)' },
  { value: '-end_date', label: 'Окончание (убывание)' },
  { value: 'end_date', label: 'Окончание (возрастание)' },
  { value: '-number', label: 'Номер (Z → A)' },
  { value: 'number', label: 'Номер (A → Z)' },
  { value: '-client', label: 'Клиент (Z → A)' },
  { value: 'client', label: 'Клиент (A → Z)' },
];

interface PoliciesViewProps {
  policies: Policy[];
  payments: Payment[];
  clients?: Client[];
  onDealSelect?: (dealId: string) => void;
  onDealPreview?: (dealId: string) => void;
  onClientEdit?: (client: Client) => void;
  onRequestEditPolicy?: (policy: Policy) => void;
  onLoadMorePolicies?: () => Promise<void>;
  policiesHasMore?: boolean;
  isLoadingMorePolicies?: boolean;
  isPoliciesLoading?: boolean;
  onRefreshPoliciesList?: (filters?: FilterParams) => Promise<void>;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  policies,
  payments,
  onLoadMorePolicies,
  policiesHasMore = false,
  isLoadingMorePolicies = false,
  isPoliciesLoading = false,
  onRefreshPoliciesList,
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
}) => {
  const [filters, setFilters] = useState<FilterParams>({ ordering: '-start_date' });
  const rawSearch = (filters.search ?? '').trim();
  const debouncedSearch = useDebouncedValue(rawSearch, 450);
  const isDebouncePending = Boolean(onRefreshPoliciesList) && rawSearch !== debouncedSearch;
  const showUnpaidPaymentsOnly = filters.unpaid_payments === 'true';
  const showUnpaidRecordsOnly = filters.unpaid_records === 'true';
  const shouldRequestUnpaid = showUnpaidPaymentsOnly || showUnpaidRecordsOnly;
  const serverFilters = useMemo(
    () => ({
      ordering: filters.ordering,
      search: debouncedSearch || undefined,
      unpaid: shouldRequestUnpaid || undefined,
    }),
    [debouncedSearch, filters.ordering, shouldRequestUnpaid],
  );
  const paymentsByPolicyMap = useMemo(() => {
    const map = new Map<string, Payment[]>();
    payments.forEach((payment) => {
      const policyId = payment.policyId;
      if (!policyId) {
        return;
      }
      const current = map.get(policyId) ?? [];
      current.push(payment);
      map.set(policyId, current);
    });
    return map;
  }, [payments]);

  const allFinancialRecords = useMemo(
    () => payments.flatMap((payment) => payment.financialRecords ?? []),
    [payments],
  );
  const unpaidPaymentsPolicies = useMemo(() => {
    const set = new Set<string>();
    policies.forEach((policy) => {
      if (policyHasUnpaidPayments(policy.id, paymentsByPolicyMap)) {
        set.add(policy.id);
      }
    });
    return set;
  }, [paymentsByPolicyMap, policies]);
  const unpaidRecordsPolicies = useMemo(() => {
    const set = new Set<string>();
    policies.forEach((policy) => {
      if (policyHasUnpaidRecords(policy.id, paymentsByPolicyMap, allFinancialRecords)) {
        set.add(policy.id);
      }
    });
    return set;
  }, [allFinancialRecords, paymentsByPolicyMap, policies]);

  const filteredPolicies = useMemo(() => {
    let result = [...policies];

    const shouldFilterUnpaid = showUnpaidPaymentsOnly || showUnpaidRecordsOnly;
    if (shouldFilterUnpaid) {
      result = result.filter((policy) => {
        const hasUnpaidPayments = unpaidPaymentsPolicies.has(policy.id);
        const hasUnpaidRecords = unpaidRecordsPolicies.has(policy.id);
        return (
          (showUnpaidPaymentsOnly && hasUnpaidPayments) ||
          (showUnpaidRecordsOnly && hasUnpaidRecords)
        );
      });
    }

    return result;
  }, [
    policies,
    showUnpaidPaymentsOnly,
    showUnpaidRecordsOnly,
    unpaidPaymentsPolicies,
    unpaidRecordsPolicies,
  ]);

  useEffect(() => {
    if (!onRefreshPoliciesList) {
      return;
    }
    void onRefreshPoliciesList(serverFilters);
  }, [onRefreshPoliciesList, serverFilters]);

  const customFilters = [
    {
      key: 'unpaid_payments',
      label: POLICY_TEXT.filters.unpaidPaymentsOnly,
      type: 'checkbox' as const,
    },
    {
      key: 'unpaid_records',
      label: POLICY_TEXT.filters.unpaidRecordsOnly,
      type: 'checkbox' as const,
    },
  ];

  const paymentsByPolicy = useMemo(
    () =>
      filteredPolicies.map((policy) => ({
        policy,
        payments: paymentsByPolicyMap.get(policy.id) ?? [],
      })),
    [filteredPolicies, paymentsByPolicyMap],
  );

  const {
    isOpen: isFinancialRecordModalOpen,
    paymentId: financialRecordPaymentId,
    defaultRecordType: financialRecordDefaultRecordType,
    editingFinancialRecord,
    editingFinancialRecordId,
    openCreateFinancialRecord,
    openEditFinancialRecord,
    closeFinancialRecordModal,
  } = useFinancialRecordModal(allFinancialRecords);

  return (
    <section aria-labelledby="policiesViewHeading" className="app-panel p-6 shadow-none space-y-4">
      <h1 id="policiesViewHeading" className="sr-only">
        Полисы
      </h1>
      <div className="flex flex-col gap-3">
        <FilterBar
          onFilterChange={setFilters}
          searchPlaceholder="Поиск по номеру, клиенту или компании..."
          initialFilters={{ ordering: '-start_date' }}
          sortOptions={POLICY_SORT_OPTIONS}
          customFilters={customFilters}
        />
        {isDebouncePending && <div className="text-xs text-slate-500">Применяю фильтр...</div>}
        <div className="flex flex-wrap gap-3" />
      </div>

      {filteredPolicies.length ? (
        <div className="app-panel shadow-none overflow-hidden">
          <div className="overflow-x-auto bg-white">
            <table
              className="deals-table w-full table-fixed border-collapse text-left text-sm"
              aria-label="Список полисов"
            >
              <thead className={TABLE_THEAD_CLASS}>
                <tr>
                  <TableHeadCell padding="md" className="w-[18%]">
                    Полис
                  </TableHeadCell>
                  <TableHeadCell padding="md" className="w-[16%]">
                    Клиент
                  </TableHeadCell>
                  <TableHeadCell padding="md" className="w-[18%]">
                    Компания
                  </TableHeadCell>
                  <TableHeadCell padding="md" className="w-[18%]">
                    Тип / ТС
                  </TableHeadCell>
                  <TableHeadCell padding="md" className="w-[12%]">
                    Канал
                  </TableHeadCell>
                  <TableHeadCell padding="md" align="right" className="w-[18%]">
                    Сумма
                  </TableHeadCell>
                </tr>
              </thead>
              <tbody className="bg-white">
                {paymentsByPolicy.map(({ policy, payments }) => {
                  const paymentsPanelId = `policy-${policy.id}-payments`;
                  const model = buildPolicyCardModel(policy, payments);
                  const hasUnpaidPayments = unpaidPaymentsPolicies.has(policy.id);
                  const hasUnpaidRecords = unpaidRecordsPolicies.has(policy.id);
                  const expiryBadge = getPolicyExpiryBadge(policy.endDate);
                  const transportSummary = policy.isVehicle
                    ? getPolicyTransportSummary(policy)
                    : '';

                  return (
                    <React.Fragment key={policy.id}>
                      <tr className={`${TABLE_ROW_CLASS} border-t-2 border-slate-300`}>
                        <td className={TABLE_CELL_CLASS_MD}>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <PolicyNumberButton
                                value={model.number}
                                className="text-sm font-semibold text-slate-900 underline underline-offset-2 decoration-dotted decoration-slate-300 transition hover:decoration-slate-500"
                              />
                              {hasUnpaidPayments && (
                                <span
                                  className={[
                                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                    expiryBadge?.tone === 'red'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-orange-100 text-orange-700',
                                  ].join(' ')}
                                >
                                  {POLICY_TEXT.badges.unpaidPayments}
                                </span>
                              )}
                              {hasUnpaidRecords && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                  {POLICY_TEXT.badges.unpaidRecords}
                                </span>
                              )}
                              {expiryBadge && (
                                <span
                                  className={[
                                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                    expiryBadge.tone === 'red'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-orange-100 text-orange-700',
                                  ].join(' ')}
                                >
                                  {expiryBadge.label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              Начало: {model.startDate} · Окончание: {model.endDate}
                            </p>
                          </div>
                        </td>
                        <td className={TABLE_CELL_CLASS_MD}>
                          <p className="text-sm font-semibold text-slate-900 break-words">
                            {model.client}
                          </p>
                        </td>
                        <td className={TABLE_CELL_CLASS_MD}>
                          <div className="min-w-0">
                            <ColoredLabel
                              value={policy.insuranceCompany}
                              showDot
                              className="max-w-full truncate font-semibold text-slate-900"
                            />
                          </div>
                        </td>
                        <td className={TABLE_CELL_CLASS_MD}>
                          <p className="text-sm font-semibold text-slate-900 break-words">
                            {model.insuranceType}
                          </p>
                          {transportSummary && (
                            <p className="mt-1 text-xs text-slate-500">{transportSummary}</p>
                          )}
                        </td>
                        <td className={`${TABLE_CELL_CLASS_MD} text-slate-700 break-words`}>
                          {model.salesChannel}
                        </td>
                        <td className={`${TABLE_CELL_CLASS_MD} text-right`}>
                          <p className="text-sm font-semibold text-slate-900">{model.sum}</p>
                        </td>
                      </tr>
                      <tr className={`${TABLE_ROW_CLASS_PLAIN} border-t border-slate-200`}>
                        <td
                          colSpan={6}
                          className="border border-slate-200 border-b-2 border-slate-300 bg-slate-50/70 px-4 py-3"
                        >
                          <div id={paymentsPanelId} className="space-y-2">
                            {payments.length ? (
                              payments.map((payment) => (
                                <PaymentCard
                                  key={payment.id}
                                  payment={payment}
                                  onRequestAddRecord={openCreateFinancialRecord}
                                  onEditFinancialRecord={openEditFinancialRecord}
                                  onDeleteFinancialRecord={onDeleteFinancialRecord}
                                  variant="table"
                                />
                              ))
                            ) : (
                              <PanelMessage>{POLICY_TEXT.messages.noPayments}</PanelMessage>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
          {isPoliciesLoading ? 'Загрузка полисов...' : 'Нет полисов для отображения'}
        </div>
      )}

      {policiesHasMore && onLoadMorePolicies && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center">
          <button
            type="button"
            onClick={() => {
              void onLoadMorePolicies();
            }}
            disabled={isLoadingMorePolicies}
            className="btn btn-quiet btn-sm rounded-xl"
          >
            {isLoadingMorePolicies ? 'Загрузка...' : 'Показать ещё'}
          </button>
        </div>
      )}

      {isFinancialRecordModalOpen && (
        <FinancialRecordModal
          isOpen
          title={editingFinancialRecordId ? 'Изменить запись' : 'Добавить запись'}
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
