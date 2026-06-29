import React from 'react';

import { DateInput } from '../../../common/forms/DateInput';
import { Button } from '../../../common/Button';
import { EmptyState } from '../../../common/EmptyState';
import { InlineAlert } from '../../../common/InlineAlert';
import { Panel } from '../../../common/layoutPrimitives';
import { PaymentSection } from './PaymentSection';
import type { FinancialRecordDraft, PaymentDraft } from '../types';
import type { PaymentDraftOrderEntry } from '../paymentDraftOrdering';
import type { PaymentIssuesByIndex } from '../paymentIssues';

interface PolicyPaymentsStepProps {
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  policyDurationWarning: string | null;
  paymentEntries: PaymentDraftOrderEntry[];
  paymentIssuesByIndex: PaymentIssuesByIndex;
  expandedPaymentIndex: number | null;
  onTogglePaymentDetails: (index: number) => void;
  onExpandPaymentDetails: (index: number) => void;
  onAddPayment: () => void;
  firstPaymentDateWarning: string | null;
  onPaymentFieldChange: (
    index: number,
    field: keyof Omit<PaymentDraft, 'incomes' | 'expenses'>,
    value: string,
  ) => void;
  onRemovePayment: (index: number) => void;
  onAddRecord: (paymentIndex: number, type: 'incomes' | 'expenses') => void;
  onUpdateRecord: (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string,
  ) => void;
  onRemoveRecord: (paymentIndex: number, type: 'incomes' | 'expenses', recordIndex: number) => void;
}

export const PolicyPaymentsStep: React.FC<PolicyPaymentsStepProps> = ({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  policyDurationWarning,
  paymentEntries,
  paymentIssuesByIndex,
  expandedPaymentIndex,
  onTogglePaymentDetails,
  onExpandPaymentDetails,
  onAddPayment,
  firstPaymentDateWarning,
  onPaymentFieldChange,
  onRemovePayment,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
}) => {
  const paymentListRef = React.useRef<HTMLDivElement | null>(null);
  const cardRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const showMiniIndex = paymentEntries.length >= 4;
  const [activeSourceIndex, setActiveSourceIndex] = React.useState<number | null>(
    paymentEntries[0]?.sourceIndex ?? null,
  );

  const scrollToPayment = (sourceIndex: number, behavior: ScrollBehavior = 'smooth') => {
    const container = paymentListRef.current;
    const card = cardRefs.current[sourceIndex];
    if (!container || !card) {
      return;
    }

    setActiveSourceIndex(sourceIndex);
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const offset = cardRect.top - containerRect.top + container.scrollTop - 12;
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ top: Math.max(offset, 0), behavior });
      return;
    }

    container.scrollTop = Math.max(offset, 0);
  };

  React.useEffect(() => {
    setActiveSourceIndex(paymentEntries[0]?.sourceIndex ?? null);
  }, [paymentEntries]);

  React.useEffect(() => {
    const container = paymentListRef.current;
    if (!container || !showMiniIndex) {
      return;
    }

    const updateActiveSourceIndex = () => {
      const containerTop = container.getBoundingClientRect().top;
      let nextActive = paymentEntries[0]?.sourceIndex ?? null;
      let smallestDistance = Number.POSITIVE_INFINITY;

      paymentEntries.forEach((entry) => {
        const card = cardRefs.current[entry.sourceIndex];
        if (!card) {
          return;
        }

        const distance = Math.abs(card.getBoundingClientRect().top - containerTop - 12);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          nextActive = entry.sourceIndex;
        }
      });

      setActiveSourceIndex(nextActive);
    };

    updateActiveSourceIndex();
    container.addEventListener('scroll', updateActiveSourceIndex, { passive: true });
    window.addEventListener('resize', updateActiveSourceIndex);

    return () => {
      container.removeEventListener('scroll', updateActiveSourceIndex);
      window.removeEventListener('resize', updateActiveSourceIndex);
    };
  }, [paymentEntries, showMiniIndex]);

  React.useEffect(() => {
    if (expandedPaymentIndex == null) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollToPayment(expandedPaymentIndex, 'smooth');
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [expandedPaymentIndex]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="app-label">Дата начала</label>
          <DateInput
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="field field-input mt-2"
          />
        </div>
        <div>
          <label className="app-label">Дата окончания</label>
          <DateInput
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="field field-input mt-2"
          />
        </div>
      </div>

      {policyDurationWarning && (
        <InlineAlert tone="info" className="border-amber-200 bg-amber-50 text-amber-800">
          {policyDurationWarning}
        </InlineAlert>
      )}

      <Panel variant="muted" padding="md" className="md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-label">Платежи</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            aria-label="+ Добавить платёж"
            onClick={onAddPayment}
          >
            Добавить платёж
          </Button>
        </div>
        {showMiniIndex && (
          <div
            className="app-segmented-control sticky top-0 z-10 mt-4 bg-white/95 shadow-sm backdrop-blur"
            data-testid="policy-payment-mini-index"
          >
            {paymentEntries.map((entry, displayIndex) => {
              const isSelected = activeSourceIndex === entry.sourceIndex;
              return (
                <button
                  key={`jump-${entry.sourceIndex}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    onExpandPaymentDetails(entry.sourceIndex);
                    scrollToPayment(entry.sourceIndex);
                  }}
                  data-testid={`policy-payment-index-${displayIndex + 1}`}
                  className={`app-segmented-control-button text-xs ${
                    isSelected
                      ? 'border border-[var(--app-border)] bg-white font-semibold text-sky-700 shadow-sm'
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
                  }`}
                >
                  Платёж {displayIndex + 1}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-4 space-y-3">
          {firstPaymentDateWarning && (
            <InlineAlert tone="info" className="border-amber-200 bg-amber-50 text-amber-800">
              {firstPaymentDateWarning}
            </InlineAlert>
          )}
          {paymentEntries.length === 0 && (
            <EmptyState compact className="w-full border-dashed bg-white">
              Добавьте хотя бы один платёж, чтобы связать финансовые данные.
            </EmptyState>
          )}
        </div>
        <div
          ref={paymentListRef}
          className="mt-4 max-h-[min(46vh,34rem)] space-y-5 overflow-y-auto pr-1"
          data-testid="policy-payment-list"
        >
          {paymentEntries.map((entry, displayIndex) => (
            <div
              key={entry.payment.id || `payment-${entry.sourceIndex}`}
              ref={(node) => {
                cardRefs.current[entry.sourceIndex] = node;
              }}
            >
              <PaymentSection
                paymentIndex={entry.sourceIndex}
                paymentNumber={displayIndex + 1}
                payment={entry.payment}
                issues={paymentIssuesByIndex[entry.sourceIndex] ?? []}
                onFieldChange={onPaymentFieldChange}
                onRemovePayment={onRemovePayment}
                onAddRecord={onAddRecord}
                onUpdateRecord={onUpdateRecord}
                onRemoveRecord={onRemoveRecord}
                showRecords={false}
                dense
                isExpanded={expandedPaymentIndex === entry.sourceIndex}
                onToggleExpand={() => onTogglePaymentDetails(entry.sourceIndex)}
                showExpandToggle
              />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};
