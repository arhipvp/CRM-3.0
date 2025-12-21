import React, { useMemo, useState } from 'react';
import { Policy, Payment } from '../../types';
import { FilterBar } from '../FilterBar';
import { FilterParams } from '../../api';
import { DriveFilesModal } from '../DriveFilesModal';
import {
  getPolicySortValue,
  policyHasUnpaidActivity,
  PolicySortKey,
} from './dealsView/helpers';
import { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { PolicyCard } from '../policies/PolicyCard';
import { buildPolicyCardModel } from '../policies/policyCardModel';
import { POLICY_TEXT } from '../policies/text';
import { usePoliciesExpansionState } from '../../hooks/usePoliciesExpansionState';
import { FinancialRecordModal } from '../financialRecords/FinancialRecordModal';
import { useFinancialRecordModal } from '../../hooks/useFinancialRecordModal';

const POLICY_SORT_OPTIONS = [
  { value: '-startDate', label: 'Начало (убывание)' },
  { value: 'startDate', label: 'Начало (возрастание)' },
  { value: '-endDate', label: 'Окончание (убывание)' },
  { value: 'endDate', label: 'Окончание (возрастание)' },
  { value: '-number', label: 'Номер (Z → A)' },
  { value: 'number', label: 'Номер (A → Z)' },
  { value: '-client', label: 'Клиент (Z → A)' },
  { value: 'client', label: 'Клиент (A → Z)' },
];

const normalizeStatusLabel = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ''))
    .join(' ')
    .trim();

interface PoliciesViewProps {
  policies: Policy[];
  payments: Payment[];
  onRequestEditPolicy?: (policy: Policy) => void;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord: (recordId: string, values: AddFinancialRecordFormValues) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  policies,
  payments,
  onRequestEditPolicy,
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
}) => {
  const [filters, setFilters] = useState<FilterParams>({});
  const [filesModalPolicy, setFilesModalPolicy] = useState<Policy | null>(null);
  const {
    paymentsExpanded,
    setPaymentsExpanded,
    recordsExpandedAll,
    setRecordsExpandedAll,
  } = usePoliciesExpansionState();

  const statusOptions = useMemo(() => {
    const unique = Array.from(new Set(policies.map((policy) => policy.status).filter(Boolean)));
    return unique.map((status) => ({
      value: status,
      label: normalizeStatusLabel(status),
    }));
  }, [policies]);

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

    const search = (filters.search ?? '').toString().toLowerCase().trim();
    if (search) {
      result = result.filter((policy) => {
        const haystack = [
          policy.number,
          policy.dealTitle,
          policy.insuredClientName ?? policy.clientName,
          policy.insuranceCompany,
          policy.insuranceType,
          policy.salesChannel,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    if (filters.status) {
      result = result.filter((policy) => policy.status === filters.status);
    }

    const showUnpaidOnly = filters.unpaid === 'true';
    if (showUnpaidOnly) {
      result = result.filter((policy) =>
        policyHasUnpaidActivity(policy.id, paymentsByPolicyMap, allFinancialRecords)
      );
    }

    const ordering = (filters.ordering as string) || '-startDate';
    const direction = ordering.startsWith('-') ? -1 : 1;
    const field = (ordering.replace(/^-/, '') as PolicySortKey) || 'startDate';

    result.sort((a, b) => {
      const aValue = getPolicySortValue(a, field);
      const bValue = getPolicySortValue(b, field);
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }
      return aValue.toString().localeCompare(bValue.toString()) * direction;
    });

    return result;
  }, [filters, policies, paymentsByPolicyMap, allFinancialRecords]);

  const customFilters = [
    ...(statusOptions.length
      ? [
          {
            key: 'status',
            label: 'Статус',
            type: 'select' as const,
            options: statusOptions,
          },
        ]
      : []),
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

  return (
    <section aria-labelledby="policiesViewHeading" className="app-panel p-6 shadow-none space-y-4">
      <h1 id="policiesViewHeading" className="sr-only">
        Полисы
      </h1>
      <div className="flex flex-col gap-3">
        <FilterBar
          onFilterChange={setFilters}
          searchPlaceholder="Поиск по номеру, клиенту или компании..."
          initialFilters={{ ordering: '-startDate' }}
          sortOptions={POLICY_SORT_OPTIONS}
          customFilters={customFilters}
        />
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

            return (
              <PolicyCard
                key={policy.id}
                policy={policy}
                payments={payments}
                model={buildPolicyCardModel(policy, payments)}
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
          Нет полисов для отображения
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
