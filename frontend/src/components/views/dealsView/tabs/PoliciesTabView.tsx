import { Fragment } from 'react';
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
import { InsuranceCompanyLogo } from '../../../common/InsuranceCompanyLogo';
import { PolicyMoveDialog } from '../../../policies/PolicyMoveDialog';
import {
  PolicyDataField,
  PolicyEmptyLedger,
  PolicyTermCard,
} from '../../../policies/PolicyTableCards';
import { getPolicyDocumentsState } from '../../policies/usePolicyDocuments';
import { PolicyDocumentsList } from '../../policies/PolicyDocumentsList';
import { POLICY_ACTION_CLASS, type usePoliciesTabController } from './usePoliciesTabController';
import { PoliciesTabState } from './PoliciesTabState';

type PoliciesTabViewModel = ReturnType<typeof usePoliciesTabController>;

export function PoliciesTabView(viewModel: PoliciesTabViewModel) {
  if (viewModel.kind !== 'ready') return <PoliciesTabState viewModel={viewModel} />;
  const {
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
  } = viewModel;
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
          icon="plus"
        >
          Создать полис
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
            className="w-full min-w-[1180px] table-fixed border-collapse text-left text-sm xl:min-w-0"
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
                <th className="w-[34%] border border-slate-200 px-3 py-2">Основные данные</th>
                <th className="w-[14%] border border-slate-200 px-3 py-2">Срок действия</th>
                <th className="w-[18%] border border-slate-200 px-3 py-2">Платёж</th>
                <th className="w-[20%] border border-slate-200 px-3 py-2">Финансовые записи</th>
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
                          <div className="grid grid-cols-2 gap-1.5">
                            <PolicyDataField label="Страхователь">
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
                            </PolicyDataField>
                            <PolicyDataField label="Сделка">
                              {policy.dealId ? (
                                <div
                                  className="flex min-w-0 items-baseline gap-2"
                                  data-testid={`policy-deal-${policy.id}`}
                                >
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
                            </PolicyDataField>
                            <PolicyDataField label="Страховая компания">
                              <div
                                className="flex flex-wrap items-center gap-1.5"
                                title={metaTitle}
                                data-testid={`policy-meta-${policy.id}`}
                              >
                                {insuranceCompany ? (
                                  <>
                                    <InsuranceCompanyLogo
                                      companyName={insuranceCompany}
                                      logoUrl={policy.insuranceCompanyLogoUrl}
                                      fallbackClassName="max-w-full truncate text-xs font-semibold text-slate-800"
                                    />
                                    {policy.insuranceCompanyLogoUrl && (
                                      <span className="min-w-0 truncate text-xs font-semibold text-slate-800">
                                        {insuranceCompany}
                                      </span>
                                    )}
                                  </>
                                ) : null}
                                {!hasMeta && (
                                  <span className="text-sm font-normal text-slate-400">
                                    Не указана
                                  </span>
                                )}
                              </div>
                            </PolicyDataField>
                            <PolicyDataField label="Продукт">
                              {insuranceType ? (
                                <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                                  {insuranceType}
                                </span>
                              ) : (
                                <span className="text-sm font-normal text-slate-400">
                                  Не указан
                                </span>
                              )}
                            </PolicyDataField>
                            <PolicyDataField label="Партнёры">
                              {salesChannel ? (
                                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                  {salesChannel}
                                </span>
                              ) : (
                                <span className="text-sm font-normal text-slate-400">
                                  Не указаны
                                </span>
                              )}
                            </PolicyDataField>
                            <PolicyDataField label="Примечание">
                              <p
                                className="overflow-hidden font-normal text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                                title={notePreview.fullText}
                              >
                                {notePreview.preview}
                              </p>
                            </PolicyDataField>
                            <PolicyDataField label="Статус">
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
                            </PolicyDataField>
                            <PolicyDataField label="Оплачено / План">
                              <span className="whitespace-nowrap">{model.sum}</span>
                            </PolicyDataField>
                          </div>

                          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
                            <Button
                              type="button"
                              onClick={() => onRequestEditPolicy(policy)}
                              variant="primary"
                              size="sm"
                              icon="edit"
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
                                icon="arrowRight"
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
                              icon="plus"
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
                              icon="refresh"
                              className={POLICY_ACTION_CLASS}
                            >
                              {policy.isRenewed ? 'Вернуть в активные' : 'Отметить продлённым'}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                              variant="danger"
                              size="sm"
                              icon="delete"
                              className={POLICY_ACTION_CLASS}
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      </td>
                      <td className={`${TABLE_CELL_CLASS_COMPACT} align-top`} rowSpan={rowSpan}>
                        <PolicyTermCard
                          startDate={model.startDate}
                          endDate={model.endDate}
                          endDateValue={policy.endDate}
                        />
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
                        ) : (
                          <PolicyEmptyLedger />
                        )}
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
                          ) : (
                            <PolicyEmptyLedger />
                          )}
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
}
