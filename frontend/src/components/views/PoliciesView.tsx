import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, Payment, Policy } from '../../types';
import { FilterBar } from '../FilterBar';
import { PanelMessage } from '../PanelMessage';
import { FilterParams } from '../../api';
import { DriveFilesModal } from '../DriveFilesModal';
import { getPolicyTransportSummary, policyHasUnpaidActivity } from './dealsView/helpers';
import { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { ColoredLabel } from '../common/ColoredLabel';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  TABLE_ACTIONS_CLASS_ROW_SM,
  TABLE_CELL_CLASS_LG,
  TABLE_ROW_CLASS,
  TABLE_ROW_CLASS_PLAIN,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { PaymentCard } from '../policies/PaymentCard';
import { buildPolicyCardModel } from '../policies/policyCardModel';
import { POLICY_TEXT } from '../policies/text';
import { buildPolicyNavigationActions } from '../policies/policyCardActions';
import { getPolicyExpiryBadge } from '../policies/policyIndicators';
import { usePoliciesExpansionState } from '../../hooks/usePoliciesExpansionState';
import { FinancialRecordModal } from '../financialRecords/FinancialRecordModal';
import { useFinancialRecordModal } from '../../hooks/useFinancialRecordModal';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

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
  onUpdateFinancialRecord: (recordId: string, values: AddFinancialRecordFormValues) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  policies,
  payments,
  clients,
  onDealSelect,
  onDealPreview,
  onClientEdit,
  onRequestEditPolicy,
  onLoadMorePolicies,
  policiesHasMore = false,
  isLoadingMorePolicies = false,
  isPoliciesLoading = false,
  onRefreshPoliciesList,
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
}) => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterParams>({ ordering: '-start_date' });
  const [filesModalPolicy, setFilesModalPolicy] = useState<Policy | null>(null);
  const rawSearch = (filters.search ?? '').trim();
  const debouncedSearch = useDebouncedValue(rawSearch, 450);
  const isDebouncePending = Boolean(onRefreshPoliciesList) && rawSearch !== debouncedSearch;
  const serverFilters = useMemo(
    () => ({
      ordering: filters.ordering,
      search: debouncedSearch || undefined,
      unpaid: filters.unpaid,
    }),
    [debouncedSearch, filters.ordering, filters.unpaid]
  );
  const {
    paymentsExpanded,
    setPaymentsExpanded,
    recordsExpandedAll,
    setRecordsExpandedAll,
  } = usePoliciesExpansionState();

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
    [payments]
  );

  const filteredPolicies = useMemo(() => {
    let result = [...policies];

    const showUnpaidOnly = !onRefreshPoliciesList && filters.unpaid === 'true';
    if (showUnpaidOnly) {
      result = result.filter((policy) =>
        policyHasUnpaidActivity(policy.id, paymentsByPolicyMap, allFinancialRecords)
      );
    }

    return result;
  }, [allFinancialRecords, filters, onRefreshPoliciesList, paymentsByPolicyMap, policies]);

  useEffect(() => {
    if (!onRefreshPoliciesList) {
      return;
    }
    void onRefreshPoliciesList(serverFilters);
  }, [onRefreshPoliciesList, serverFilters]);

  const customFilters = [
    {
      key: 'unpaid',
      label: POLICY_TEXT.filters.unpaidOnly,
      type: 'checkbox' as const,
    },
  ];

  const paymentsByPolicy = useMemo(
    () =>
      filteredPolicies.map((policy) => ({
        policy,
        payments: paymentsByPolicyMap.get(policy.id) ?? [],
      })),
    [filteredPolicies, paymentsByPolicyMap]
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

  const handleOpenDeal = (dealId: string) => {
    if (onDealPreview) {
      onDealPreview(dealId);
      return;
    }
    onDealSelect?.(dealId);
    navigate('/deals');
  };

  const handleOpenClient = (client: Client) => {
    onClientEdit?.(client);
    navigate('/clients');
  };

  const actionClassName = (variant?: 'secondary' | 'quiet' | 'danger') => {
    if (variant === 'danger') {
      return 'btn btn-danger btn-sm rounded-xl whitespace-nowrap';
    }
    if (variant === 'quiet') {
      return 'btn btn-quiet btn-sm rounded-xl whitespace-nowrap';
    }
    return 'btn btn-secondary btn-sm rounded-xl whitespace-nowrap';
  };

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
        {isDebouncePending && (
          <div className="text-xs text-slate-500">РџСЂРёРјРµРЅСЏСЋ С„РёР»СЊС‚СЂ...</div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-secondary btn-sm rounded-xl"
            onClick={() =>
              {
                setPaymentsExpanded((prev) => {
                  const next = { ...prev };
                  filteredPolicies.forEach((policy) => {
                    next[policy.id] = true;
                  });
                  return next;
                });
                setRecordsExpandedAll(true);
              }
            }
          >
            Раскрыть все
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm rounded-xl"
            onClick={() =>
              {
                setPaymentsExpanded((prev) => {
                  const next = { ...prev };
                  filteredPolicies.forEach((policy) => {
                    next[policy.id] = false;
                  });
                  return next;
                });
                setRecordsExpandedAll(false);
              }
            }
          >
            Скрыть все
          </button>
        </div>
      </div>

      {filteredPolicies.length ? (
        <div className="app-panel shadow-none overflow-hidden">
          <div className="overflow-x-auto bg-white">
            <table className="deals-table min-w-full border-collapse text-left text-sm" aria-label="Список полисов">
              <thead className={TABLE_THEAD_CLASS}>
                <tr>
                  <TableHeadCell className="min-w-[220px]">Полис</TableHeadCell>
                  <TableHeadCell className="min-w-[200px]">Клиент</TableHeadCell>
                  <TableHeadCell className="min-w-[220px]">Компания</TableHeadCell>
                  <TableHeadCell className="min-w-[220px]">Тип / ТС</TableHeadCell>
                  <TableHeadCell className="min-w-[180px]">Канал</TableHeadCell>
                  <TableHeadCell align="right" className="min-w-[150px]">Сумма</TableHeadCell>
                  <TableHeadCell align="right" className="min-w-[150px]">Платежи</TableHeadCell>
                  <TableHeadCell align="right" className="min-w-[220px]">Действия</TableHeadCell>
                </tr>
              </thead>
              <tbody className="bg-white">
                {paymentsByPolicy.map(({ policy, payments }) => {
                  const isPaymentsExpanded = paymentsExpanded[policy.id] ?? false;
                  const paymentsPanelId = `policy-${policy.id}-payments`;
                  const model = buildPolicyCardModel(policy, payments);
                  const hasUnpaidPayment = policyHasUnpaidActivity(
                    policy.id,
                    paymentsByPolicyMap,
                    allFinancialRecords
                  );
                  const expiryBadge = getPolicyExpiryBadge(policy.endDate);
                  const transportSummary = policy.isVehicle ? getPolicyTransportSummary(policy) : '';
                  const actions = [
                    ...(onRequestEditPolicy
                      ? [
                          {
                            key: 'edit' as const,
                            label: POLICY_TEXT.actions.edit,
                            onClick: () => onRequestEditPolicy(policy),
                            variant: 'secondary' as const,
                          },
                        ]
                      : []),
                    {
                      key: 'files' as const,
                      label: POLICY_TEXT.actions.files,
                      onClick: () => setFilesModalPolicy(policy),
                      variant: 'quiet' as const,
                    },
                    ...buildPolicyNavigationActions({
                      model,
                      onOpenDeal: onDealSelect || onDealPreview ? handleOpenDeal : undefined,
                      clients,
                      onOpenClient: onClientEdit ? handleOpenClient : undefined,
                    }),
                  ];

                  return (
                    <React.Fragment key={policy.id}>
                      <tr className={TABLE_ROW_CLASS}>
                        <td className={TABLE_CELL_CLASS_LG}>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">{model.number}</span>
                              {hasUnpaidPayment && (
                                <span
                                  className={[
                                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                    expiryBadge?.tone === 'red'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-orange-100 text-orange-700',
                                  ].join(' ')}
                                >
                                  Неоплачено
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
                        <td className={TABLE_CELL_CLASS_LG}>
                          <p className="text-sm font-semibold text-slate-900">{model.client}</p>
                        </td>
                        <td className={TABLE_CELL_CLASS_LG}>
                          <ColoredLabel
                            value={policy.insuranceCompany}
                            showDot
                            className="max-w-full truncate font-semibold text-slate-900"
                          />
                        </td>
                        <td className={TABLE_CELL_CLASS_LG}>
                          <p className="text-sm font-semibold text-slate-900">{model.insuranceType}</p>
                          {transportSummary && (
                            <p className="mt-1 text-xs text-slate-500">{transportSummary}</p>
                          )}
                        </td>
                        <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                          {model.salesChannel}
                        </td>
                        <td className={`${TABLE_CELL_CLASS_LG} text-right`}>
                          <p className="text-sm font-semibold text-slate-900">{model.sum}</p>
                        </td>
                        <td className={`${TABLE_CELL_CLASS_LG} text-right`}>
                          {payments.length ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-slate-500">{model.paymentsCountLabel}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setPaymentsExpanded((prev) => ({
                                    ...prev,
                                    [policy.id]: !prev[policy.id],
                                  }))
                                }
                                aria-label={`${POLICY_TEXT.fields.payments} (${model.paymentsCount})`}
                                aria-expanded={isPaymentsExpanded}
                                aria-controls={paymentsPanelId}
                                className="btn btn-quiet btn-sm rounded-xl"
                              >
                                {isPaymentsExpanded ? POLICY_TEXT.actions.hide : POLICY_TEXT.actions.show}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">{POLICY_TEXT.messages.noPayments}</span>
                          )}
                        </td>
                        <td className={`${TABLE_CELL_CLASS_LG} text-right`}>
                          {actions.length ? (
                            <div className={TABLE_ACTIONS_CLASS_ROW_SM}>
                              {actions.map((action) => (
                                <button
                                  key={action.key}
                                  type="button"
                                  className={actionClassName(action.variant)}
                                  onClick={action.onClick}
                                  aria-label={action.ariaLabel ?? action.label}
                                  title={action.title ?? action.label}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs uppercase tracking-wide text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                      {isPaymentsExpanded && (
                        <tr className={TABLE_ROW_CLASS_PLAIN}>
                          <td
                            colSpan={8}
                            className="border border-slate-200 bg-slate-50/70 px-6 py-4"
                          >
                            <div id={paymentsPanelId} className="space-y-2">
                              {payments.length ? (
                                payments.map((payment) => (
                                  <PaymentCard
                                    key={payment.id}
                                    payment={payment}
                                    recordsExpandedOverride={recordsExpandedAll}
                                    onRequestAddRecord={openCreateFinancialRecord}
                                    onEditFinancialRecord={openEditFinancialRecord}
                                    onDeleteFinancialRecord={onDeleteFinancialRecord}
                                  />
                                ))
                              ) : (
                                <PanelMessage>{POLICY_TEXT.messages.noPayments}</PanelMessage>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
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

      {filesModalPolicy && (
        <DriveFilesModal
          isOpen={!!filesModalPolicy}
          onClose={() => setFilesModalPolicy(null)}
          entityId={filesModalPolicy.id}
          entityType="policy"
          title={`Файлы полиса: ${filesModalPolicy.number}`}
        />
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
