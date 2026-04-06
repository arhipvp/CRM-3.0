import React from 'react';

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
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="field field-input mt-2"
          />
        </div>
        <div>
          <label className="app-label">Дата окончания</label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="field field-input mt-2"
          />
        </div>
      </div>

      {policyDurationWarning && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {policyDurationWarning}
        </p>
      )}

      <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-inner shadow-slate-200/40 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-label">Платежи</p>
          </div>
          <button type="button" onClick={onAddPayment} className="btn btn-sm btn-secondary">
            + Добавить платёж
          </button>
        </div>
        {showMiniIndex && (
          <div
            className="sticky top-0 z-10 mt-4 rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur"
            data-testid="policy-payment-mini-index"
          >
            <div className="flex flex-wrap gap-2">
              {paymentEntries.map((entry, displayIndex) => (
                <button
                  key={`jump-${entry.sourceIndex}`}
                  type="button"
                  onClick={() => {
                    onExpandPaymentDetails(entry.sourceIndex);
                    scrollToPayment(entry.sourceIndex);
                  }}
                  data-testid={`policy-payment-index-${displayIndex + 1}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    activeSourceIndex === entry.sourceIndex
                      ? 'border-sky-300 bg-sky-100 text-sky-800 shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'
                  }`}
                >
                  Платёж {displayIndex + 1}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 space-y-3">
          {firstPaymentDateWarning && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {firstPaymentDateWarning}
            </p>
          )}
          {paymentEntries.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
              Добавьте хотя бы один платёж, чтобы связать финансовые данные.
            </p>
          )}
        </div>
        <div
          ref={paymentListRef}
          className="mt-4 max-h-[min(46vh,34rem)] space-y-5 overflow-y-auto pr-1"
          data-testid="policy-payment-list"
        >
          {paymentEntries.map((entry, displayIndex) => (
            <div
              key={entry.payment.id ?? `payment-${entry.sourceIndex}`}
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
      </div>
    </div>
  );
};
