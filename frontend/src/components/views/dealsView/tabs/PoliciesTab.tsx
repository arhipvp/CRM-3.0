import { useMemo, useState } from 'react';
import type {
  Client,
  Deal,
  FinancialRecordCreationContext,
  Payment,
  Policy,
} from '../../../../types';
import {
  PolicySortKey,
  formatDate,
  getPaymentFinancialRecords,
  hasUnpaidPayment,
  hasUnpaidRecord,
  policyHasUnpaidPayments,
  policyHasUnpaidRecords,
} from '../helpers';
import { usePoliciesExpansionState } from '../../../../hooks/usePoliciesExpansionState';
import { ColoredLabel } from '../../../common/ColoredLabel';
import { buildPolicyCardModel } from '../../../policies/policyCardModel';
import { buildPolicyNavigationActions } from '../../../policies/policyCardActions';
import { getPolicyExpiryBadge } from '../../../policies/policyIndicators';
import { POLICY_TEXT } from '../../../policies/text';

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
}

const INCOME_RECORD_TYPE = 'Доход';

export const PoliciesTab: React.FC<PoliciesTabProps> = ({
  selectedDeal,
  sortedPolicies,
  relatedPayments,
  clients,
  onOpenClient,
  policySortKey,
  policySortOrder,
  setPolicySortKey,
  setPolicySortOrder,
  setEditingPaymentId,
  setCreatingPaymentPolicyId,
  setCreatingFinancialRecordContext,
  setEditingFinancialRecordId,
  onDeletePayment,
  onRequestAddPolicy,
  onDeletePolicy,
  onRequestEditPolicy,
}) => {
  const { paymentsExpanded, setPaymentsExpanded } = usePoliciesExpansionState();
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

  const renderStatusMessage = (message: string) => (
    <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">{message}</div>
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
  const renderSortableHeader = (label: string, key: PolicySortKey) => {
    const isActive = policySortKey === key;
    return (
      <button
        type="button"
        onClick={() => handleSortChange(key)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:text-slate-700"
        aria-pressed={isActive}
      >
        <span>{label}</span>
        <span className="text-xs">{isActive ? sortOrderSymbol : '↕'}</span>
      </button>
    );
  };

  if (!sortedPolicies.length) {
    return (
      <section className="app-panel p-6 shadow-none space-y-4">
        {renderStatusMessage('Для сделки пока нет полисов.')}
        <button
          type="button"
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className="btn btn-primary rounded-xl self-start"
        >
          Создать полис
        </button>
      </section>
    );
  }

  const renderPaymentSummary = (payment: Payment) => {
    const paid = Boolean((payment.actualDate ?? '').trim());
    const records = getPaymentFinancialRecords(payment, allFinancialRecords).filter(
      (record) => !record.deletedAt,
    );
    const hasIncome = records.some(
      (record) => record.recordType === INCOME_RECORD_TYPE && Boolean((record.date ?? '').trim()),
    );
    const shouldShowIncomeStatus = paid && records.length > 0;

    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          План
        </span>
        <span className="text-xs font-semibold text-slate-800">
          {formatDate(payment.scheduledDate)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Факт
        </span>
        <span className={`text-xs font-semibold ${paid ? 'text-emerald-600' : 'text-rose-500'}`}>
          {formatDate(payment.actualDate)}
        </span>
        {shouldShowIncomeStatus && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              hasIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {hasIncome ? 'Доход получен' : 'Доход не получен'}
          </span>
        )}
      </div>
    );
  };

  const resolveActionIcon = (actionKey: string, label: string) => {
    if (actionKey === 'edit') {
      return '✏️';
    }
    if (actionKey === 'delete') {
      return '🗑️';
    }
    if (actionKey.startsWith('open-client')) {
      return '👤';
    }
    if (actionKey.startsWith('open-deal')) {
      return '📄';
    }
    if (label.toLowerCase().includes('показать')) {
      return '👁️';
    }
    if (label.toLowerCase().includes('скрыть')) {
      return '🙈';
    }
    return '⋯';
  };

  return (
    <section className="app-panel p-6 shadow-none space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="app-label">Полисы</p>
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
            {POLICY_TEXT.filters.unpaidPaymentsOnly}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="check"
              checked={showUnpaidRecordsOnly}
              onChange={(event) => setShowUnpaidRecordsOnly(event.target.checked)}
            />
            {POLICY_TEXT.filters.unpaidRecordsOnly}
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onRequestAddPolicy(selectedDeal.id)}
            className="btn btn-secondary btn-sm rounded-xl"
          >
            + Создать полис
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm rounded-xl"
            onClick={() => {
              setPaymentsExpanded((prev) => {
                const next = { ...prev };
                visiblePolicies.forEach((policy) => {
                  next[policy.id] = true;
                });
                return next;
              });
            }}
          >
            Раскрыть все
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm rounded-xl"
            onClick={() => {
              setPaymentsExpanded((prev) => {
                const next = { ...prev };
                visiblePolicies.forEach((policy) => {
                  next[policy.id] = false;
                });
                return next;
              });
            }}
          >
            Скрыть все
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1220px] rounded-2xl border border-slate-300 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(140px,0.6fr)_minmax(140px,0.6fr)_minmax(360px,1.6fr)_minmax(140px,0.6fr)_minmax(160px,0.7fr)_minmax(180px,0.8fr)] divide-x divide-slate-300 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <div className="px-4 py-3">Полис</div>
            {renderSortableHeader('Начало', 'startDate')}
            {renderSortableHeader('Окончание', 'endDate')}
            <div className="px-4 py-3">Платежи</div>
            <div className="px-4 py-3">Сумма</div>
            <div className="px-4 py-3">Статус</div>
            <div className="px-4 py-3">Действия</div>
          </div>

          <div className="divide-y divide-slate-300">
            {visiblePolicies.map((policy) => {
              const payments = paymentsByPolicyMap.get(policy.id) ?? [];
              const expanded = paymentsExpanded[policy.id] ?? false;
              const model = buildPolicyCardModel(policy, payments);
              const expiryBadge = getPolicyExpiryBadge(policy.endDate);
              const hasUnpaidPayments = payments.some((payment) => hasUnpaidPayment(payment));
              const hasUnpaidRecords = payments.some((payment) =>
                hasUnpaidRecord(payment, allFinancialRecords),
              );
              const paymentItems = payments;

              const actions = [
                {
                  key: 'edit',
                  label: POLICY_TEXT.actions.edit,
                  onClick: () => onRequestEditPolicy(policy),
                  variant: 'secondary',
                },
                {
                  key: 'delete',
                  label: POLICY_TEXT.actions.delete,
                  onClick: () => onDeletePolicy(policy.id).catch(() => undefined),
                  variant: 'danger',
                },
                ...buildPolicyNavigationActions({
                  model,
                  clients,
                  onOpenClient,
                }),
              ].filter((action) => !action.key.startsWith('open-client'));
              const toggleLabel = expanded ? POLICY_TEXT.actions.hide : POLICY_TEXT.actions.show;

              return (
                <div
                  key={policy.id}
                  className="grid grid-cols-[minmax(220px,1.2fr)_minmax(140px,0.6fr)_minmax(140px,0.6fr)_minmax(360px,1.6fr)_minmax(140px,0.6fr)_minmax(160px,0.7fr)_minmax(180px,0.8fr)] divide-x divide-slate-300"
                >
                  <div className="min-w-0 space-y-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {model.number}
                      </span>
                      {policy.isVehicle && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Авто
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{model.client}</div>
                    <div className="text-[11px]">
                      <ColoredLabel
                        value={model.insuranceCompany}
                        fallback="-"
                        showDot
                        className="max-w-full truncate text-slate-600"
                      />
                    </div>
                  </div>

                  <div className="px-4 py-3 text-xs font-semibold text-slate-800">
                    {model.startDate}
                  </div>
                  <div className="px-4 py-3 text-xs font-semibold text-slate-800">
                    {model.endDate}
                  </div>

                  <div className="space-y-2 px-4 py-3">
                    {paymentItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        Платежей нет
                      </div>
                    ) : (
                      <div className="space-y-2">{paymentItems.map(renderPaymentSummary)}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPaymentId('new');
                        setCreatingPaymentPolicyId(policy.id);
                      }}
                      className="link-action text-[11px] font-semibold"
                    >
                      Добавить платеж
                    </button>
                  </div>

                  <div className="px-4 py-3 text-xs font-semibold text-slate-900">{model.sum}</div>

                  <div className="flex flex-wrap items-center gap-2 px-4 py-3">
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

                  <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                    {actions.map((action) => {
                      const isDanger = action.variant === 'danger';
                      return (
                        <button
                          key={action.key}
                          type="button"
                          className={`icon-btn h-10 w-10 ${
                            isDanger
                              ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-sky-700'
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            action.onClick();
                          }}
                          aria-label={action.label}
                          title={action.label}
                        >
                          <span className="text-sm leading-none">
                            {resolveActionIcon(action.key, action.label)}
                          </span>
                        </button>
                      );
                    })}
                    {payments.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentsExpanded((prev) => ({
                            ...prev,
                            [policy.id]: !expanded,
                          }))
                        }
                        className="icon-btn h-10 w-10 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-sky-700"
                        aria-label={toggleLabel}
                        title={toggleLabel}
                      >
                        <span className="text-sm leading-none">
                          {resolveActionIcon(`toggle:${policy.id}`, toggleLabel)}
                        </span>
                      </button>
                    )}
                  </div>

                  {expanded && payments.length > 0 && (
                    <div className="col-span-full border-t border-slate-200 bg-slate-50/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Платежи
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentsExpanded((prev) => ({
                              ...prev,
                              [policy.id]: false,
                            }));
                          }}
                          className="link-action text-[11px] font-semibold"
                        >
                          Скрыть
                        </button>
                      </div>
                      <div className="mt-3 space-y-2">
                        {payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">
                                {formatDate(payment.scheduledDate)} →{' '}
                                {formatDate(payment.actualDate)}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {payment.note || payment.description || 'Без описания'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setCreatingPaymentPolicyId(null);
                                  setEditingPaymentId(payment.id);
                                }}
                                className="link-action text-[11px] font-semibold"
                              >
                                Изменить
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeletePayment(payment.id)}
                                className="link-danger text-[11px] font-semibold"
                              >
                                Удалить
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCreatingFinancialRecordContext({
                                    paymentId: payment.id,
                                    recordType: 'income',
                                  });
                                  setEditingFinancialRecordId(null);
                                }}
                                className="link-action text-[11px] font-semibold"
                              >
                                + Доход
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
