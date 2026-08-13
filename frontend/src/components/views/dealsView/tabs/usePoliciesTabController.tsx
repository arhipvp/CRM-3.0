import { useMemo, useState } from 'react';
import type {
  Client,
  Deal,
  FinancialRecordCreationContext,
  Payment,
  Policy,
} from '../../../../types';
import { confirmTexts } from '../../../../constants/confirmTexts';
import { useConfirm } from '../../../../hooks/useConfirm';
import { PolicySortKey, policyHasUnpaidPayments, policyHasUnpaidRecords } from '../helpers';
import { FileUploadManager } from '../../../FileUploadManager';
import { usePolicyDocuments } from '../../policies/usePolicyDocuments';

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

export const POLICY_ACTION_CLASS = 'h-8 whitespace-nowrap px-3 text-[11px]';

export interface PoliciesTabProps {
  selectedDeal: Deal | null;
  deals?: Deal[];
  sortedPolicies: Policy[];
  relatedPayments: Payment[];
  clients: Client[];
  onOpenClient: (clientId: string) => Promise<void>;
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
  onMarkPaymentPaid?: (paymentId: string, actualDate: string) => Promise<void>;
  onMarkFinancialRecordPaid?: (recordId: string, paidDate: string) => Promise<void>;
  onRequestAddPolicy: (dealId: string) => void;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onMovePolicy?: (policyId: string, targetDealId: string) => Promise<void>;
  onUpdatePolicyRenewed: (policyId: string, isRenewed: boolean) => Promise<void>;
  onRequestEditPolicy: (policy: Policy) => void;
  onUploadAndRecognizePolicyFiles?: (files: File[]) => Promise<void>;
  onDealPreview?: (dealId: string) => void;
  onDealSelect?: (dealId: string) => void;
  policyRecognitionMessage?: string | null;
  isRecognizingPolicyFiles?: boolean;
  isLoading?: boolean;
}

