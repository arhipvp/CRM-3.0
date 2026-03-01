import React from 'react';

import type { Payment, Policy } from '../../types';
import { ColoredLabel } from '../common/ColoredLabel';
import { LabelValuePair } from '../common/LabelValuePair';
import { PaymentCard } from './PaymentCard';
import type { PolicyCardModel } from './policyCardModel';
import { PolicyNumberButton } from './PolicyNumberButton';
import { getPolicyComputedStatusBadge, getPolicyExpiryBadge } from './policyIndicators';
import { POLICY_PLACEHOLDER, POLICY_TEXT } from './text';
import {
  BTN_SM_DANGER,
  BTN_SM_PRIMARY,
  BTN_SM_QUIET,
  BTN_SM_SECONDARY,
} from '../common/buttonStyles';
import { PANEL_MUTED_TEXT } from '../common/uiClassNames';
import { hasUnpaidPayment, hasUnpaidRecord } from '../views/dealsView/helpers';

export type PolicyCardActionVariant = 'secondary' | 'quiet' | 'danger';

export interface PolicyCardAction {
  key: string;
  label: string;
  onClick: () => void;
  variant?: PolicyCardActionVariant;
  ariaLabel?: string;
  title?: string;
}

interface PolicyCardProps {
  policy: Policy;
  payments: Payment[];
  model: PolicyCardModel;
  recordsExpandedAll: boolean;
  isPaymentsExpanded: boolean;
  onTogglePaymentsExpanded: () => void;
  onRequestAddRecord: (paymentId: string, recordType: 'income' | 'expense') => void;
  onEditFinancialRecord: (recordId: string) => void;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onEditPayment?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  onRequestAddPayment?: () => void;
  actions?: PolicyCardAction[];
}

const actionClassName = (variant: PolicyCardActionVariant | undefined) => {
  if (variant === 'danger') {
    return `${BTN_SM_DANGER} whitespace-nowrap`;
  }
  if (variant === 'quiet') {
    return `${BTN_SM_QUIET} whitespace-nowrap`;
  }
  return `${BTN_SM_SECONDARY} whitespace-nowrap`;
};

