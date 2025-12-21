import React from 'react';

import type { Payment, Policy } from '../../types';
import { ColoredLabel } from '../common/ColoredLabel';
import { LabelValuePair } from '../common/LabelValuePair';
import { PaymentCard } from './PaymentCard';
import { buildPolicyCardModel } from './policyCardModel';

export type PolicyCardActionVariant = 'secondary' | 'quiet' | 'danger';

export interface PolicyCardAction {
  key: 'edit' | 'files' | 'delete';
  label: string;
  onClick: () => void;
  variant?: PolicyCardActionVariant;
}

interface PolicyCardProps {
  policy: Policy;
  payments: Payment[];
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
  const model = buildPolicyCardModel(policy, payments);
  const paymentsPanelId = `policy-${policy.id}-payments`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="app-label">Номер</p>
            <p className="text-sm font-semibold text-slate-900">{model.number}</p>
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
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LabelValuePair label="Клиент" value={model.client} />
          <LabelValuePair
            label="Компания"
            value={
              <ColoredLabel
                value={model.insuranceCompany}
                fallback="—"
                showDot
                className="font-semibold text-slate-900"
              />
            }
          />
          <LabelValuePair label="Канал" value={model.salesChannel} />
          <LabelValuePair label="Сумма" value={model.sum} />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50/70 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LabelValuePair label="Тип" value={model.insuranceType} />
          <LabelValuePair label="Марка" value={model.brand} />
          <LabelValuePair label="Модель" value={model.model} />
          <LabelValuePair label="VIN" value={model.vin} />
        </div>
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="app-label">Платежи</p>
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
                + Добавить платёж
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
                {isPaymentsExpanded ? 'Скрыть' : 'Показать'}
              </button>
            )}
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="mt-3">
            <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">Платежей пока нет.</div>
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

