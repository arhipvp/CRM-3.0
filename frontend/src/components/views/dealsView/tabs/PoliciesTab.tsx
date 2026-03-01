import { useMemo, useState } from 'react';
import type {
  Client,
  Deal,
  FinancialRecordCreationContext,
  Payment,
  Policy,
} from '../../../../types';
import { PolicySortKey, policyHasUnpaidPayments, policyHasUnpaidRecords } from '../helpers';
import { buildPolicyCardModel } from '../../../policies/policyCardModel';
import {
  getPolicyComputedStatusBadge,
  getPolicyExpiryBadge,
} from '../../../policies/policyIndicators';
import {
  getPolicyExpiryToneClass,
  getPolicyNotePreview,
  POLICY_STATUS_TONE_CLASS,
} from '../../../policies/policyTableHelpers';
import { BTN_PRIMARY, BTN_SM_QUIET, BTN_SM_SECONDARY } from '../../../common/buttonStyles';
import { PANEL_MUTED_TEXT } from '../../../common/uiClassNames';

const POLICY_SORT_LABELS: Record<PolicySortKey, string> = {
  number: 'Номер',
  insuranceCompany: 'Компания',
  insuranceType: 'Тип',
  client: 'Клиент',
  salesChannel: 'Канал продаж',
  startDate: 'Начало',
  endDate: 'Окончание',
  transport: 'Авто',
};

interface PoliciesTabProps {
  selectedDeal: Deal | null;
  sortedPolicies: Policy[];
  relatedPayments: Payment[];
  clients: Client[];
  onOpenClient: (client: Client) => void;
  policySortKey: PolicySortKey;
  policySortOrder: 'asc' | 'desc';
  setPolicySortKey: (value: PolicySortKey) => void;
  setPolicySortOrder: (value: 'asc' | 'desc') => void;
  setEditingPaymentId: (value: string | null) => void;
  setCreatingPaymentPolicyId: (value: string | null) => void;
  setCreatingFinancialRecordContext: React.Dispatch<
    React.SetStateAction<FinancialRecordCreationContext | null>
  >;
  setEditingFinancialRecordId: React.Dispatch<React.SetStateAction<string | null>>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
  onRequestAddPolicy: (dealId: string) => void;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onRequestEditPolicy: (policy: Policy) => void;
  isLoading?: boolean;
}

