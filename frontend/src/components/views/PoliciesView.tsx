import React, { useEffect, useMemo, useState } from 'react';
import { Client, Payment, Policy } from '../../types';
import { FilterBar } from '../FilterBar';
import { PanelMessage } from '../PanelMessage';
import { FilterParams } from '../../api';
import {
  getPolicyTransportSummary,
  policyHasUnpaidPayments,
  policyHasUnpaidRecords,
} from './dealsView/helpers';
import { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { ColoredLabel } from '../common/ColoredLabel';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  NESTED_TABLE_CELL_CLASS_COMPACT,
  NESTED_TABLE_CLASS,
  NESTED_TABLE_HEAD_CELL_CLASS_COMPACT,
  NESTED_TABLE_HEAD_CLASS,
  TABLE_CELL_CLASS_COMPACT,
  TABLE_ROW_CLASS,
  TABLE_ROW_CLASS_PLAIN,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { PaymentCard } from '../policies/PaymentCard';
import { PolicySummaryBlocks } from '../policies/PolicySummaryBlocks';
import { buildPolicyCardModel } from '../policies/policyCardModel';
import { POLICY_TEXT } from '../policies/text';
import { getPolicyComputedStatusBadge, getPolicyExpiryBadge } from '../policies/policyIndicators';
import { FinancialRecordModal } from '../financialRecords/FinancialRecordModal';
import { useFinancialRecordModal } from '../../hooks/useFinancialRecordModal';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PolicyNumberButton } from '../policies/PolicyNumberButton';
import { DataTableShell } from '../common/table/DataTableShell';
import { BTN_SM_QUIET } from '../common/buttonStyles';
import { fetchPoliciesKPI } from '../../api';

