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
              <div className="grid gap-3 px-4 py-3 text-sm text-slate-500 sm:grid-cols-[1.2fr_1fr_1fr_0.9fr_0.8fr_1fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Номер</p>
                  <p className="text-lg font-semibold text-slate-900">{policy.number || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Компания</p>
                  <ColoredLabel
                    value={policy.insuranceCompany}
                    fallback="—"
                    showDot
                    className="text-base font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Клиент</p>
                  <p className="text-base font-semibold text-slate-800">
                    {(policy.insuredClientName ?? policy.clientName) || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Канал</p>
                  <ColoredLabel
                    value={policy.salesChannel}
                    fallback="—"
                    showDot
                    className="text-base font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Сумма</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatCurrency(policy.paymentsPaid)} / {formatCurrency(policy.paymentsTotal)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Действия</p>
                  <div className="flex items-center justify-end gap-3">
                    {onRequestEditPolicy && (
                      <button
                        type="button"
                        className="text-sm font-semibold text-slate-500 hover:text-sky-600"
                        onClick={() => onRequestEditPolicy(policy)}
                      >
                        Ред.
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-sm font-semibold text-slate-500 hover:text-sky-600"
                      onClick={() => setFilesModalPolicy(policy)}
                    >
                      Файлы
                    </button>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 sm:flex sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-5 text-base text-slate-700">
                  <span>Тип: {policy.insuranceType || '—'}</span>
                  <span>Марка: {policy.brand || '—'}</span>
                  <span>Модель: {policy.model || '—'}</span>
                  <span>VIN: {policy.vin || '—'}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <span>Начало: {formatDate(policy.startDate)}</span>
                  <span>Окончание: {formatDate(policy.endDate)}</span>
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
