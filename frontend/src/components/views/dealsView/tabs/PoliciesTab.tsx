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
import { BTN_PRIMARY, BTN_SM_QUIET, BTN_SM_SECONDARY } from '../../../common/buttonStyles';
import { PANEL_MUTED_TEXT } from '../../../common/uiClassNames';
import { ColoredLabel } from '../../../common/ColoredLabel';
import { FileUploadManager } from '../../../FileUploadManager';

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
  onMarkPaymentPaid?: (paymentId: string, actualDate: string) => Promise<void>;
  onMarkFinancialRecordPaid?: (recordId: string, paidDate: string) => Promise<void>;
  onRequestAddPolicy: (dealId: string) => void;
  onDeletePolicy: (policyId: string) => Promise<void>;
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
  onRequestEditPolicy,
  onUploadAndRecognizePolicyFiles,
  onMarkPaymentPaid,
  onMarkFinancialRecordPaid,
  onDealPreview,
  onDealSelect,
  policyRecognitionMessage,
  isRecognizingPolicyFiles = false,
  isLoading = false,
}) => {
  const [showUnpaidPaymentsOnly, setShowUnpaidPaymentsOnly] = useState(false);
  const [showUnpaidRecordsOnly, setShowUnpaidRecordsOnly] = useState(false);
  const [paymentToMarkPaid, setPaymentToMarkPaid] = useState<Payment | null>(null);
  const [paymentPaidDate, setPaymentPaidDate] = useState('');
  const [paymentPaidDateError, setPaymentPaidDateError] = useState<string | null>(null);
  const [recordToMarkPaidId, setRecordToMarkPaidId] = useState<string | null>(null);
  const [recordPaidDate, setRecordPaidDate] = useState('');
  const [recordPaidDateError, setRecordPaidDateError] = useState<string | null>(null);
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
    <div className={PANEL_MUTED_TEXT}>{message}</div>
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

  if (!sortedPolicies.length) {
    return (
      <section className="app-panel p-4 shadow-none space-y-3">
        {renderPolicyFileUpload()}
        {renderStatusMessage('Для сделки пока нет полисов.')}
        <button
          type="button"
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className={`${BTN_PRIMARY} rounded-xl self-start`}
        >
          Создать полис
        </button>
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
        </div>

        <button
          type="button"
          onClick={() => onRequestAddPolicy(selectedDeal.id)}
          className={BTN_SM_SECONDARY}
        >
          + Создать полис
        </button>
      </div>

      {renderPolicyFileUpload()}

      <div className="overflow-x-auto">
        <table className="min-w-[1900px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="px-3 py-2 border border-slate-300">
                <button
                  type="button"
                  onClick={() => handleSortChange('number')}
                  className="w-full text-left"
                >
                  Номер полиса
                </button>
              </th>
              <th className="px-3 py-2 border border-slate-300">Основные данные</th>
              <th className="px-3 py-2 border border-slate-300 w-[6%]">
                <button
                  type="button"
                  onClick={() => handleSortChange('startDate')}
                  className="w-full text-left"
                >
                  Начало
                </button>
              </th>
              <th className="px-3 py-2 border border-slate-300 w-[6%]">
                <button
                  type="button"
                  onClick={() => handleSortChange('endDate')}
                  className="w-full text-left"
                >
                  Конец
                </button>
              </th>
              <th className="px-3 py-2 border border-slate-300">Платеж</th>
              <th className="px-3 py-2 border border-slate-300">Финансовые записи</th>
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
                renewedByNumber: policy.renewedByNumber,
              });
              const notePreview = getPolicyNotePreview(policy.note);
              const rowSpan = Math.max(ledgerRows.length, 1);
              const firstLedgerRow = ledgerRows[0];
              const insuranceCompany = (model.insuranceCompany ?? '').trim();
              const insuranceType = (model.insuranceType ?? '').trim();
              const salesChannel = (model.salesChannel ?? '').trim();
              const metaTitle = [insuranceCompany, insuranceType, salesChannel]
                .filter(Boolean)
                .join(', ');
              const hasMeta = Boolean(metaTitle);
              const dealTitle = (policy.dealTitle ?? '').trim() || 'Сделка';
              const canOpenDeal = Boolean(policy.dealId && (onDealPreview || onDealSelect));

              return (
                <Fragment key={policy.id}>
                  <tr key={`${policy.id}-head`} className="hover:bg-slate-50 transition-colors">
                    <td rowSpan={rowSpan} className="px-3 py-2 border border-slate-300 align-top">
                      <p className="text-xl font-bold text-slate-900 leading-tight">
                        {model.number}
                      </p>
                    </td>
                    <td rowSpan={rowSpan} className="px-3 py-2 border border-slate-300 align-top">
                      <div className="space-y-1.5">
                        <p className="text-sm font-semibold text-slate-900">{model.client}</p>
                        {policy.dealId ? (
                          canOpenDeal ? (
                            <button
                              type="button"
                              onClick={() => handleOpenDeal(policy.dealId)}
                              className="text-xs font-semibold text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900"
                            >
                              {dealTitle}
                            </button>
                          ) : (
                            <p className="text-xs font-semibold text-slate-600">{dealTitle}</p>
                          )
                        ) : null}
                        {hasMeta ? (
                          <p className="text-sm text-slate-700 truncate" title={metaTitle}>
                            {insuranceCompany ? (
                              <>
                                <ColoredLabel
                                  value={insuranceCompany}
                                  showDot
                                  className="text-sm"
                                />
                                {(insuranceType || salesChannel) && ', '}
                              </>
                            ) : null}
                            {insuranceType}
                            {insuranceType && salesChannel ? ', ' : null}
                            {salesChannel}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-700">—</p>
                        )}
                        <p
                          className="text-xs text-slate-700 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
                          title={notePreview.fullText}
                        >
                          {notePreview.preview}
                        </p>
                        <div className="flex flex-wrap gap-1">
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
                        <p className="text-sm font-semibold text-slate-900">{model.sum}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() => onRequestEditPolicy(policy)}
                            className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                          >
                            Редактировать
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPaymentId('new');
                              setCreatingPaymentPolicyId(policy.id);
                            }}
                            className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                          >
                            + Платеж
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                            className="btn btn-danger btn-sm rounded-xl h-7 px-2 text-[11px]"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-3 py-2 border border-slate-300 text-xs font-semibold text-slate-800 align-top whitespace-nowrap"
                      rowSpan={rowSpan}
                    >
                      {model.startDate}
                    </td>
                    <td
                      className="px-3 py-2 border border-slate-300 text-xs font-semibold text-slate-800 align-top whitespace-nowrap"
                      rowSpan={rowSpan}
                    >
                      {model.endDate}
                    </td>
                    <td className="px-3 py-2 border border-slate-300 align-top">
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
                              <button
                                type="button"
                                onClick={() => openMarkPaidPrompt(firstLedgerRow.payment)}
                                className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                              >
                                Проставить оплату
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                onDeletePayment(firstLedgerRow.payment.id).catch(() => undefined)
                              }
                              className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                              disabled={firstLedgerRow.payment.canDelete === false}
                              title={
                                firstLedgerRow.payment.canDelete === false
                                  ? 'Сначала удалите оплаченные финансовые записи'
                                  : 'Удалить платёж'
                              }
                            >
                              Удалить платёж
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 border border-slate-300 align-top">
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
                                    <button
                                      type="button"
                                      onClick={() => openMarkRecordPaidPrompt(recordRow.record.id)}
                                      className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                                    >
                                      Проставить оплату
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onDeleteFinancialRecord(recordRow.record.id).catch(
                                        () => undefined,
                                      )
                                    }
                                    className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                                  >
                                    Удалить запись
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  {ledgerRows.slice(1).map((ledgerRow) => (
                    <tr
                      key={`${policy.id}-${ledgerRow.payment.id}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-3 py-2 border border-slate-300 align-top">
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
                              <button
                                type="button"
                                onClick={() => openMarkPaidPrompt(ledgerRow.payment)}
                                className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                              >
                                Проставить оплату
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                onDeletePayment(ledgerRow.payment.id).catch(() => undefined)
                              }
                              className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                              disabled={ledgerRow.payment.canDelete === false}
                              title={
                                ledgerRow.payment.canDelete === false
                                  ? 'Сначала удалите оплаченные финансовые записи'
                                  : 'Удалить платёж'
                              }
                            >
                              Удалить платёж
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 border border-slate-300 align-top">
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
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openMarkRecordPaidPrompt(recordRow.record.id)
                                        }
                                        className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                                      >
                                        Проставить оплату
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onDeleteFinancialRecord(recordRow.record.id).catch(
                                          () => undefined,
                                        )
                                      }
                                      className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                                    >
                                      Удалить запись
                                    </button>
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
    </section>
  );
};
