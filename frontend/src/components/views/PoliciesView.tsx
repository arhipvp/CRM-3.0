import React, { useEffect, useMemo, useState } from 'react';
import { Client, Payment, Policy } from '../../types';
import { fetchPoliciesKPI, FilterParams } from '../../api';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { FilterBar } from '../FilterBar';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  TABLE_CELL_CLASS_COMPACT,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { buildPolicyCardModel } from '../policies/policyCardModel';
import { POLICY_TEXT } from '../policies/text';
import { getPolicyComputedStatusBadge, getPolicyExpiryBadge } from '../policies/policyIndicators';
import {
  buildPolicyLedgerRows,
  getPolicyExpiryToneClass,
  getPolicyNotePreview,
  POLICY_LEDGER_STATE_CLASS,
  POLICY_STATUS_TONE_CLASS,
} from '../policies/policyTableHelpers';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PolicyNumberButton } from '../policies/PolicyNumberButton';
import { DataTableShell } from '../common/table/DataTableShell';
import { BTN_SM_QUIET } from '../common/buttonStyles';

const POLICIES_PRESETS_STORAGE_KEY = 'crm.policies.filterPresets.v1';
const POLICY_STATUS_OPTIONS = [
  { value: 'problem', label: 'Есть неоплаченные записи' },
  { value: 'due', label: 'К оплате' },
  { value: 'expired', label: 'Просроченные' },
  { value: 'active', label: 'Активные' },
];

type PolicyFilterPreset = {
  id: string;
  name: string;
  filters: FilterParams;
  createdAt: string;
  updatedAt: string;
};

const POLICY_SORT_OPTIONS = [
  { value: '-start_date', label: 'Начало (убывание)' },
  { value: 'start_date', label: 'Начало (возрастание)' },
  { value: '-end_date', label: 'Окончание (убывание)' },
  { value: 'end_date', label: 'Окончание (возрастание)' },
  { value: '-number', label: 'Номер (Z -> A)' },
  { value: 'number', label: 'Номер (A -> Z)' },
  { value: '-client', label: 'Клиент (Z -> A)' },
  { value: 'client', label: 'Клиент (A -> Z)' },
];

