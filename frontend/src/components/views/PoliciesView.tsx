import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, Payment, Policy } from '../../types';
import { FilterBar } from '../FilterBar';
import { FilterParams } from '../../api';
import { DriveFilesModal } from '../DriveFilesModal';
import { policyHasUnpaidActivity } from './dealsView/helpers';
import { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { PolicyCard } from '../policies/PolicyCard';
import { buildPolicyCardModel } from '../policies/policyCardModel';
import { POLICY_TEXT } from '../policies/text';
import { buildPolicyNavigationActions } from '../policies/policyCardActions';
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
        <div className="space-y-4">
          {paymentsByPolicy.map(({ policy, payments }) => {
            const isPaymentsExpanded = paymentsExpanded[policy.id] ?? false;
            const model = buildPolicyCardModel(policy, payments);

            return (
              <PolicyCard
                key={policy.id}
                policy={policy}
                payments={payments}
                model={model}
                primaryAction={
                  onDealSelect
                    ? {
                        label: POLICY_TEXT.actions.openDeal,
                        onClick: () => handleOpenDeal(model.dealId),
                      }
                    : undefined
                }
                recordsExpandedAll={recordsExpandedAll}
                isPaymentsExpanded={isPaymentsExpanded}
                onTogglePaymentsExpanded={() =>
                  setPaymentsExpanded((prev) => ({
                    ...prev,
                    [policy.id]: !prev[policy.id],
                  }))
                }
                actions={[
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
                    onOpenDeal: onDealSelect ? handleOpenDeal : undefined,
                    clients,
                    onOpenClient: onClientEdit ? handleOpenClient : undefined,
                  }),
                ]}
                onRequestAddRecord={(paymentId, recordType) => {
                  openCreateFinancialRecord(paymentId, recordType);
                }}
                onEditFinancialRecord={openEditFinancialRecord}
                onDeleteFinancialRecord={onDeleteFinancialRecord}
              />
            );
          })}
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