export const PolicyCard: React.FC<PolicyCardProps> = ({
  policy,
  payments,
  model,
  recordsExpandedAll,
  isPaymentsExpanded,
  onTogglePaymentsExpanded,
  onRequestAddRecord,
  onEditFinancialRecord,
  onDeleteFinancialRecord,
  onEditPayment,
  onDeletePayment,
  onRequestAddPayment,
  actions = [],
}) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = React.useState(false);

  if (import.meta.env.DEV && actions.length > 1) {
    const counts = new Map<string, number>();
    actions.forEach((action) => {
      counts.set(action.key, (counts.get(action.key) ?? 0) + 1);
    });
    const duplicates = Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => key);
    if (duplicates.length > 0) {
      console.warn('[PolicyCard] duplicate action keys', {
        policyId: policy.id,
        duplicates,
      });
    }
  }

  const paymentsPanelId = `policy-${policy.id}-payments`;
  const hasAutoDetails = Boolean(
    policy.insuranceType || policy.brand || policy.model || policy.vin,
  );
  const shouldShowAutoFields = policy.isVehicle || isDetailsExpanded;
  const paymentsToggleLabel = isPaymentsExpanded
    ? POLICY_TEXT.actions.hide
    : `${POLICY_TEXT.fields.payments} (${model.paymentsCount})`;
  const allFinancialRecords = React.useMemo(
    () => payments.flatMap((payment) => payment.financialRecords ?? []),
    [payments],
  );
  const hasUnpaidPayments = React.useMemo(
    () => payments.some((payment) => hasUnpaidPayment(payment)),
    [payments],
  );
  const hasUnpaidRecords = React.useMemo(
    () => payments.some((payment) => hasUnpaidRecord(payment, allFinancialRecords)),
    [payments, allFinancialRecords],
  );
  const expiryBadge = React.useMemo(() => getPolicyExpiryBadge(policy.endDate), [policy.endDate]);
  const computedStatusBadge = React.useMemo(
    () => getPolicyComputedStatusBadge(policy.computedStatus),
    [policy.computedStatus],
  );
  const renderTruncatedText = (label: string, value: string) => (
    <LabelValuePair
      label={label}
      className="min-w-0 flex-nowrap"
      valueClassName="min-w-0 flex-1"
      value={
        <span className="block truncate" title={value}>
          {value}
        </span>
      }
    />
  );

  const renderTruncatedCompany = (label: string, value: string) => (
    <LabelValuePair
      label={label}
      className="min-w-0 flex-nowrap"
      valueClassName="min-w-0 flex-1"
      value={
        <span className="block min-w-0 truncate" title={value}>
          <ColoredLabel
            value={value}
            fallback={POLICY_PLACEHOLDER}
            showDot
            className="max-w-full truncate font-semibold text-slate-900"
          />
        </span>
      }
    />
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-label">{POLICY_TEXT.fields.number}:</span>
              <PolicyNumberButton
                value={model.number}
                placeholder={POLICY_PLACEHOLDER}
                className="text-sm font-semibold text-slate-900 underline underline-offset-2 decoration-dotted decoration-slate-300 transition hover:decoration-slate-500"
              />

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
              {computedStatusBadge && (
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    computedStatusBadge.tone === 'red'
                      ? 'bg-red-100 text-red-700'
                      : computedStatusBadge.tone === 'orange'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-emerald-100 text-emerald-700',
                  ].join(' ')}
                >
                  {computedStatusBadge.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Начало: {model.startDate} · Окончание: {model.endDate}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="text-right">
              <p className="app-label">{POLICY_TEXT.fields.sum}</p>
              <p className="text-sm font-semibold text-slate-900">{model.sum}</p>
            </div>

            {actions.length > 0 && (
              <div className="flex flex-nowrap items-center justify-end gap-2 overflow-x-auto">
                {actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className={actionClassName(action.variant)}
                    onClick={(event) => {
                      event.stopPropagation();
                      action.onClick();
                    }}
                    aria-label={action.ariaLabel ?? action.label}
                    title={action.title ?? action.label}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {renderTruncatedText(POLICY_TEXT.fields.client, model.client)}
          {renderTruncatedCompany(POLICY_TEXT.fields.company, model.insuranceCompany)}
          {renderTruncatedText(POLICY_TEXT.fields.channel, model.salesChannel)}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 whitespace-pre-wrap break-words">
          {model.note}
        </div>

        {!policy.isVehicle && hasAutoDetails && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => setIsDetailsExpanded((prev) => !prev)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              {isDetailsExpanded ? 'Скрыть детали' : 'Подробнее'}
            </button>
          </div>
        )}
      </div>

      {shouldShowAutoFields && (
        <div className="border-t border-slate-200 bg-slate-50/70 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LabelValuePair label={POLICY_TEXT.fields.type} value={model.insuranceType} />
            <LabelValuePair label={POLICY_TEXT.fields.brand} value={model.brand} />
            <LabelValuePair label={POLICY_TEXT.fields.model} value={model.model} />
            <LabelValuePair label={POLICY_TEXT.fields.vin} value={model.vin} />
          </div>
        </div>
      )}

      {payments.length > 0 && !isPaymentsExpanded ? (
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onTogglePaymentsExpanded}
              aria-expanded={false}
              aria-controls={paymentsPanelId}
              className={BTN_SM_PRIMARY}
            >
              {paymentsToggleLabel}
            </button>
            {onRequestAddPayment && (
              <button type="button" onClick={onRequestAddPayment} className={BTN_SM_SECONDARY}>
                {POLICY_TEXT.actions.addPayment}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="app-label">{POLICY_TEXT.fields.payments}</p>
              {model.paymentsCount > 0 && (
                <span className="text-xs text-slate-500">{model.paymentsCountLabel}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onRequestAddPayment && (
                <button type="button" onClick={onRequestAddPayment} className={BTN_SM_SECONDARY}>
                  {POLICY_TEXT.actions.addPayment}
                </button>
              )}

              {payments.length > 0 && (
                <button
                  type="button"
                  onClick={onTogglePaymentsExpanded}
                  aria-expanded={isPaymentsExpanded}
                  aria-controls={paymentsPanelId}
                  className={BTN_SM_QUIET}
                >
                  {paymentsToggleLabel}
                </button>
              )}
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="mt-3">
              <div className={PANEL_MUTED_TEXT}>{POLICY_TEXT.messages.noPayments}</div>
            </div>
          ) : (
            <div id={paymentsPanelId} className="mt-3 space-y-2">
              {payments.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  recordsExpandedOverride={recordsExpandedAll}
                  onEditPayment={onEditPayment}
                  onDeletePayment={onDeletePayment}
                  onRequestAddRecord={onRequestAddRecord}
                  onEditFinancialRecord={onEditFinancialRecord}
                  onDeleteFinancialRecord={onDeleteFinancialRecord}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
