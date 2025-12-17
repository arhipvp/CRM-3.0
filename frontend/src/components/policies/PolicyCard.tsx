import React from 'react';

import type { Payment, Policy } from '../../types';
import { formatCurrency, formatDate } from '../views/dealsView/helpers';
import { ColoredLabel } from '../common/ColoredLabel';
import { LabelValuePair } from '../common/LabelValuePair';
import { PaymentCard } from './PaymentCard';

type PolicyCardVariant = 'policiesView' | 'dealPoliciesTab';

interface PolicyCardProps {
  variant: PolicyCardVariant;
  policy: Policy;
  payments: Payment[];
  recordsExpandedAll: boolean;
  isPaymentsExpanded: boolean;
  onTogglePaymentsExpanded: () => void;
  onRequestAddRecord: (paymentId: string, recordType: 'income' | 'expense') => void;
  onEditFinancialRecord: (recordId: string) => void;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;

  onRequestEditPolicy?: () => void;
  onRequestFiles?: () => void;
  onDeletePolicy?: () => void;
  onRequestAddPayment?: () => void;
  onEditPayment?: (paymentId: string) => void;
}

const describePaymentsCount = (count: number) =>
  count ? `${count} запись${count === 1 ? '' : 'ей'}` : '0 записей';

export const PolicyCard: React.FC<PolicyCardProps> = ({
  variant,
  policy,
  payments,
  recordsExpandedAll,
  isPaymentsExpanded,
  onTogglePaymentsExpanded,
  onRequestAddRecord,
  onEditFinancialRecord,
  onDeleteFinancialRecord,
  onRequestEditPolicy,
  onRequestFiles,
  onDeletePolicy,
  onRequestAddPayment,
  onEditPayment,
}) => {
  const paymentsPanelId = `policy-${policy.id}-payments`;

  const headerClass =
    variant === 'policiesView'
      ? 'app-panel shadow-none space-y-2'
      : 'rounded-2xl border border-slate-200 bg-white';

  const topBlockClass =
    variant === 'policiesView' ? 'px-5 py-4 text-sm text-slate-500 space-y-3' : 'p-4 space-y-4';

  const detailsBlockClass =
    variant === 'policiesView'
      ? 'border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3'
      : 'border-t border-slate-200 bg-slate-50/70 p-4';

  const paymentsBlockClass =
    variant === 'policiesView'
      ? 'border-t border-slate-100 bg-slate-50 px-5 py-4 text-sm text-slate-600'
      : 'border-t border-slate-200 p-4';

  return (
    <section className={headerClass}>
      <div className={topBlockClass}>
        {variant === 'policiesView' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr_0.8fr]">
              <div>
                <p className="app-label">Номер</p>
                <p className="text-lg font-semibold text-slate-900">{policy.number || '—'}</p>
              </div>
              <div className="flex gap-8 text-[11px] uppercase tracking-[0.35em] text-slate-500 mt-3 sm:mt-0">
                <span>Начало: {formatDate(policy.startDate)}</span>
                <span>Окончание: {formatDate(policy.endDate)}</span>
              </div>
              <div className="flex items-start justify-end gap-4 text-[10px] uppercase tracking-[0.35em] text-slate-400">
                <div>
                  <p>Действия</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {onRequestEditPolicy && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm rounded-xl"
                        onClick={onRequestEditPolicy}
                      >
                        Ред.
                      </button>
                    )}
                    {onRequestFiles && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm rounded-xl"
                        onClick={onRequestFiles}
                      >
                        Файлы
                      </button>
                    )}
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
              <LabelValuePair label="Канал" value={policy.salesChannel || '—'} className="min-w-[220px]" />
              <LabelValuePair
                label="Сумма"
                value={`${formatCurrency(policy.paymentsPaid)} / ${formatCurrency(policy.paymentsTotal)}`}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="app-label">Номер</p>
                <p className="text-sm font-semibold text-slate-900">{policy.number || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                {onRequestEditPolicy && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm rounded-xl"
                    onClick={onRequestEditPolicy}
                  >
                    Редактировать
                  </button>
                )}
                {onDeletePolicy && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm rounded-xl"
                    onClick={onDeletePolicy}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <LabelValuePair label="Клиент" value={(policy.insuredClientName ?? policy.clientName) || '—'} />
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
              />
              <LabelValuePair label="Канал" value={policy.salesChannel || '—'} />
              <LabelValuePair
                label="Сумма"
                value={`${formatCurrency(policy.paymentsPaid)} / ${formatCurrency(policy.paymentsTotal)}`}
              />
            </div>
          </>
        )}
      </div>

      <div className={detailsBlockClass}>
        <div className={variant === 'policiesView' ? 'flex flex-wrap gap-6 text-sm text-slate-600' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'}>
          <LabelValuePair label="Тип" value={policy.insuranceType || '—'} />
          <LabelValuePair label="Марка" value={policy.brand || '—'} />
          <LabelValuePair label="Модель" value={policy.model || '—'} />
          <LabelValuePair label="VIN" value={policy.vin || '—'} />
        </div>
      </div>

      <div className={paymentsBlockClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {variant === 'policiesView' ? <span>Платежи</span> : <p className="app-label">Платежи</p>}
            {payments.length > 0 && (
              <span className={variant === 'policiesView' ? 'text-[11px] text-slate-500' : 'text-xs text-slate-500'}>
                {describePaymentsCount(payments.length)}
              </span>
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
                className={
                  variant === 'policiesView'
                    ? 'btn btn-secondary btn-sm rounded-xl'
                    : 'btn btn-quiet btn-sm rounded-xl'
                }
              >
                {isPaymentsExpanded ? 'Скрыть' : 'Показать'}
              </button>
            )}
          </div>
        </div>

        {payments.length === 0 ? (
          variant === 'policiesView' ? (
            <div className="mt-2 app-panel-muted px-4 py-3 text-sm text-slate-600">Платежей пока нет.</div>
          ) : (
            <div className="mt-3">
              <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">Платежей пока нет.</div>
            </div>
          )
        ) : (
          <div id={paymentsPanelId} className={variant === 'policiesView' ? 'mt-2 space-y-2 text-sm text-slate-600' : 'mt-3 space-y-2'} hidden={!isPaymentsExpanded}>
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

