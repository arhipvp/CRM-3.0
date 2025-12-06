import React, { useMemo, useState } from 'react';
import { Policy, Payment } from '../../types';
import { FilterBar } from '../FilterBar';
import { FilterParams } from '../../api';
import { DriveFilesModal } from '../DriveFilesModal';
import {
  formatCurrency,
  formatDate,
  FinancialRecordCreationContext,
} from './dealsView/helpers';
import { AddFinancialRecordForm, AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { ColoredLabel } from '../common/ColoredLabel';
import { LabelValuePair } from '../common/LabelValuePair';
import { PaymentCard } from '../policies/PaymentCard';

type PolicySortKey =
  | 'startDate'
  | 'endDate'
  | 'number'
  | 'clientName'
  | 'salesChannel'
  | 'status';

const POLICY_SORT_OPTIONS = [
  { value: '-startDate', label: 'Начало (убывание)' },
  { value: 'startDate', label: 'Начало (возрастание)' },
  { value: '-endDate', label: 'Окончание (убывание)' },
  { value: 'endDate', label: 'Окончание (возрастание)' },
  { value: '-number', label: 'Номер (Z → A)' },
  { value: 'number', label: 'Номер (A → Z)' },
  { value: '-clientName', label: 'Клиент (Z → A)' },
  { value: 'clientName', label: 'Клиент (A → Z)' },
];

const normalizeStatusLabel = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ''))
    .join(' ')
    .trim();

