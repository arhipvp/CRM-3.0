import React from 'react';
import type { Deal, Policy } from '../../../../types';
import { formatCurrency, formatDate, PolicySortKey } from '../helpers';
import { VehicleDetails } from '../../../common/VehicleDetails';

interface PoliciesTabProps {
  selectedDeal: Deal | null;
  sortedPolicies: Policy[];
  policySortKey: PolicySortKey;
  policySortOrder: 'asc' | 'desc';
  onRequestAddPolicy: (dealId: string) => void;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onRequestEditPolicy: (policy: Policy) => void;
  onSortChange: (key: PolicySortKey) => void;
}

export const PoliciesTab: React.FC<PoliciesTabProps> = ({
  selectedDeal,
  sortedPolicies,
  policySortKey,
  policySortOrder,
  onRequestAddPolicy,
  onDeletePolicy,
  onRequestEditPolicy,
  onSortChange,
}) => {
  if (!selectedDeal) {
    return null;
  }

  const renderPolicyHeaderCell = (label: string, key: PolicySortKey) => (
    <th
      scope="col"
      className="px-4 py-3 cursor-pointer select-none text-left text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-700"
      onClick={() => onSortChange(key)}
      aria-sort={
        policySortKey === key ? (policySortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[0.55rem] text-slate-400">
          {policySortKey === key ? (policySortOrder === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );

  if (!sortedPolicies.length) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Для сделки пока нет полисов.</p>
        <button
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700"
        >
          Создать полис
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-slate-800">Полисы</h3>
        <button
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className="px-3 py-2 text-sm font-semibold text-sky-600 hover:text-sky-800"
        >
          + Создать полис
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {renderPolicyHeaderCell('Номер', 'number')}
              {renderPolicyHeaderCell('Компания', 'insuranceCompany')}
              {renderPolicyHeaderCell('Клиент', 'client')}
              {renderPolicyHeaderCell('Канал продаж', 'salesChannel')}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Сумма
              </th>
              {renderPolicyHeaderCell('Тип', 'insuranceType')}
              {renderPolicyHeaderCell('Начало', 'startDate')}
              {renderPolicyHeaderCell('Окончание', 'endDate')}
              {renderPolicyHeaderCell('Автомобиль', 'transport')}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Действие
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortedPolicies.map((policy) => (
              <tr key={policy.id} className="transition hover:bg-slate-50 focus-within:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{policy.number}</td>
                <td className="px-4 py-3">{policy.insuranceCompany || '—'}</td>
                <td className="px-4 py-3">{policy.clientName || '—'}</td>
                <td className="px-4 py-3">{policy.salesChannel || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(policy.paymentsPaid)} / {formatCurrency(policy.paymentsTotal)}
                  </div>
                  <div className="text-[11px] text-slate-400">оплачено / начислено</div>
                </td>
                <td className="px-4 py-3">{policy.insuranceType || '—'}</td>
                <td className="px-4 py-3">{formatDate(policy.startDate)}</td>
                <td className="px-4 py-3">{formatDate(policy.endDate)}</td>
                <td className="px-4 py-3 text-slate-600">
                  <VehicleDetails
                    brand={policy.brand}
                    model={policy.model}
                    vin={policy.vin}
                    placeholder="—"
                  />
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-400 transition hover:text-sky-600"
                    onClick={() => onRequestEditPolicy(policy)}
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition"
                    onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