export const PoliciesTab: React.FC<PoliciesTabProps> = ({
  selectedDeal,
  sortedPolicies,
  relatedPayments,
  policySortKey,
  policySortOrder,
  setPolicySortKey,
  setPolicySortOrder,
  setEditingPaymentId,
  setCreatingPaymentPolicyId,
  onRequestAddPolicy,
  onDeletePolicy,
  onRequestEditPolicy,
  isLoading = false,
}) => {
  const [showUnpaidPaymentsOnly, setShowUnpaidPaymentsOnly] = useState(false);
  const [showUnpaidRecordsOnly, setShowUnpaidRecordsOnly] = useState(false);

  const paymentsByPolicyMap = useMemo(() => {
    const map = new Map<string, Payment[]>();
    relatedPayments.forEach((payment) => {
      const policyId = payment.policyId;
      if (!policyId) {
        return;
      }
      const current = map.get(policyId) ?? [];
      current.push(payment);
      map.set(policyId, current);
    });
    return map;
  }, [relatedPayments]);

  const allFinancialRecords = useMemo(
    () => relatedPayments.flatMap((payment) => payment.financialRecords ?? []),
    [relatedPayments],
  );

  const visiblePolicies = useMemo(() => {
    const shouldFilterUnpaid = showUnpaidPaymentsOnly || showUnpaidRecordsOnly;
    if (!shouldFilterUnpaid) {
      return sortedPolicies;
    }
    return sortedPolicies.filter((policy) => {
      const hasUnpaidPayments = policyHasUnpaidPayments(policy.id, paymentsByPolicyMap);
      const hasUnpaidRecords = policyHasUnpaidRecords(
        policy.id,
        paymentsByPolicyMap,
        allFinancialRecords,
      );
      return (
        (showUnpaidPaymentsOnly && hasUnpaidPayments) || (showUnpaidRecordsOnly && hasUnpaidRecords)
      );
    });
  }, [
    allFinancialRecords,
    paymentsByPolicyMap,
    showUnpaidPaymentsOnly,
    showUnpaidRecordsOnly,
    sortedPolicies,
  ]);

  if (!selectedDeal) {
    return null;
  }

  if (isLoading && !sortedPolicies.length) {
    return (
      <section className="app-panel p-4 shadow-none space-y-3">
        <div className="flex items-center justify-between">
          <p className="app-label">Полисы</p>
          <span className="text-xs text-slate-500">Загружаем...</span>
        </div>
        <div className="space-y-2 animate-pulse">
          <div className="h-9 rounded-lg bg-slate-200" />
          <div className="h-9 rounded-lg bg-slate-200" />
          <div className="h-9 rounded-lg bg-slate-200" />
        </div>
      </section>
    );
  }

  const renderStatusMessage = (message: string) => (
    <div className={PANEL_MUTED_TEXT}>{message}</div>
  );

  const sortLabel = POLICY_SORT_LABELS[policySortKey] ?? policySortKey;
  const sortOrderSymbol = policySortOrder === 'asc' ? '↑' : '↓';
  const handleSortChange = (nextKey: PolicySortKey) => {
    if (policySortKey === nextKey) {
      setPolicySortOrder(policySortOrder === 'asc' ? 'desc' : 'asc');
      return;
    }
    setPolicySortKey(nextKey);
    setPolicySortOrder('asc');
  };

  if (!sortedPolicies.length) {
    return (
      <section className="app-panel p-4 shadow-none space-y-3">
        {renderStatusMessage('Для сделки пока нет полисов.')}
        <button
          type="button"
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className={`${BTN_PRIMARY} rounded-xl self-start`}
        >
          Создать полис
        </button>
      </section>
    );
  }

  return (
    <section className="app-panel p-4 shadow-none space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="app-label">Полисы</p>
          {isLoading && (
            <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-sky-600 animate-spin" />
          )}
          <span className="text-xs text-slate-500">
            Сортировка: {sortLabel} {sortOrderSymbol}
          </span>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="check"
              checked={showUnpaidPaymentsOnly}
              onChange={(event) => setShowUnpaidPaymentsOnly(event.target.checked)}
            />
            Только с неоплаченными платежами
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="check"
              checked={showUnpaidRecordsOnly}
              onChange={(event) => setShowUnpaidRecordsOnly(event.target.checked)}
            />
            Только с неоплаченными записями
          </label>
        </div>

        <button
          type="button"
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className={BTN_SM_SECONDARY}
        >
          + Создать полис
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1600px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="px-3 py-2 border border-slate-300">
                <button
                  type="button"
                  onClick={() => handleSortChange('number')}
                  className="w-full text-left"
                >
                  Номер
                </button>
              </th>
              <th className="px-3 py-2 border border-slate-300">Статус</th>
              <th className="px-3 py-2 border border-slate-300">
                <button
                  type="button"
                  onClick={() => handleSortChange('startDate')}
                  className="w-full text-left"
                >
                  Начало
                </button>
              </th>
              <th className="px-3 py-2 border border-slate-300">
                <button
                  type="button"
                  onClick={() => handleSortChange('endDate')}
                  className="w-full text-left"
                >
                  Окончание
                </button>
              </th>
              <th className="px-3 py-2 border border-slate-300">Клиент</th>
              <th className="px-3 py-2 border border-slate-300">Компания</th>
              <th className="px-3 py-2 border border-slate-300">Тип</th>
              <th className="px-3 py-2 border border-slate-300">Канал</th>
              <th className="px-3 py-2 border border-slate-300">Примечание</th>
              <th className="px-3 py-2 border border-slate-300 text-right">Оплачено / План</th>
              <th className="px-3 py-2 border border-slate-300 text-right">Платежей</th>
              <th className="px-3 py-2 border border-slate-300">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {visiblePolicies.map((policy) => {
              const payments = paymentsByPolicyMap.get(policy.id) ?? [];
              const model = buildPolicyCardModel(policy, payments);
              const computedStatusBadge = getPolicyComputedStatusBadge(policy.computedStatus);
              const expiryBadge = getPolicyExpiryBadge(policy.endDate);
              const notePreview = getPolicyNotePreview(policy.note);

              return (
                <tr key={policy.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 border border-slate-300 align-top">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{model.number}</p>
                      {policy.isVehicle && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Авто
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 border border-slate-300 align-top">
                    <div className="flex flex-wrap gap-1">
                      {computedStatusBadge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            POLICY_STATUS_TONE_CLASS[computedStatusBadge.tone]
                          }`}
                          title={computedStatusBadge.tooltip}
                        >
                          {computedStatusBadge.label}
                        </span>
                      )}
                      {expiryBadge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getPolicyExpiryToneClass(
                            expiryBadge.tone,
                          )}`}
                        >
                          {expiryBadge.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 border border-slate-300 text-xs font-semibold text-slate-800 align-top">
                    {model.startDate}
                  </td>
                  <td className="px-3 py-2 border border-slate-300 text-xs font-semibold text-slate-800 align-top">
                    {model.endDate}
                  </td>
                  <td className="px-3 py-2 border border-slate-300 text-sm text-slate-900 align-top">
                    {model.client}
                  </td>
                  <td className="px-3 py-2 border border-slate-300 text-sm text-slate-900 align-top">
                    {model.insuranceCompany}
                  </td>
                  <td className="px-3 py-2 border border-slate-300 text-sm text-slate-900 align-top">
                    {model.insuranceType}
                  </td>
                  <td className="px-3 py-2 border border-slate-300 text-sm text-slate-700 align-top">
                    {model.salesChannel}
                  </td>
                  <td className="px-3 py-2 border border-slate-300 align-top">
                    <p
                      className="text-xs text-slate-700 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
                      title={notePreview.fullText}
                    >
                      {notePreview.preview}
                    </p>
                  </td>
                  <td className="px-3 py-2 border border-slate-300 text-right align-top">
                    <p className="text-sm font-semibold text-slate-900">{model.sum}</p>
                  </td>
                  <td className="px-3 py-2 border border-slate-300 text-right text-xs text-slate-700 align-top">
                    {payments.length}
                  </td>
                  <td className="px-3 py-2 border border-slate-300 align-top">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => onRequestEditPolicy(policy)}
                        className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPaymentId('new');
                          setCreatingPaymentPolicyId(policy.id);
                        }}
                        className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                      >
                        + Платеж
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                        className="btn btn-danger btn-sm rounded-xl h-7 px-2 text-[11px]"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