const getPolicySortValue = (policy: Policy, key: PolicySortKey): number | string => {
  switch (key) {
    case 'number':
      return policy.number ?? '';
    case 'clientName':
      return policy.insuredClientName ?? policy.clientName ?? '';
    case 'salesChannel':
      return policy.salesChannel ?? '';
    case 'status':
      return policy.status ?? '';
    case 'endDate':
      return policy.endDate ? new Date(policy.endDate).getTime() : 0;
    case 'startDate':
    default:
      return policy.startDate ? new Date(policy.startDate).getTime() : 0;
  }
};

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
  const [editingFinancialRecordId, setEditingFinancialRecordId] = useState<string | null>(null);
  const [creatingFinancialRecordContext, setCreatingFinancialRecordContext] =
    useState<FinancialRecordCreationContext | null>(null);

  const statusOptions = useMemo(() => {
    const unique = Array.from(new Set(policies.map((policy) => policy.status).filter(Boolean)));
    return unique.map((status) => ({
      value: status,
      label: normalizeStatusLabel(status),
    }));
  }, [policies]);

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
  }, [filters, policies]);

  const customFilters = statusOptions.length
    ? [
        {
          key: 'status',
          label: 'Статус',
          type: 'select' as const,
          options: statusOptions,
        },
      ]
    : [];

  const paymentsByPolicy = useMemo(
    () =>
      filteredPolicies.map((policy) => ({
        policy,
        payments: payments.filter((payment) => payment.policyId === policy.id),
      })),
    [filteredPolicies, payments]
  );

  const allFinancialRecords = useMemo(
    () => payments.flatMap((payment) => payment.financialRecords ?? []),
    [payments]
  );

  const editingFinancialRecord = editingFinancialRecordId
    ? allFinancialRecords.find((record) => record.id === editingFinancialRecordId)
    : undefined;

  const closeFinancialRecordModal = () => {
    setCreatingFinancialRecordContext(null);
    setEditingFinancialRecordId(null);
  };

  return (
    <div className="space-y-3">
      <FilterBar
        onFilterChange={setFilters}
        searchPlaceholder="Поиск по номеру, клиенту или компании..."
        sortOptions={POLICY_SORT_OPTIONS}
        customFilters={customFilters}
      />

      {filteredPolicies.length ? (
        <div className="space-y-4">
          {paymentsByPolicy.map(({ policy, payments }) => (
            <section
              key={policy.id}
              className="space-y-2 rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="px-4 py-3 text-sm text-slate-500 space-y-4">
                <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr_0.8fr]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">Номер</p>
                    <p className="text-lg font-semibold text-slate-900">{policy.number || '—'}</p>
                  </div>
                  <div className="flex gap-8 text-[11px] uppercase tracking-[0.35em] text-slate-500 mt-3 sm:mt-0">
                    <span>Начало: {formatDate(policy.startDate)}</span>
                    <span>Окончание: {formatDate(policy.endDate)}</span>
                  </div>
                  <div className="flex items-start justify-end gap-4 text-[10px] uppercase tracking-[0.35em] text-slate-400">
                    <div>
                      <p>Действия</p>
                      <div className="flex gap-3 text-xs text-slate-600">
                        {onRequestEditPolicy && (
                          <button
                            type="button"
                            className="font-semibold text-slate-500 hover:text-sky-600"
                            onClick={() => onRequestEditPolicy(policy)}
                          >
                            Ред.
                          </button>
                        )}
                        <button
                          type="button"
                          className="font-semibold text-slate-500 hover:text-sky-600"
                          onClick={() => setFilesModalPolicy(policy)}
                        >
                          Файлы
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-6">
                  <LabelValuePair
                    label="Клиент"
                    value={(policy.insuredClientName ?? policy.clientName) || '—'}
                    className="min-w-[180px]"
                  />
                  <LabelValuePair
                    label="Компания"
                    value={
                      <ColoredLabel
                        value={policy.insuranceCompany}
                        fallback="—"
                        showDot
                        className="font-semibold text-slate-900"
                      />
                    }
                    className="min-w-[160px]"
                  />
                  <LabelValuePair
                    label="Канал / сумма"
                    value={
                      <span className="flex flex-col gap-0.5">
                        <span className="text-xs font-normal uppercase tracking-[0.2em] text-slate-500">
                          {policy.salesChannel || '—'}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {formatCurrency(policy.paymentsPaid)} / {formatCurrency(policy.paymentsTotal)}
                        </span>
                      </span>
                    }
                    className="min-w-[220px]"
                    valueClassName="flex flex-col gap-0.5 text-base text-slate-900"
                  />
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3">
                <div className="flex flex-wrap gap-6 text-sm text-slate-600">
                  <LabelValuePair label="Тип" value={policy.insuranceType || '—'} />
                  <LabelValuePair label="Марка" value={policy.brand || '—'} />
                  <LabelValuePair label="Модель" value={policy.model || '—'} />
                  <LabelValuePair label="VIN" value={policy.vin || '—'} />
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-slate-500">
                  <LabelValuePair
                    label="Начало"
                    value={formatDate(policy.startDate)}
                    className="text-sm text-slate-500"
                  />
                  <LabelValuePair
                    label="Окончание"
                    value={formatDate(policy.endDate)}
                    className="text-sm text-slate-500"
                  />
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                  <div>Платежи</div>
                </div>
                {payments.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Платежей пока нет.</p>
                ) : (
                  <div className="mt-2 space-y-2 text-sm text-slate-600">
                    {payments.map((payment) => (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        onRequestAddRecord={(paymentId, recordType) => {
                          setCreatingFinancialRecordContext({ paymentId, recordType });
                          setEditingFinancialRecordId(null);
                        }}
                        onEditFinancialRecord={(recordId) => setEditingFinancialRecordId(recordId)}
                        onDeleteFinancialRecord={onDeleteFinancialRecord}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-5 py-6 text-center text-sm text-slate-500">
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
      {(creatingFinancialRecordContext || editingFinancialRecordId) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingFinancialRecordId ? 'Изменить запись' : 'Добавить запись'}
              </h3>
              <button
                onClick={closeFinancialRecordModal}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <AddFinancialRecordForm
                paymentId={
                  creatingFinancialRecordContext?.paymentId ||
                  editingFinancialRecord?.paymentId ||
                  ''
                }
                defaultRecordType={creatingFinancialRecordContext?.recordType}
                record={editingFinancialRecord}
                onSubmit={async (values) => {
                  if (editingFinancialRecordId) {
                    await onUpdateFinancialRecord(editingFinancialRecordId, values);
                  } else {
                    await onAddFinancialRecord(values);
                  }
                  closeFinancialRecordModal();
                }}
                onCancel={closeFinancialRecordModal}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
