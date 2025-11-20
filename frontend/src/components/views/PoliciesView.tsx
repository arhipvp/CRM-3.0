import React, { useMemo, useState } from 'react';
import { Deal, Policy } from '../../types';
import { FilterBar } from '../FilterBar';
import { FilterParams } from '../../api';
import { DriveFilesModal } from '../DriveFilesModal';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('ru-RU') : '—';

const formatCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined) {
    return '—';
  }
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return '—';
  }
  return amount.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  });
};

type PolicySortKey =
  | 'startDate'
  | 'endDate'
  | 'number'
  | 'clientName'
  | 'salesChannel'
  | 'status';

const POLICY_SORT_OPTIONS = [
  { value: '-startDate', label: 'Дата начала (новые)' },
  { value: 'startDate', label: 'Дата начала (старые)' },
  { value: '-endDate', label: 'Дата окончания (новые)' },
  { value: 'endDate', label: 'Дата окончания (старые)' },
  { value: '-number', label: 'Номер полиса (Z → A)' },
  { value: 'number', label: 'Номер полиса (A → Z)' },
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
      return policy.clientName ?? '';
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
  deals: Deal[];
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({ policies, deals }) => {
  const [filters, setFilters] = useState<FilterParams>({});
  const [filesModalPolicy, setFilesModalPolicy] = useState<Policy | null>(null);

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
          policy.clientName,
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

  return (
    <div className="space-y-4">
      <FilterBar
        onFilterChange={setFilters}
        searchPlaceholder="Поиск по номеру, клиенту или компании..."
        sortOptions={POLICY_SORT_OPTIONS}
        customFilters={customFilters}
      />
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide text-xs">
            <tr>
              <th className="px-5 py-3">№ полиса</th>
              <th className="px-5 py-3">Компания</th>
              <th className="px-5 py-3">Клиент</th>
              <th className="px-5 py-3">Тип</th>
              <th className="px-5 py-3">Сделка</th>
              <th className="px-5 py-3">Канал продаж</th>
              <th className="px-5 py-3">Сумма</th>
              <th className="px-5 py-3">Период</th>
              <th className="px-5 py-3">Статус</th>
              <th className="px-5 py-3 text-right">Файлы</th>
            </tr>
          </thead>
          <tbody>
            {filteredPolicies.map((policy) => {
              const deal = deals.find((d) => d.id === policy.dealId);
              return (
                <tr key={policy.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-4 font-semibold text-slate-900">{policy.number}</td>
                  <td className="px-5 py-4 text-slate-600">{policy.insuranceCompany}</td>
                  <td className="px-5 py-4 text-slate-600">{policy.clientName || '—'}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {policy.insuranceType}
                    {policy.isVehicle && (
                      <div className="text-[11px] text-slate-400 mt-2 space-y-1">
                        <div>Марка: {policy.brand || '—'}</div>
                        <div>Модель: {policy.model || '—'}</div>
                        <div>VIN: {policy.vin || '—'}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{deal?.title || '—'}</td>
                  <td className="px-5 py-4 text-slate-600">{policy.salesChannel || '—'}</td>
                  <td className="px-5 py-4 text-slate-600">
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(policy.paymentsPaid)} / {formatCurrency(policy.paymentsTotal)}
                    </div>
                    <div className="text-[11px] text-slate-400">оплачено / начислено</div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(policy.startDate)} — {formatDate(policy.endDate)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{policy.status || '—'}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setFilesModalPolicy(policy)}
                      className="text-sm font-medium text-slate-500 hover:text-sky-600 transition-colors"
                    >
                      📁 Файлы
                    </button>
                  </td>
                </tr>
              );
            })}
            {!filteredPolicies.length && (
              <tr>
                <td colSpan={9} className="px-5 py-6 text-center text-slate-500">
                  Полисов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filesModalPolicy && (
        <DriveFilesModal
          isOpen={!!filesModalPolicy}
          onClose={() => setFilesModalPolicy(null)}
          entityId={filesModalPolicy.id}
          entityType="policy"
          title={`Файлы полиса: ${filesModalPolicy.number}`}
        />
      )}
    </div>
  );
};