interface PoliciesViewProps {
  policies: Policy[];
  payments: Payment[];
  clients?: Client[];
  onDealSelect?: (dealId: string) => void;
  onDealPreview?: (dealId: string) => void;
  onClientEdit?: (client: Client) => void;
  onRequestEditPolicy?: (policy: Policy) => void;
  onLoadMorePolicies?: () => Promise<void>;
  policiesHasMore?: boolean;
  isLoadingMorePolicies?: boolean;
  isPoliciesLoading?: boolean;
  onRefreshPoliciesList?: (filters?: FilterParams) => Promise<void>;
  onAddFinancialRecord?: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord?: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteFinancialRecord?: (recordId: string) => Promise<void>;
  onDeletePayment?: (paymentId: string) => Promise<void>;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  policies,
  payments,
  onLoadMorePolicies,
  policiesHasMore = false,
  isLoadingMorePolicies = false,
  isPoliciesLoading = false,
  onRefreshPoliciesList,
  onRequestEditPolicy,
}) => {
  const [filters, setFilters] = useState<FilterParams>({ ordering: '-start_date' });
  const [filterBarVersion, setFilterBarVersion] = useState(0);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<PolicyFilterPreset[]>([]);
  const [kpi, setKpi] = useState({
    total: 0,
    problemCount: 0,
    dueCount: 0,
    expiringSoonCount: 0,
    expiringDays: 30,
  });

  const rawSearch = (filters.search ?? '').trim();
  const debouncedSearch = useDebouncedValue(rawSearch, 450);
  const isDebouncePending = Boolean(onRefreshPoliciesList) && rawSearch !== debouncedSearch;
  const showUnpaidPaymentsOnly = filters.unpaid_payments === 'true';
  const showUnpaidRecordsOnly = filters.unpaid_records === 'true';
  const computedStatus = (filters.computed_status as string | undefined)?.trim();
  const salesChannelFilter = (filters.sales_channel as string | undefined)?.trim();
  const startDateFrom = (filters.start_date_from as string | undefined)?.trim();
  const startDateTo = (filters.start_date_to as string | undefined)?.trim();
  const endDateFrom = (filters.end_date_from as string | undefined)?.trim();
  const endDateTo = (filters.end_date_to as string | undefined)?.trim();

  const serverFilters = useMemo(
    () => ({
      ordering: filters.ordering,
      search: debouncedSearch || undefined,
      unpaid_payments: showUnpaidPaymentsOnly || undefined,
      unpaid_records: showUnpaidRecordsOnly || undefined,
      computed_status: computedStatus || undefined,
      sales_channel: salesChannelFilter || undefined,
      start_date_from: startDateFrom || undefined,
      start_date_to: startDateTo || undefined,
      end_date_from: endDateFrom || undefined,
      end_date_to: endDateTo || undefined,
    }),
    [
      computedStatus,
      debouncedSearch,
      endDateFrom,
      endDateTo,
      filters.ordering,
      salesChannelFilter,
      showUnpaidPaymentsOnly,
      showUnpaidRecordsOnly,
      startDateFrom,
      startDateTo,
    ],
  );

  const paymentsByPolicyMap = useMemo(() => {
    const map = new Map<string, Payment[]>();
    payments.forEach((payment) => {
      const policyId = payment.policyId;
      if (!policyId) {
        return;
      }
      const current = map.get(policyId) ?? [];
      current.push(payment);
      map.set(policyId, current);
    });
    return map;
  }, [payments]);

  useEffect(() => {
    if (!onRefreshPoliciesList) {
      return;
    }
    void onRefreshPoliciesList(serverFilters);
  }, [onRefreshPoliciesList, serverFilters]);

  useEffect(() => {
    let isMounted = true;
    fetchPoliciesKPI(serverFilters)
      .then((payload) => {
        if (isMounted) {
          setKpi(payload);
        }
      })
      .catch(() => {
        if (isMounted) {
          setKpi((prev) => ({ ...prev, total: policies.length }));
        }
      });
    return () => {
      isMounted = false;
    };
  }, [policies.length, serverFilters]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POLICIES_PRESETS_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as PolicyFilterPreset[];
      if (Array.isArray(parsed)) {
        setPresets(parsed);
      }
    } catch {
      setPresets([]);
    }
  }, []);

  const persistPresets = (next: PolicyFilterPreset[]) => {
    setPresets(next);
    localStorage.setItem(POLICIES_PRESETS_STORAGE_KEY, JSON.stringify(next));
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      return;
    }
    const now = new Date().toISOString();
    const nextPreset: PolicyFilterPreset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      filters: { ...filters },
      createdAt: now,
      updatedAt: now,
    };
    persistPresets([nextPreset, ...presets]);
    setPresetName('');
  };

  const handleApplyPreset = (preset: PolicyFilterPreset) => {
    setFilters({ ...preset.filters });
    setFilterBarVersion((prev) => prev + 1);
  };

  const handleDeletePreset = (presetId: string) => {
    persistPresets(presets.filter((preset) => preset.id !== presetId));
  };

  const customFilters = [
    {
      key: 'unpaid_payments',
      label: POLICY_TEXT.filters.unpaidPaymentsOnly,
      type: 'checkbox' as const,
    },
    {
      key: 'unpaid_records',
      label: POLICY_TEXT.filters.unpaidRecordsOnly,
      type: 'checkbox' as const,
    },
    {
      key: 'computed_status',
      label: 'Вычисляемый статус',
      type: 'select' as const,
      options: POLICY_STATUS_OPTIONS,
    },
    {
      key: 'sales_channel',
      label: 'Канал продаж',
      type: 'text' as const,
    },
    {
      key: 'start_date_from',
      label: 'Начало с (YYYY-MM-DD)',
      type: 'text' as const,
    },
    {
      key: 'start_date_to',
      label: 'Начало по (YYYY-MM-DD)',
      type: 'text' as const,
    },
    {
      key: 'end_date_from',
      label: 'Окончание с (YYYY-MM-DD)',
      type: 'text' as const,
    },
    {
      key: 'end_date_to',
      label: 'Окончание по (YYYY-MM-DD)',
      type: 'text' as const,
    },
  ];

  return (
    <section aria-labelledby="policiesViewHeading" className="app-panel p-3 shadow-none space-y-2">
      <h1 id="policiesViewHeading" className="sr-only">
        Полисы
      </h1>
      <div className="flex flex-col gap-2">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Всего</p>
            <p className="text-lg font-semibold text-slate-900">{kpi.total}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-rose-600">
              Есть неоплаченные записи
            </p>
            <p className="text-lg font-semibold text-rose-700">{kpi.problemCount}</p>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-orange-700">К оплате</p>
            <p className="text-lg font-semibold text-orange-700">{kpi.dueCount}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sky-700">
              Скоро истекают ({kpi.expiringDays} дн.)
            </p>
            <p className="text-lg font-semibold text-sky-700">{kpi.expiringSoonCount}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          <p className="app-label mb-2">Пресеты фильтров</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="field field-input h-8 w-56 text-xs"
              placeholder="Название пресета"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
            />
            <button type="button" className={BTN_SM_QUIET} onClick={handleSavePreset}>
              Сохранить текущий
            </button>
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
              >
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                  onClick={() => handleApplyPreset(preset)}
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                  onClick={() => handleDeletePreset(preset.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <FilterBar
          key={`policies-filterbar-${filterBarVersion}`}
          onFilterChange={setFilters}
          searchPlaceholder="Поиск по номеру, клиенту или компании..."
          initialFilters={filters}
          sortOptions={POLICY_SORT_OPTIONS}
          customFilters={customFilters}
          density="compact"
          layout="inline-wrap"
        />
        {isDebouncePending && <div className="text-xs text-slate-500">Применяю фильтр...</div>}
      </div>

      {policies.length ? (
        <DataTableShell>
          <table
            className="deals-table min-w-[1900px] w-full table-fixed border-collapse text-left text-sm"
            aria-label="Список полисов"
          >
            <thead className={TABLE_THEAD_CLASS}>
              <tr>
                <TableHeadCell padding="sm" className="w-[14%]">
                  Номер полиса
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[26%]">
                  Основные данные
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[8%]">
                  Начало
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[8%]">
                  Конец
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[18%]">
                  Платеж
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[26%]">
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
                const notePreview = getPolicyNotePreview(policy.note);
                const rowSpan = Math.max(ledgerRows.length, 1);
                const firstLedgerRow = ledgerRows[0];

                return (
                  <React.Fragment key={policy.id}>
                    <tr className={`${TABLE_ROW_CLASS} border-t border-slate-300`}>
                      <td rowSpan={rowSpan} className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                        <PolicyNumberButton
                          value={model.number}
                          className="text-xl font-bold leading-tight text-slate-900"
                        />
                      </td>
                      <td rowSpan={rowSpan} className={`${TABLE_CELL_CLASS_COMPACT} align-top`}>
                        <div className="space-y-1.5">
                          <p className="text-sm font-semibold text-slate-900">{model.client}</p>
                          <p className="text-sm text-slate-800">{model.insuranceCompany}</p>
                          <p className="text-sm text-slate-800">{model.insuranceType}</p>
                          <p className="text-sm text-slate-700">{model.salesChannel}</p>
                          <p
                            className="text-xs text-slate-600 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
                            title={notePreview.fullText}
                          >
                            {notePreview.preview}
                          </p>
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
                          </div>
                          <p className="text-sm font-semibold text-slate-900">{model.sum}</p>
                          {onRequestEditPolicy && (
                            <button
                              type="button"
                              onClick={() => onRequestEditPolicy(policy)}
                              className={`${BTN_SM_QUIET} h-7 px-2 text-[11px]`}
                              aria-label={`Редактировать полис ${model.number}`}
                            >
                              Редактировать
                            </button>
                          )}
                        </div>
                      </td>
                      <td
                        rowSpan={rowSpan}
                        className={`${TABLE_CELL_CLASS_COMPACT} align-top text-xs font-semibold text-slate-700`}
                      >
                        {model.startDate}
                      </td>
                      <td
                        rowSpan={rowSpan}
                        className={`${TABLE_CELL_CLASS_COMPACT} align-top text-xs font-semibold text-slate-700`}
                      >
                        {model.endDate}
                      </td>
                      <td className={TABLE_CELL_CLASS_COMPACT}>
                        {firstLedgerRow ? (
                          <div
                            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] ${POLICY_LEDGER_STATE_CLASS[firstLedgerRow.state]}`}
                            title={firstLedgerRow.line.text}
                          >
                            <span className="truncate">{firstLedgerRow.line.dateText}</span>
                            <span className="font-semibold whitespace-nowrap">
                              {firstLedgerRow.line.amountText}
                            </span>
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
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    {ledgerRows.slice(1).map((ledgerRow) => (
                      <tr key={ledgerRow.payment.id} className={TABLE_ROW_CLASS}>
                        <td className={TABLE_CELL_CLASS_COMPACT}>
                          <div
                            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] ${POLICY_LEDGER_STATE_CLASS[ledgerRow.state]}`}
                            title={ledgerRow.line.text}
                          >
                            <span className="truncate">{ledgerRow.line.dateText}</span>
                            <span className="font-semibold whitespace-nowrap">
                              {ledgerRow.line.amountText}
                            </span>
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
                                </div>
                              ))}
                            </div>
                          ) : null}
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
        <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
          {isPoliciesLoading ? 'Загрузка полисов...' : 'Нет полисов для отображения'}
        </div>
      )}

      {policiesHasMore && onLoadMorePolicies && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center">
          <button
            type="button"
            onClick={() => {
              void onLoadMorePolicies();
            }}
            disabled={isLoadingMorePolicies}
            className={BTN_SM_QUIET}
          >
            {isLoadingMorePolicies ? 'Загрузка...' : 'Показать ещё'}
          </button>
        </div>
      )}
    </section>
  );
};
