import React from 'react';

import type { Client, ClientDuplicateHint, Payment, Policy } from '../../../types';
import { buildPolicyCardModel } from '../../policies/policyCardModel';
import { POLICY_TEXT } from '../../policies/text';
import {
  getPolicyComputedStatusBadge,
  getPolicyExpiryBadge,
  getPolicyRenewalBadge,
} from '../../policies/policyIndicators';
import {
  buildPolicyLedgerRows,
  getPolicyExpiryToneClass,
  getPolicyNotePreview,
  POLICY_LEDGER_STATE_CLASS,
  POLICY_STATUS_TONE_CLASS,
} from '../../policies/policyTableHelpers';
import { PolicyNumberButton } from '../../policies/PolicyNumberButton';
import {
  PolicyDataField,
  PolicyEmptyLedger,
  PolicyTermCard,
} from '../../policies/PolicyTableCards';
import { InsuranceCompanyLogo } from '../../common/InsuranceCompanyLogo';
import { ClientNameIndicators } from '../../clients/ClientNameIndicators';
import { Button } from '../../common/Button';
import { DataTableShell } from '../../common/table/DataTableShell';
import { TableHeadCell } from '../../common/TableHeadCell';
import {
  TABLE_CELL_CLASS_COMPACT,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../../common/tableStyles';
import { getPolicyDocumentsState, type PolicyDocumentsState } from './usePolicyDocuments';
import { PolicyDocumentsList } from './PolicyDocumentsList';

interface PoliciesTableProps {
  policies: Policy[];
  paymentsByPolicyMap: Map<string, Payment[]>;
  clientsById: Map<string, Client>;
  clientDuplicateHints: Record<string, ClientDuplicateHint>;
  documentsByPolicyId: Record<string, PolicyDocumentsState>;
  openingClientId: string | null;
  isPoliciesLoading: boolean;
  onClientOpenById?: (clientId: string) => Promise<void>;
  onClientFindSimilar?: (client: Client) => void;
  onClientNormalizeName?: (client: Client, normalizedName: string) => Promise<void>;
  onDealSelect?: (dealId: string) => void;
  onDealPreview?: (dealId: string) => void;
  onOpenDeal: (dealId: string) => void;
  onLoadPolicyDocuments: (policy: Policy) => Promise<void>;
  onSetOpeningClientId: React.Dispatch<React.SetStateAction<string | null>>;
  onRequestEditPolicy?: (policy: Policy) => void;
  onRequestMovePolicy?: (policy: Policy) => void;
  onMarkPaymentPaid?: (payment: Payment) => void;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  onMarkFinancialRecordPaid?: (recordId: string) => void;
  onDeleteFinancialRecord?: (recordId: string) => Promise<void>;
  onRefreshPolicies: () => void;
}

export const PoliciesTable = ({
  policies,
  paymentsByPolicyMap,
  clientsById,
  clientDuplicateHints,
  documentsByPolicyId,
  openingClientId,
  isPoliciesLoading,
  onClientOpenById,
  onClientFindSimilar,
  onClientNormalizeName,
  onDealSelect,
  onDealPreview,
  onOpenDeal: handleOpenDeal,
  onLoadPolicyDocuments: loadPolicyDocuments,
  onSetOpeningClientId: setOpeningClientId,
  onRequestEditPolicy,
  onRequestMovePolicy: setPolicyToMove,
  onMarkPaymentPaid: openMarkPaidPrompt,
  onDeletePayment,
  onMarkFinancialRecordPaid: openMarkRecordPaidPrompt,
  onDeleteFinancialRecord,
  onRefreshPolicies: handleRefreshPolicies,
}: PoliciesTableProps) => (
  <>
    {policies.length ? (
      <DataTableShell>
        <table
          className="deals-table w-full min-w-[1180px] table-fixed border-collapse text-left text-sm xl:min-w-0"
          aria-label="Список полисов"
        >
          <thead className={TABLE_THEAD_CLASS}>
            <tr>
              <TableHeadCell padding="sm" className="w-[13%]">
                Номер полиса
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[34%]">
                Основные данные
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[14%]">
                Срок действия
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[18%]">
                Платеж
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[21%]">
                Финансовые записи
              </TableHeadCell>
            </tr>
          </thead>
          <tbody className="bg-white">
            {policies.map((policy) => {
              const paymentsForPolicy = paymentsByPolicyMap.get(policy.id) ?? [];
              const ledgerRows = buildPolicyLedgerRows(
                policy,
                paymentsForPolicy,
                POLICY_TEXT.messages.noComment,
              );
              const model = buildPolicyCardModel(policy, paymentsForPolicy);
              const computedStatusBadge = getPolicyComputedStatusBadge(policy.computedStatus);
              const expiryBadge = getPolicyExpiryBadge(policy.endDate);
              const renewalBadge = getPolicyRenewalBadge({
                isRenewed: policy.isRenewed,
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
              const dealTitle = (policy.dealTitle ?? '').trim() || 'Сделка';
              const canOpenDeal = Boolean(policy.dealId && (onDealPreview || onDealSelect));
              const policyClient = policy.clientId ? clientsById.get(policy.clientId) : null;
              const policyDocuments = getPolicyDocumentsState(policy, documentsByPolicyId);

              return (
                <React.Fragment key={policy.id}>
                  <tr className={`${TABLE_ROW_CLASS} border-t border-slate-300`}>
                    <td rowSpan={rowSpan} className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                      <PolicyNumberButton
                        value={model.number}
                        className="text-xl font-bold leading-tight text-slate-900"
                      />
                      <PolicyDocumentsList
                        state={policyDocuments}
                        onLoad={() => void loadPolicyDocuments(policy)}
                      />
                    </td>
                    <td rowSpan={rowSpan} className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                      <div className="space-y-3">
                        <div
                          className="grid grid-cols-2 gap-1.5"
                          data-testid={`policy-primary-data-${policy.id}`}
                        >
                          <PolicyDataField label="Страхователь">
                            <div className="inline-flex min-w-0 items-center gap-2">
                              <ClientNameIndicators
                                client={policyClient}
                                hint={
                                  policyClient ? clientDuplicateHints[policyClient.id] : undefined
                                }
                                onFindSimilar={onClientFindSimilar}
                                onNormalizeName={onClientNormalizeName}
                              />
                              {model.clientId && onClientOpenById ? (
                                <Button
                                  type="button"
                                  className="underline decoration-dotted underline-offset-2 hover:text-sky-700 disabled:cursor-wait"
                                  disabled={openingClientId === model.clientId}
                                  onClick={() => {
                                    setOpeningClientId(model.clientId);
                                    void onClientOpenById(model.clientId!)
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
                                <span>{model.client}</span>
                              )}
                            </div>
                          </PolicyDataField>
                          <PolicyDataField label="Сделка">
                            {policy.dealId ? (
                              canOpenDeal ? (
                                <Button
                                  type="button"
                                  onClick={() => handleOpenDeal(policy.dealId)}
                                  className="text-xs font-semibold text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900"
                                >
                                  {dealTitle}
                                </Button>
                              ) : (
                                <p className="text-xs font-semibold text-slate-600">{dealTitle}</p>
                              )
                            ) : (
                              <span className="font-normal text-slate-400">Не указана</span>
                            )}
                          </PolicyDataField>
                          <PolicyDataField label="Страховая компания">
                            {insuranceCompany ? (
                              <InsuranceCompanyLogo
                                companyName={insuranceCompany}
                                logoUrl={policy.insuranceCompanyLogoUrl}
                                fallbackClassName="text-sm"
                              />
                            ) : (
                              <span className="font-normal text-slate-400">Не указана</span>
                            )}
                          </PolicyDataField>
                          <PolicyDataField label="Продукт">
                            {insuranceType ? (
                              <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                                {insuranceType}
                              </span>
                            ) : (
                              <span className="font-normal text-slate-400">Не указан</span>
                            )}
                          </PolicyDataField>
                          <PolicyDataField label="Партнёры">
                            {salesChannel ? (
                              <span
                                className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
                                title={metaTitle}
                              >
                                {salesChannel}
                              </span>
                            ) : (
                              <span className="font-normal text-slate-400">Не указаны</span>
                            )}
                          </PolicyDataField>
                          <PolicyDataField label="Примечание">
                            <p
                              className="overflow-hidden font-normal text-slate-600 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
                              title={notePreview.fullText}
                            >
                              {notePreview.preview}
                            </p>
                          </PolicyDataField>
                          <PolicyDataField label="Статус">
                            <div className="flex flex-wrap gap-1 pt-1">
                              {computedStatusBadge && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${POLICY_STATUS_TONE_CLASS[computedStatusBadge.tone]}`}
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
                        <div className="flex flex-wrap gap-1">
                          {onRequestEditPolicy && (
                            <Button
                              type="button"
                              onClick={() => onRequestEditPolicy(policy)}
                              variant="quiet"
                              size="sm"
                              icon="edit"
                              className="h-7 px-2 text-[11px]"
                              aria-label={`Редактировать полис ${model.number}`}
                            >
                              Редактировать
                            </Button>
                          )}
                          {setPolicyToMove && (
                            <Button
                              type="button"
                              onClick={() => setPolicyToMove(policy)}
                              variant="quiet"
                              size="sm"
                              icon="arrowRight"
                              className="h-7 px-2 text-[11px]"
                            >
                              Перенести
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td rowSpan={rowSpan} className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                      <PolicyTermCard
                        startDate={model.startDate}
                        endDate={model.endDate}
                        endDateValue={policy.endDate}
                      />
                    </td>
                    <td className={TABLE_CELL_CLASS_COMPACT}>
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
                            {!firstLedgerRow.payment.actualDate && openMarkPaidPrompt && (
                              <Button
                                type="button"
                                onClick={() => openMarkPaidPrompt(firstLedgerRow.payment)}
                                variant="quiet"
                                size="sm"
                                icon="check"
                                className="h-7 px-2 text-[11px]"
                              >
                                Проставить оплату
                              </Button>
                            )}
                            {onDeletePayment && (
                              <Button
                                type="button"
                                onClick={() =>
                                  onDeletePayment(firstLedgerRow.payment.id).catch(() => undefined)
                                }
                                variant="quiet"
                                size="sm"
                                icon="delete"
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
                            )}
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td className={TABLE_CELL_CLASS_COMPACT}>
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
                                  {openMarkRecordPaidPrompt ? (
                                    <Button
                                      type="button"
                                      onClick={() => openMarkRecordPaidPrompt(recordRow.record.id)}
                                      variant="quiet"
                                      size="sm"
                                      className="h-7 px-2 text-[11px]"
                                    >
                                      Проставить оплату
                                    </Button>
                                  ) : null}
                                  {onDeleteFinancialRecord ? (
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
                                  ) : null}
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
                    <tr key={ledgerRow.payment.id} className={TABLE_ROW_CLASS}>
                      <td className={TABLE_CELL_CLASS_COMPACT}>
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
                            {!ledgerRow.payment.actualDate && openMarkPaidPrompt && (
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
                            {onDeletePayment && (
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
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={TABLE_CELL_CLASS_COMPACT}>
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
                                    {openMarkRecordPaidPrompt ? (
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
                                    {onDeleteFinancialRecord ? (
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
                                    ) : null}
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
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    ) : (
      <div className="app-panel-muted px-5 py-8 text-center text-sm text-slate-600">
        <div className="mx-auto max-w-md space-y-3">
          <p className="text-base font-semibold text-slate-900">
            {isPoliciesLoading ? 'Загружаем полисы...' : 'Полисов по текущим условиям нет'}
          </p>
          <p>
            {isPoliciesLoading
              ? 'Список обновляется. Показатели и финансовые данные загружаются независимо.'
              : 'Измените фильтры или обновите список, если данные должны быть доступны.'}
          </p>
          {!isPoliciesLoading && (
            <Button type="button" onClick={handleRefreshPolicies} variant="quiet" size="sm">
              Обновить
            </Button>
          )}
        </div>
      </div>
    )}
  </>
);
