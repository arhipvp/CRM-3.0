import React from 'react';
import { Deal, Policy } from '../../types';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('ru-RU') : '—';

interface PoliciesViewProps {
  policies: Policy[];
  deals: Deal[];
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({ policies, deals }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide text-xs">
          <tr>
            <th className="px-5 py-3">№ полиса</th>
            <th className="px-5 py-3">Компания</th>
            <th className="px-5 py-3">Тип</th>
            <th className="px-5 py-3">Сделка</th>
            <th className="px-5 py-3">Период</th>
            <th className="px-5 py-3">Статус</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => {
            const deal = deals.find((d) => d.id === policy.dealId);
            return (
              <tr key={policy.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-4 font-semibold text-slate-900">{policy.number}</td>
                <td className="px-5 py-4 text-slate-600">{policy.insuranceCompany}</td>
                <td className="px-5 py-4 text-slate-600">
                  {policy.insuranceType}
                  {policy.isVehicle && (
                    <div className="text-[11px] text-slate-400 mt-2 space-y-1">
                      <div>�����: {policy.brand || '�'}</div>
                      <div>������: {policy.model || '�'}</div>
                      <div>VIN: {policy.vin || '�'}</div>
                    </div>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-600">{deal?.title || '�'}</td>
                <td className="px-5 py-4 text-slate-600">
                  {formatDate(policy.startDate)} � {formatDate(policy.endDate)}
                </td>
                <td className="px-5 py-4 text-slate-600">{policy.status}</td>
              </tr>
            );
          })}
          {!policies.length && (
            <tr>
              <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                Полисов пока нет
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
