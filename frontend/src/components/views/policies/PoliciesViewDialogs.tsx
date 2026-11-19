import type { ComponentType, Dispatch, SetStateAction } from 'react';

import type { Deal, Payment, Policy } from '../../../types';
import { Button } from '../../common/Button';
import { PromptDialog } from '../../common/modal/PromptDialog';
import { PolicyMoveDialog } from '../../policies/PolicyMoveDialog';

interface PoliciesViewDialogsProps {
  policiesHasMore: boolean;
  onLoadMorePolicies?: () => Promise<void>;
  isLoadingMorePolicies: boolean;
  paymentToMarkPaid: Payment | null;
  paymentPaidDate: string;
  paymentPaidDateError: string | null;
  policyToMove: Policy | null;
  deals: Deal[];
  isMovingPolicy: boolean;
  ConfirmDialogRenderer: ComponentType;
  onPaymentPaidDateChange: Dispatch<SetStateAction<string>>;
  onClearPaymentPaidDateError: () => void;
  onConfirmMarkPaid: () => Promise<void>;
  onCancelMarkPaid: () => void;
  onCancelMovePolicy: () => void;
  onConfirmMovePolicy: (policyId: string, targetDealId: string) => Promise<void>;
}

export const PoliciesViewDialogs = ({
  policiesHasMore,
  onLoadMorePolicies,
  isLoadingMorePolicies,
  paymentToMarkPaid,
  paymentPaidDate,
  paymentPaidDateError,
  policyToMove,
  deals,
  isMovingPolicy,
  ConfirmDialogRenderer,
  onPaymentPaidDateChange: setPaymentPaidDate,
  onClearPaymentPaidDateError,
  onConfirmMarkPaid: handleConfirmMarkPaid,
  onCancelMarkPaid: closeMarkPaidPrompt,
  onCancelMovePolicy,
  onConfirmMovePolicy: handleConfirmMovePolicy,
}: PoliciesViewDialogsProps) => (
  <>
    {policiesHasMore && onLoadMorePolicies && (
      <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center">
        <Button
          type="button"
          onClick={() => {
            void onLoadMorePolicies();
          }}
          disabled={isLoadingMorePolicies}
          variant="quiet"
          size="sm"
        >
          {isLoadingMorePolicies ? 'Загрузка...' : 'Показать ещё'}
        </Button>
      </div>
    )}
    <PromptDialog
      isOpen={Boolean(paymentToMarkPaid)}
      title="Проставить дату оплаты"
      label="Дата оплаты"
      value={paymentPaidDate}
      onChange={(value) => {
        setPaymentPaidDate(value);
        if (paymentPaidDateError) {
          onClearPaymentPaidDateError();
        }
      }}
      error={paymentPaidDateError}
      confirmLabel="Продолжить"
      onConfirm={() => {
        void handleConfirmMarkPaid();
      }}
      onCancel={closeMarkPaidPrompt}
      inputType="date"
    />
    <ConfirmDialogRenderer />
    <PolicyMoveDialog
      isOpen={Boolean(policyToMove)}
      policy={policyToMove}
      deals={deals}
      isSubmitting={isMovingPolicy}
      onCancel={onCancelMovePolicy}
      onConfirm={handleConfirmMovePolicy}
    />
  </>
);