const POLICIES_PRESETS_STORAGE_KEY = 'crm.policies.filterPresets.v1';
const POLICY_STATUS_OPTIONS = [
  { value: 'problem', label: 'Проблемные' },
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
  { value: '-number', label: 'Номер (Z → A)' },
  { value: 'number', label: 'Номер (A → Z)' },
  { value: '-client', label: 'Клиент (Z → A)' },
  { value: 'client', label: 'Клиент (A → Z)' },
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
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
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
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
  onDeletePayment,
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

  const allFinancialRecords = useMemo(
    () => payments.flatMap((payment) => payment.financialRecords ?? []),
    [payments],
  );
  const unpaidPaymentsPolicies = useMemo(() => {
    const set = new Set<string>();
    policies.forEach((policy) => {
      if (policyHasUnpaidPayments(policy.id, paymentsByPolicyMap)) {
        set.add(policy.id);
      }
    });
    return set;
  }, [paymentsByPolicyMap, policies]);
  const unpaidRecordsPolicies = useMemo(() => {
    const set = new Set<string>();
    policies.forEach((policy) => {
      if (policyHasUnpaidRecords(policy.id, paymentsByPolicyMap, allFinancialRecords)) {
        set.add(policy.id);
      }
    });
    return set;
  }, [allFinancialRecords, paymentsByPolicyMap, policies]);

  const filteredPolicies = useMemo(() => {
    let result = [...policies];

    const shouldFilterUnpaid = showUnpaidPaymentsOnly || showUnpaidRecordsOnly;
    if (shouldFilterUnpaid) {
      result = result.filter((policy) => {
        const hasUnpaidPayments = unpaidPaymentsPolicies.has(policy.id);
        const hasUnpaidRecords = unpaidRecordsPolicies.has(policy.id);
        return (
          (showUnpaidPaymentsOnly && hasUnpaidPayments) ||
          (showUnpaidRecordsOnly && hasUnpaidRecords)
        );
      });
    }

    return result;
  }, [
    policies,
    showUnpaidPaymentsOnly,
    showUnpaidRecordsOnly,
    unpaidPaymentsPolicies,
    unpaidRecordsPolicies,
  ]);

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
          setKpi((prev) => ({ ...prev, total: filteredPolicies.length }));
        }
      });
    return () => {
      isMounted = false;
    };
  }, [filteredPolicies.length, serverFilters]);

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

  const paymentsByPolicy = useMemo(
    () =>
      filteredPolicies.map((policy) => ({
        policy,
        payments: paymentsByPolicyMap.get(policy.id) ?? [],
      })),
    [filteredPolicies, paymentsByPolicyMap],
  );

  const {
    isOpen: isFinancialRecordModalOpen,
    paymentId: financialRecordPaymentId,
    defaultRecordType: financialRecordDefaultRecordType,
    editingFinancialRecord,
    editingFinancialRecordId,
    openCreateFinancialRecord,
    openEditFinancialRecord,
    closeFinancialRecordModal,
  } = useFinancialRecordModal(allFinancialRecords);

  return (
    <section aria-labelledby="policiesViewHeading" className="app-panel p-4 shadow-none space-y-3">
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
            <p className="text-[11px] uppercase tracking-[0.2em] text-rose-600">Проблемные</p>
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
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="app-label mb-2">Пресеты фильтров</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="field field-input h-9 w-64 text-xs"
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

      {filteredPolicies.length ? (
        <DataTableShell>
          <table
            className="deals-table w-full table-fixed border-collapse text-left text-sm"
            aria-label="Список полисов"
          >
            <thead className={TABLE_THEAD_CLASS}>
              <tr>
                <TableHeadCell padding="sm" className="w-[16%]">
                  Полис
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[8%]">
                  Начало
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[8%]">
                  Окончание
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[15%]">
                  Клиент
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[17%]">
                  Компания
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[16%]">
                  Тип / ТС
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[11%]">
                  Канал
                </TableHeadCell>
                <TableHeadCell padding="sm" align="right" className="w-[9%]">
                  Сумма
                </TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white">
              {paymentsByPolicy.map(({ policy, payments }) => {
                const paymentsPanelId = `policy-${policy.id}-payments`;
                const model = buildPolicyCardModel(policy, payments);
                const hasUnpaidPayments = unpaidPaymentsPolicies.has(policy.id);
                const hasUnpaidRecords = unpaidRecordsPolicies.has(policy.id);
                const expiryBadge = getPolicyExpiryBadge(policy.endDate);
                const computedStatusBadge = getPolicyComputedStatusBadge(policy.computedStatus);
                const transportSummary = policy.isVehicle ? getPolicyTransportSummary(policy) : '';

                return (
                  <React.Fragment key={policy.id}>
                    <tr className={`${TABLE_ROW_CLASS} border-t border-slate-300`}>
                      <td className={TABLE_CELL_CLASS_COMPACT}>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <PolicyNumberButton
                              value={model.number}
                              className="text-sm font-semibold text-slate-900 underline underline-offset-2 decoration-dotted decoration-slate-300 transition hover:decoration-slate-500"
                            />
                            {computedStatusBadge && (
                              <span
                                className={[
                                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                                  computedStatusBadge.tone === 'red'
                                    ? 'bg-red-100 text-red-700'
                                    : computedStatusBadge.tone === 'orange'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-emerald-100 text-emerald-700',
                                ].join(' ')}
                              >
                                {computedStatusBadge.label}
                              </span>
                            )}
                            {hasUnpaidPayments && (
                              <span
                                className={[
                                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                                  expiryBadge?.tone === 'red'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-orange-100 text-orange-700',
                                ].join(' ')}
                              >
                                {POLICY_TEXT.badges.unpaidPayments}
                              </span>
                            )}
                            {hasUnpaidRecords && (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                {POLICY_TEXT.badges.unpaidRecords}
                              </span>
                            )}
                            {expiryBadge && (
                              <span
                                className={[
                                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                                  expiryBadge.tone === 'red'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-orange-100 text-orange-700',
                                ].join(' ')}
                              >
                                {expiryBadge.label}
                              </span>
                            )}
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
                        </div>
                      </td>
                      <td
                        className={`${TABLE_CELL_CLASS_COMPACT} text-xs font-semibold text-slate-700`}
                      >
                        {model.startDate}
                      </td>
                      <td
                        className={`${TABLE_CELL_CLASS_COMPACT} text-xs font-semibold text-slate-700`}
                      >
                        {model.endDate}
                      </td>
                      <td className={TABLE_CELL_CLASS_COMPACT}>
                        <p className="text-sm font-semibold text-slate-900 break-words">
                          {model.client}
                        </p>
                      </td>
                      <td className={TABLE_CELL_CLASS_COMPACT}>
                        <div className="min-w-0">
                          <ColoredLabel
                            value={policy.insuranceCompany}
                            showDot
                            className="max-w-full truncate font-semibold text-slate-900"
                          />
                        </div>
                      </td>
                      <td className={TABLE_CELL_CLASS_COMPACT}>
                        <p className="text-sm font-semibold text-slate-900 break-words">
                          {model.insuranceType}
                        </p>
                        {transportSummary && (
                          <p className="mt-1 text-xs text-slate-500">{transportSummary}</p>
                        )}
                      </td>
                      <td className={`${TABLE_CELL_CLASS_COMPACT} text-slate-700 break-words`}>
                        {model.salesChannel}
                      </td>
                      <td className={`${TABLE_CELL_CLASS_COMPACT} text-right`}>
                        <p className="text-sm font-semibold text-slate-900">{model.sum}</p>
                      </td>
                    </tr>
                    <tr className={`${TABLE_ROW_CLASS_PLAIN} border-t border-slate-200`}>
                      <td
                        colSpan={8}
                        className="border border-slate-200 border-b border-slate-300 bg-slate-50/70 px-2 py-2"
                      >
                        <div
                          id={paymentsPanelId}
                          className="rounded-lg border border-slate-200 bg-white"
                        >
                          <div className="border-b border-slate-200 p-3">
                            <PolicySummaryBlocks policy={policy} model={model} />
                          </div>
                          {payments.length ? (
                            <table
                              className={NESTED_TABLE_CLASS}
                              aria-label={`Платежи полиса ${model.number}`}
                            >
                              <thead className={NESTED_TABLE_HEAD_CLASS}>
                                <tr>
                                  <th className={`${NESTED_TABLE_HEAD_CELL_CLASS_COMPACT} w-[12%]`}>
                                    {POLICY_TEXT.paymentTable.amount}
                                  </th>
                                  <th className={`${NESTED_TABLE_HEAD_CELL_CLASS_COMPACT} w-[24%]`}>
                                    {POLICY_TEXT.paymentTable.description}
                                  </th>
                                  <th className={`${NESTED_TABLE_HEAD_CELL_CLASS_COMPACT} w-[11%]`}>
                                    {POLICY_TEXT.paymentTable.scheduledAt}
                                  </th>
                                  <th className={`${NESTED_TABLE_HEAD_CELL_CLASS_COMPACT} w-[11%]`}>
                                    {POLICY_TEXT.paymentTable.actualAt}
                                  </th>
                                  <th className={`${NESTED_TABLE_HEAD_CELL_CLASS_COMPACT} w-[21%]`}>
                                    {POLICY_TEXT.paymentTable.incomes}
                                  </th>
                                  <th className={`${NESTED_TABLE_HEAD_CELL_CLASS_COMPACT} w-[21%]`}>
                                    {POLICY_TEXT.paymentTable.expenses}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {payments.map((payment) => (
                                  <PaymentCard
                                    key={payment.id}
                                    payment={payment}
                                    onRequestAddRecord={openCreateFinancialRecord}
                                    onEditFinancialRecord={openEditFinancialRecord}
                                    onDeleteFinancialRecord={onDeleteFinancialRecord}
                                    onDeletePayment={onDeletePayment}
                                    variant="table-row"
                                    hideRowActions
                                  />
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className={`${NESTED_TABLE_CELL_CLASS_COMPACT} border-0`}>
                              <PanelMessage>{POLICY_TEXT.messages.noPayments}</PanelMessage>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
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

      {isFinancialRecordModalOpen && (
        <FinancialRecordModal
          isOpen
          title={editingFinancialRecordId ? 'Изменить запись' : 'Добавить запись'}
          onClose={closeFinancialRecordModal}
          paymentId={financialRecordPaymentId}
          defaultRecordType={financialRecordDefaultRecordType}
          record={editingFinancialRecord}
          onSubmit={async (values) => {
            if (editingFinancialRecordId) {
              await onUpdateFinancialRecord(editingFinancialRecordId, values);
            } else {
              await onAddFinancialRecord(values);
            }
            closeFinancialRecordModal();
          }}
        />
      )}
    </section>
  );
};
