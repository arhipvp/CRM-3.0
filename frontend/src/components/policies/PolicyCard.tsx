import React from 'react';

import type { Payment, Policy } from '../../types';
import { ColoredLabel } from '../common/ColoredLabel';
import { LabelValuePair } from '../common/LabelValuePair';
import { PaymentCard } from './PaymentCard';
import type { PolicyCardModel } from './policyCardModel';
import { POLICY_PLACEHOLDER, POLICY_TEXT } from './text';

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
  onRequestAddPayment?: () => void;
  actions?: PolicyCardAction[];
}

const actionClassName = (variant: PolicyCardActionVariant | undefined) => {
  if (variant === 'danger') {
    return 'btn btn-danger btn-sm rounded-xl';
  }
  if (variant === 'quiet') {
    return 'btn btn-quiet btn-sm rounded-xl';
  }
  return 'btn btn-secondary btn-sm rounded-xl';
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
  onRequestAddPayment,
  actions = [],
}) => {
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="app-label">{POLICY_TEXT.fields.number}</p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">
              {model.number || POLICY_PLACEHOLDER}
            </p>
              {model.statusRaw && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {model.statusLabel}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Начало: {model.startDate} · Окончание: {model.endDate}
            </p>
          </div>

          {actions.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className={actionClassName(action.variant)}
                  onClick={action.onClick}
                  aria-label={action.ariaLabel ?? action.label}
                  title={action.title ?? action.label}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LabelValuePair label={POLICY_TEXT.fields.client} value={model.client} />
          <LabelValuePair
            label={POLICY_TEXT.fields.company}
            value={
              <ColoredLabel
                value={model.insuranceCompany}
                fallback={POLICY_PLACEHOLDER}
                showDot
                className="font-semibold text-slate-900"
              />
            }
          />
          <LabelValuePair label={POLICY_TEXT.fields.channel} value={model.salesChannel} />
          <LabelValuePair label={POLICY_TEXT.fields.sum} value={model.sum} />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50/70 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LabelValuePair label={POLICY_TEXT.fields.type} value={model.insuranceType} />
          <LabelValuePair label={POLICY_TEXT.fields.brand} value={model.brand} />
          <LabelValuePair label={POLICY_TEXT.fields.model} value={model.model} />
          <LabelValuePair label={POLICY_TEXT.fields.vin} value={model.vin} />
        </div>
      </div>

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
              <button
                type="button"
                onClick={onRequestAddPayment}
                className="btn btn-secondary btn-sm rounded-xl"
              >
                {POLICY_TEXT.actions.addPayment}
              </button>
            )}

            {payments.length > 0 && (
              <button
                type="button"
                onClick={onTogglePaymentsExpanded}
                aria-expanded={isPaymentsExpanded}
                aria-controls={paymentsPanelId}
                className="btn btn-quiet btn-sm rounded-xl"
              >
                {isPaymentsExpanded ? POLICY_TEXT.actions.hide : POLICY_TEXT.actions.show}
              </button>
            )}
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="mt-3">
            <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">
              {POLICY_TEXT.messages.noPayments}
            </div>
          </div>
        ) : (
          <div id={paymentsPanelId} className="mt-3 space-y-2" hidden={!isPaymentsExpanded}>
            {isPaymentsExpanded
              ? payments.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    recordsExpandedOverride={recordsExpandedAll}
                    onEditPayment={onEditPayment}
                    onRequestAddRecord={onRequestAddRecord}
                    onEditFinancialRecord={onEditFinancialRecord}
                    onDeleteFinancialRecord={onDeleteFinancialRecord}
                  />
                ))
              : null}
          </div>
        )}
      </div>
    </section>
  );
};