export function usePoliciesTabController({
  selectedDeal,
  deals = [],
  sortedPolicies,
  relatedPayments,
  policySortKey,
  policySortOrder,
  setPolicySortKey,
  setPolicySortOrder,
  setEditingPaymentId,
  setCreatingPaymentPolicyId,
  onDeleteFinancialRecord,
  onDeletePayment,
  onRequestAddPolicy,
  onDeletePolicy,
  onMovePolicy,
  onUpdatePolicyRenewed,
  onRequestEditPolicy,
  onOpenClient,
  onUploadAndRecognizePolicyFiles,
  onMarkPaymentPaid,
  onMarkFinancialRecordPaid,
  onDealPreview,
  onDealSelect,
  policyRecognitionMessage,
  isRecognizingPolicyFiles = false,
  isLoading = false,
}: PoliciesTabProps) {
  const [openingClientId, setOpeningClientId] = useState<string | null>(null);
  const [showUnpaidPaymentsOnly, setShowUnpaidPaymentsOnly] = useState(false);
  const [showUnpaidRecordsOnly, setShowUnpaidRecordsOnly] = useState(false);
  const [showRenewedPolicies, setShowRenewedPolicies] = useState(false);
  const [paymentToMarkPaid, setPaymentToMarkPaid] = useState<Payment | null>(null);
  const [paymentPaidDate, setPaymentPaidDate] = useState('');
  const [paymentPaidDateError, setPaymentPaidDateError] = useState<string | null>(null);
  const [recordToMarkPaidId, setRecordToMarkPaidId] = useState<string | null>(null);
  const [recordPaidDate, setRecordPaidDate] = useState('');
  const [recordPaidDateError, setRecordPaidDateError] = useState<string | null>(null);
  const [policyToMove, setPolicyToMove] = useState<Policy | null>(null);
  const [isMovingPolicy, setIsMovingPolicy] = useState(false);
  const { confirm, ConfirmDialogRenderer } = useConfirm();

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
    return sortedPolicies.filter((policy) => {
      if (!showRenewedPolicies && policy.isRenewed) {
        return false;
      }
      const shouldFilterUnpaid = showUnpaidPaymentsOnly || showUnpaidRecordsOnly;
      if (!shouldFilterUnpaid) {
        return true;
      }
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
    showRenewedPolicies,
    showUnpaidPaymentsOnly,
    showUnpaidRecordsOnly,
    sortedPolicies,
  ]);
  const { documentsByPolicyId, loadPolicyDocuments } = usePolicyDocuments();

  if (!selectedDeal) {
    return { kind: 'empty' as const };
  }

  if (isLoading && !sortedPolicies.length) {
    return { kind: 'loading' as const };
  }

  const renderPolicyFileUpload = () => {
    if (!onUploadAndRecognizePolicyFiles) {
      return null;
    }

    const isUploadDisabled =
      isRecognizingPolicyFiles || isLoading || Boolean(selectedDeal.deletedAt);

    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Файлы полиса</p>
            <p className="text-xs text-slate-500">
              Загрузим в сделку, распознаем ИИ и откроем черновик полиса.
            </p>
          </div>
          {isRecognizingPolicyFiles && (
            <span className="text-xs font-semibold text-sky-700">Распознаем...</span>
          )}
        </div>
        <FileUploadManager
          onUpload={async (file) => {
            await onUploadAndRecognizePolicyFiles([file]);
          }}
          onUploadFiles={onUploadAndRecognizePolicyFiles}
          disabled={isUploadDisabled}
        />
        {policyRecognitionMessage && (
          <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {policyRecognitionMessage}
          </p>
        )}
      </div>
    );
  };

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

  const handleOpenDeal = (dealId: string) => {
    if (onDealPreview) {
      onDealPreview(dealId);
      return;
    }
    onDealSelect?.(dealId);
  };

  const handleUpdatePolicyRenewed = async (policy: Policy, isRenewed: boolean) => {
    const confirmed = await confirm(
      isRenewed
        ? confirmTexts.markPolicyAsRenewed(policy.number)
        : confirmTexts.markPolicyAsNotRenewed(policy.number),
    );
    if (!confirmed) {
      return;
    }
    await onUpdatePolicyRenewed(policy.id, isRenewed);
  };

  const closeMarkPaidPrompt = () => {
    setPaymentToMarkPaid(null);
    setPaymentPaidDate('');
    setPaymentPaidDateError(null);
  };

  const openMarkPaidPrompt = (payment: Payment) => {
    setPaymentToMarkPaid(payment);
    setPaymentPaidDate('');
    setPaymentPaidDateError(null);
  };

  const handleConfirmMarkPaid = async () => {
    if (!paymentToMarkPaid || !onMarkPaymentPaid) {
      return;
    }
    if (!paymentPaidDate) {
      setPaymentPaidDateError('Укажите дату оплаты.');
      return;
    }
    const confirmed = await confirm(confirmTexts.markPaymentAsPaid(paymentPaidDate));
    if (!confirmed) {
      return;
    }
    await onMarkPaymentPaid(paymentToMarkPaid.id, paymentPaidDate);
    closeMarkPaidPrompt();
  };

  const closeMarkRecordPaidPrompt = () => {
    setRecordToMarkPaidId(null);
    setRecordPaidDate('');
    setRecordPaidDateError(null);
  };

  const openMarkRecordPaidPrompt = (recordId: string) => {
    setRecordToMarkPaidId(recordId);
    setRecordPaidDate('');
    setRecordPaidDateError(null);
  };

  const handleConfirmRecordMarkPaid = async () => {
    if (!recordToMarkPaidId || !onMarkFinancialRecordPaid) {
      return;
    }
    if (!recordPaidDate) {
      setRecordPaidDateError('Укажите дату оплаты.');
      return;
    }
    const confirmed = await confirm(confirmTexts.markFinancialRecordAsPaid(recordPaidDate));
    if (!confirmed) {
      return;
    }
    await onMarkFinancialRecordPaid(recordToMarkPaidId, recordPaidDate);
    closeMarkRecordPaidPrompt();
  };

  const handleConfirmMovePolicy = async (policyId: string, targetDealId: string) => {
    if (!onMovePolicy) {
      return;
    }
    setIsMovingPolicy(true);
    try {
      await onMovePolicy(policyId, targetDealId);
      setPolicyToMove(null);
    } finally {
      setIsMovingPolicy(false);
    }
  };

  if (!sortedPolicies.length) {
    return {
      kind: 'no-policies' as const,
      policyFileUpload: renderPolicyFileUpload(),
      selectedDealId: selectedDeal.id,
      onRequestAddPolicy,
    };
  }

  return {
    kind: 'ready' as const,
    ConfirmDialogRenderer,
    closeMarkPaidPrompt,
    closeMarkRecordPaidPrompt,
    deals,
    documentsByPolicyId,
    handleConfirmMarkPaid,
    handleConfirmMovePolicy,
    handleConfirmRecordMarkPaid,
    handleOpenDeal,
    handleSortChange,
    handleUpdatePolicyRenewed,
    isLoading,
    isMovingPolicy,
    loadPolicyDocuments,
    onDealPreview,
    onDealSelect,
    onDeleteFinancialRecord,
    onDeletePayment,
    onDeletePolicy,
    onMarkFinancialRecordPaid,
    onMarkPaymentPaid,
    onMovePolicy,
    onOpenClient,
    onRequestAddPolicy,
    onRequestEditPolicy,
    openMarkPaidPrompt,
    openMarkRecordPaidPrompt,
    openingClientId,
    paymentPaidDate,
    paymentPaidDateError,
    paymentToMarkPaid,
    paymentsByPolicyMap,
    policyToMove,
    recordPaidDate,
    recordPaidDateError,
    recordToMarkPaidId,
    renderPolicyFileUpload,
    selectedDeal,
    setCreatingPaymentPolicyId,
    setEditingPaymentId,
    setOpeningClientId,
    setPaymentPaidDate,
    setPaymentPaidDateError,
    setPolicyToMove,
    setRecordPaidDate,
    setRecordPaidDateError,
    setShowRenewedPolicies,
    setShowUnpaidPaymentsOnly,
    setShowUnpaidRecordsOnly,
    showRenewedPolicies,
    showUnpaidPaymentsOnly,
    showUnpaidRecordsOnly,
    sortLabel,
    sortOrderSymbol,
    visiblePolicies,
  };
}
