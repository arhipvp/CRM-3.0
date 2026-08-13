import { Fragment, useMemo, useState } from 'react';
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
import { PromptDialog } from '../../../common/modal/PromptDialog';
import { buildPolicyCardModel } from '../../../policies/policyCardModel';
import {
  getPolicyComputedStatusBadge,
  getPolicyExpiryBadge,
  getPolicyRenewalBadge,
} from '../../../policies/policyIndicators';
import {
  buildPolicyLedgerRows,
  getPolicyExpiryToneClass,
  getPolicyNotePreview,
  POLICY_LEDGER_STATE_CLASS,
  POLICY_STATUS_TONE_CLASS,
} from '../../../policies/policyTableHelpers';
import { Button } from '../../../common/Button';
import {
  TABLE_CELL_CLASS_COMPACT,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../../../common/tableStyles';
import { ColoredLabel } from '../../../common/ColoredLabel';
import { FileUploadManager } from '../../../FileUploadManager';
import { PolicyMoveDialog } from '../../../policies/PolicyMoveDialog';
import { getPolicyDocumentsState, usePolicyDocuments } from '../../policies/usePolicyDocuments';
import { PolicyDocumentsList } from '../../policies/PolicyDocumentsList';

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

const POLICY_ACTION_CLASS = 'h-8 whitespace-nowrap px-3 text-[11px]';

interface PoliciesTabProps {
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

export const PoliciesTab: React.FC<PoliciesTabProps> = ({
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
}) => {
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
    <div className={'ui-panel-muted-text'}>{message}</div>
  );

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
    return (
      <section className="app-panel p-4 shadow-none space-y-3">
        {renderPolicyFileUpload()}
        {renderStatusMessage('Для сделки пока нет полисов.')}
        <Button
          type="button"
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          variant="primary"
          className="rounded-xl self-start"
        >
          Создать полис
        </Button>
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
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="check"
              checked={showRenewedPolicies}
              onChange={(event) => setShowRenewedPolicies(event.target.checked)}
            />
            Показать продлённые
          </label>
        </div>

        <Button
          type="button"
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          variant="secondary"
          size="sm"
        >
          + Создать полис
        </Button>
      </div>

      {renderPolicyFileUpload()}

      {!visiblePolicies.length && (
        <div className={'ui-panel-muted-text'}>
          {showRenewedPolicies || showUnpaidPaymentsOnly || showUnpaidRecordsOnly
            ? 'Нет полисов под выбранные фильтры.'
            : 'Продлённые полисы скрыты. Включите фильтр, чтобы посмотреть их.'}
        </div>
      )}

      {visiblePolicies.length > 0 && (
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[1100px] table-fixed border-collapse text-left text-sm xl:min-w-0"
            aria-label="Полисы сделки"
          >
            <thead
              className={`${TABLE_THEAD_CLASS} text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500`}
            >
              <tr>
                <th className="w-[14%] border border-slate-200 px-3 py-2">
                  <Button
                    type="button"
                    onClick={() => handleSortChange('number')}
                    className="w-full text-left"
                  >
                    Номер полиса
                  </Button>
                </th>
                <th className="w-[31%] border border-slate-200 px-3 py-2">Основные данные</th>
                <th className="w-[8%] border border-slate-200 px-3 py-2">
                  <Button
                    type="button"
                    onClick={() => handleSortChange('startDate')}
                    className="w-full text-left"
                  >
                    Начало
                  </Button>
                </th>
                <th className="w-[8%] border border-slate-200 px-3 py-2">
                  <Button
                    type="button"
                    onClick={() => handleSortChange('endDate')}
                    className="w-full text-left"
                  >
                    Конец
                  </Button>
                </th>
                <th className="w-[17%] border border-slate-200 px-3 py-2">Платеж</th>
                <th className="w-[22%] border border-slate-200 px-3 py-2">Финансовые записи</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {visiblePolicies.map((policy) => {
                const payments = paymentsByPolicyMap.get(policy.id) ?? [];
                const ledgerRows = buildPolicyLedgerRows(policy, payments, 'Без комментария');
                const model = buildPolicyCardModel(policy, payments);
                const computedStatusBadge = getPolicyComputedStatusBadge(policy.computedStatus);
                const expiryBadge = getPolicyExpiryBadge(policy.endDate);
                const renewalBadge = getPolicyRenewalBadge({
                  isRenewed: policy.isRenewed,
                });
                const notePreview = getPolicyNotePreview(policy.note);
                const rowSpan = Math.max(ledgerRows.length, 1);
                const firstLedgerRow = ledgerRows[0];
                const insuranceCompany = (policy.insuranceCompany ?? '').trim();
                const insuranceType = (policy.insuranceType ?? '').trim();
                const salesChannel = (policy.salesChannelName ?? policy.salesChannel ?? '').trim();
                const metaTitle = [insuranceCompany, insuranceType, salesChannel]
                  .filter(Boolean)
                  .join(', ');
                const hasMeta = Boolean(metaTitle);
                const dealTitle = (policy.dealTitle ?? '').trim() || 'Сделка';
                const canOpenDeal = Boolean(policy.dealId && (onDealPreview || onDealSelect));
                const policyDocuments = getPolicyDocumentsState(policy, documentsByPolicyId);

                return (
                  <Fragment key={policy.id}>
                    <tr key={`${policy.id}-head`} className={TABLE_ROW_CLASS}>
                      <td rowSpan={rowSpan} className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                        <div>
                          <div>
                            <p className="app-label">Полис</p>
                            <p className="mt-1 whitespace-nowrap text-base font-bold leading-tight text-slate-900">
                              {model.number}
                            </p>
                          </div>
                          <PolicyDocumentsList
                            state={policyDocuments}
                            onLoad={() => void loadPolicyDocuments(policy)}
                          />
                        </div>
                      </td>
                      <td rowSpan={rowSpan} className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                        <div className="space-y-3" data-testid={`policy-primary-data-${policy.id}`}>
                          <div className="space-y-1.5 border-b border-slate-100 pb-2.5">
                            <div className="min-w-0" data-testid={`policy-client-${policy.id}`}>
                              {model.clientId ? (
                                <Button
                                  type="button"
                                  className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 underline decoration-dotted underline-offset-2 transition hover:text-sky-700 disabled:cursor-wait"
                                  disabled={openingClientId === model.clientId}
                                  title={model.client}
                                  onClick={() => {
                                    setOpeningClientId(model.clientId);
                                    void onOpenClient(model.clientId!)
                                      .catch(() => undefined)
                                      .finally(() => {
                                        setOpeningClientId((current) =>
                                          current === model.clientId ? null : current,
                                        );
                                      });
                                  }}
                                >
                                  {model.client}
                                </Button>
                              ) : (
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {model.client}
                                </p>
                              )}
                            </div>
                            {policy.dealId ? (
                              <div
                                className="flex min-w-0 items-baseline gap-2"
                                data-testid={`policy-deal-${policy.id}`}
                              >
                                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  Сделка:
                                </span>
                                {canOpenDeal ? (
                                  <Button
                                    type="button"
                                    onClick={() => handleOpenDeal(policy.dealId)}
                                    className="link-action min-w-0 truncate text-left text-xs"
                                    title={dealTitle}
                                  >
                                    {dealTitle}
                                  </Button>
                                ) : (
                                  <span className="min-w-0 truncate text-xs font-semibold text-slate-600">
                                    {dealTitle}
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>

                          {hasMeta ? (
                            <div
                              className="flex flex-wrap items-center gap-1.5"
                              title={metaTitle}
                              data-testid={`policy-meta-${policy.id}`}
                            >
                              {insuranceCompany ? (
                                <ColoredLabel
                                  value={insuranceCompany}
                                  showDot
                                  className="max-w-full truncate text-xs font-semibold text-slate-800"
                                />
                              ) : null}
                              {insuranceType ? (
                                <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                                  {insuranceType}
                                </span>
                              ) : null}
                              {salesChannel ? (
                                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {salesChannel}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">Страховые данные не указаны</p>
                          )}

                          <div
                            className="rounded-lg bg-slate-50 px-2.5 py-2"
                            title={notePreview.fullText}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Примечание
                            </p>
                            <p className="mt-0.5 overflow-hidden text-xs text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                              {notePreview.preview}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
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
                            {renewalBadge && (
                              <span
                                className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700"
                                title={renewalBadge.tooltip}
                              >
                                {renewalBadge.label}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Оплачено / план
                            </span>
                            <span className="whitespace-nowrap text-sm font-semibold text-slate-900">
                              {model.sum}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
                            <Button
                              type="button"
                              onClick={() => onRequestEditPolicy(policy)}
                              variant="primary"
                              size="sm"
                              className={POLICY_ACTION_CLASS}
                            >
                              Редактировать
                            </Button>
                            {onMovePolicy && (
                              <Button
                                type="button"
                                onClick={() => setPolicyToMove(policy)}
                                variant="quiet"
                                size="sm"
                                className={POLICY_ACTION_CLASS}
                              >
                                Перенести
                              </Button>
                            )}
                            <Button
                              type="button"
                              onClick={() => {
                                setEditingPaymentId('new');
                                setCreatingPaymentPolicyId(policy.id);
                              }}
                              variant="success"
                              size="sm"
                              className={POLICY_ACTION_CLASS}
                            >
                              + Платеж
                            </Button>
                            <Button
                              type="button"
                              onClick={() =>
                                handleUpdatePolicyRenewed(policy, !policy.isRenewed).catch(
                                  () => undefined,
                                )
                              }
                              variant={policy.isRenewed ? 'primary' : 'warning'}
                              size="sm"
                              className={POLICY_ACTION_CLASS}
                            >
                              {policy.isRenewed ? 'Вернуть в активные' : 'Отметить продлённым'}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                              variant="danger"
                              size="sm"
                              className={POLICY_ACTION_CLASS}
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      </td>
                      <td
                        className={`${TABLE_CELL_CLASS_COMPACT} align-top whitespace-nowrap text-xs font-semibold text-slate-700`}
                        rowSpan={rowSpan}
                      >
                        {model.startDate}
                      </td>
                      <td
                        className={`${TABLE_CELL_CLASS_COMPACT} align-top whitespace-nowrap text-xs font-semibold text-slate-700`}
                        rowSpan={rowSpan}
                      >
                        {model.endDate}
                      </td>
                      <td className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                        {firstLedgerRow ? (
                          <div className="space-y-1">
                            <div
                              className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] ${POLICY_LEDGER_STATE_CLASS[firstLedgerRow.state]}`}
                              title={firstLedgerRow.line.text}
                            >
                              <span className="truncate">{firstLedgerRow.line.dateText}</span>
                              <span className="font-semibold whitespace-nowrap">
                                {firstLedgerRow.line.amountText}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {!firstLedgerRow.payment.actualDate && onMarkPaymentPaid && (
                                <Button
                                  type="button"
                                  onClick={() => openMarkPaidPrompt(firstLedgerRow.payment)}
                                  variant="quiet"
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                >
                                  Проставить оплату
                                </Button>
                              )}
                              <Button
                                type="button"
                                onClick={() =>
                                  onDeletePayment(firstLedgerRow.payment.id).catch(() => undefined)
                                }
                                variant="quiet"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                disabled={firstLedgerRow.payment.canDelete === false}
                                title={
                                  firstLedgerRow.payment.canDelete === false
                                    ? 'Сначала удалите оплаченные финансовые записи'
                                    : 'Удалить платёж'
                                }
                              >
                                Удалить платёж
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                      <td className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                        {firstLedgerRow?.records.length ? (
                          <div className="space-y-1">
                            {firstLedgerRow.records.map((recordRow) => (
                              <div
                                key={recordRow.record.id}
                                className={`space-y-0.5 rounded-md px-2 py-1 text-[11px] ${POLICY_LEDGER_STATE_CLASS[recordRow.state]}`}
                                title={recordRow.line.text}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{recordRow.line.dateText}</span>
                                  <span className="font-semibold whitespace-nowrap">
                                    {recordRow.line.amountText}
                                  </span>
                                </div>
                                <p className="truncate">{recordRow.line.comment}</p>
                                {!recordRow.record.statementId && !recordRow.record.date ? (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {onMarkFinancialRecordPaid ? (
                                      <Button
                                        type="button"
                                        onClick={() =>
                                          openMarkRecordPaidPrompt(recordRow.record.id)
                                        }
                                        variant="quiet"
                                        size="sm"
                                        className="h-7 px-2 text-[11px]"
                                      >
                                        Проставить оплату
                                      </Button>
                                    ) : null}
                                    <Button
                                      type="button"
                                      onClick={() =>
                                        onDeleteFinancialRecord(recordRow.record.id).catch(
                                          () => undefined,
                                        )
                                      }
                                      variant="quiet"
                                      size="sm"
                                      className="h-7 px-2 text-[11px]"
                                    >
                                      Удалить запись
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    {ledgerRows.slice(1).map((ledgerRow) => (
                      <tr key={`${policy.id}-${ledgerRow.payment.id}`} className={TABLE_ROW_CLASS}>
                        <td className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                          <div className="space-y-1">
                            <div
                              className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] ${POLICY_LEDGER_STATE_CLASS[ledgerRow.state]}`}
                              title={ledgerRow.line.text}
                            >
                              <span className="truncate">{ledgerRow.line.dateText}</span>
                              <span className="font-semibold whitespace-nowrap">
                                {ledgerRow.line.amountText}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {!ledgerRow.payment.actualDate && onMarkPaymentPaid && (
                                <Button
                                  type="button"
                                  onClick={() => openMarkPaidPrompt(ledgerRow.payment)}
                                  variant="quiet"
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                >
                                  Проставить оплату
                                </Button>
                              )}
                              <Button
                                type="button"
                                onClick={() =>
                                  onDeletePayment(ledgerRow.payment.id).catch(() => undefined)
                                }
                                variant="quiet"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                disabled={ledgerRow.payment.canDelete === false}
                                title={
                                  ledgerRow.payment.canDelete === false
                                    ? 'Сначала удалите оплаченные финансовые записи'
                                    : 'Удалить платёж'
                                }
                              >
                                Удалить платёж
                              </Button>
                            </div>
                          </div>
                        </td>
                        <td className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                          {ledgerRow.records.length ? (
                            <div className="space-y-1">
                              {ledgerRow.records.map((recordRow) => (
                                <div
                                  key={recordRow.record.id}
                                  className={`space-y-0.5 rounded-md px-2 py-1 text-[11px] ${POLICY_LEDGER_STATE_CLASS[recordRow.state]}`}
                                  title={recordRow.line.text}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">{recordRow.line.dateText}</span>
                                    <span className="font-semibold whitespace-nowrap">
                                      {recordRow.line.amountText}
                                    </span>
                                  </div>
                                  <p className="truncate">{recordRow.line.comment}</p>
                                  {!recordRow.record.statementId && !recordRow.record.date ? (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {onMarkFinancialRecordPaid ? (
                                        <Button
                                          type="button"
                                          onClick={() =>
                                            openMarkRecordPaidPrompt(recordRow.record.id)
                                          }
                                          variant="quiet"
                                          size="sm"
                                          className="h-7 px-2 text-[11px]"
                                        >
                                          Проставить оплату
                                        </Button>
                                      ) : null}
                                      <Button
                                        type="button"
                                        onClick={() =>
                                          onDeleteFinancialRecord(recordRow.record.id).catch(
                                            () => undefined,
                                          )
                                        }
                                        variant="quiet"
                                        size="sm"
                                        className="h-7 px-2 text-[11px]"
                                      >
                                        Удалить запись
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
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
            setPaymentPaidDateError(null);
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
      <PromptDialog
        isOpen={Boolean(recordToMarkPaidId)}
        title="Проставить дату оплаты"
        label="Дата оплаты"
        value={recordPaidDate}
        onChange={(value) => {
          setRecordPaidDate(value);
          if (recordPaidDateError) {
            setRecordPaidDateError(null);
          }
        }}
        error={recordPaidDateError}
        confirmLabel="Продолжить"
        onConfirm={() => {
          void handleConfirmRecordMarkPaid();
        }}
        onCancel={closeMarkRecordPaidPrompt}
        inputType="date"
      />
      <ConfirmDialogRenderer />
      <PolicyMoveDialog
        isOpen={Boolean(policyToMove)}
        policy={policyToMove}
        deals={deals}
        isSubmitting={isMovingPolicy}
        onCancel={() => setPolicyToMove(null)}
        onConfirm={handleConfirmMovePolicy}
      />
    </section>
  );
};
