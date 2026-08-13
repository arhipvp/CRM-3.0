import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Client, ClientDuplicateHint, Deal, Payment, PoliciesKPI, Policy } from '../../types';
import { fetchPoliciesKPI, FilterParams } from '../../api';
import { useRef } from 'react';
import { confirmTexts } from '../../constants/confirmTexts';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { FilterBar } from '../FilterBar';
import { PromptDialog } from '../common/modal/PromptDialog';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  TABLE_CELL_CLASS_COMPACT,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { buildPolicyCardModel } from '../policies/policyCardModel';
import { POLICY_TEXT } from '../policies/text';
import {
  getPolicyComputedStatusBadge,
  getPolicyExpiryBadge,
  getPolicyRenewalBadge,
} from '../policies/policyIndicators';
import {
  buildPolicyLedgerRows,
  getPolicyExpiryToneClass,
  getPolicyNotePreview,
  POLICY_LEDGER_STATE_CLASS,
  POLICY_STATUS_TONE_CLASS,
} from '../policies/policyTableHelpers';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useConfirm } from '../../hooks/useConfirm';
import { PolicyNumberButton } from '../policies/PolicyNumberButton';
import { DataTableShell } from '../common/table/DataTableShell';
import { Button } from '../common/Button';
import { ColoredLabel } from '../common/ColoredLabel';
import { ClientNameIndicators } from '../clients/ClientNameIndicators';
import { PolicyMoveDialog } from '../policies/PolicyMoveDialog';
import { getPolicyDocumentsState, usePolicyDocuments } from './policies/usePolicyDocuments';
import { PolicyDocumentsList } from './policies/PolicyDocumentsList';
import { DateInput } from '../common/forms/DateInput';
import { PageHeader } from '../common/layoutPrimitives';

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
  deals?: Deal[];
  payments: Payment[];
  clients?: Client[];
  clientDuplicateHints?: Record<string, ClientDuplicateHint>;
  onDealSelect?: (dealId: string) => void;
  onDealPreview?: (dealId: string) => void;
  onClientEdit?: (client: Client) => void;
  onClientOpenById?: (clientId: string) => Promise<void>;
  onClientFindSimilar?: (client: Client) => void;
  onClientNormalizeName?: (client: Client, normalizedName: string) => Promise<void>;
  onRequestEditPolicy?: (policy: Policy) => void;
  onMovePolicy?: (policyId: string, targetDealId: string) => Promise<void>;
  onLoadMorePolicies?: () => Promise<void>;
  policiesHasMore?: boolean;
  isLoadingMorePolicies?: boolean;
  isPoliciesLoading?: boolean;
  policiesError?: string | null;
  onRefreshPoliciesList?: (filters?: FilterParams) => Promise<PoliciesKPI | undefined>;
  onAddFinancialRecord?: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord?: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteFinancialRecord?: (recordId: string) => Promise<void>;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  onMarkPaymentPaid?: (paymentId: string, actualDate: string) => Promise<void>;
  onMarkFinancialRecordPaid?: (recordId: string, paidDate: string) => Promise<void>;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  policies,
  deals = [],
  payments,
  clients = [],
  clientDuplicateHints = {},
  onDealSelect,
  onDealPreview,
  onClientOpenById,
  onClientFindSimilar,
  onClientNormalizeName,
  onLoadMorePolicies,
  policiesHasMore = false,
  isLoadingMorePolicies = false,
  isPoliciesLoading = false,
  policiesError = null,
  onRefreshPoliciesList,
  onRequestEditPolicy,
  onMovePolicy,
  onDeleteFinancialRecord,
  onDeletePayment,
  onMarkPaymentPaid,
  onMarkFinancialRecordPaid,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = useMemo<FilterParams>(
    () => ({
      ordering: searchParams.get('ordering') || '-start_date',
      search: searchParams.get('search') || undefined,
      computed_status: searchParams.get('computed_status') || undefined,
      sales_channel: searchParams.get('sales_channel') || undefined,
      unpaid_payments: searchParams.get('unpaid_payments') === 'true' || undefined,
      unpaid_records: searchParams.get('unpaid_records') === 'true' || undefined,
      start_date_from: searchParams.get('start_date_from') || undefined,
      start_date_to: searchParams.get('start_date_to') || undefined,
      end_date_from: searchParams.get('end_date_from') || undefined,
      end_date_to: searchParams.get('end_date_to') || undefined,
    }),
    [searchParams],
  );
  const [filters, setFilters] = useState<FilterParams>(urlFilters);
  const [filterBarVersion, setFilterBarVersion] = useState(0);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<PolicyFilterPreset[]>([]);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [paymentToMarkPaid, setPaymentToMarkPaid] = useState<Payment | null>(null);
  const [paymentPaidDate, setPaymentPaidDate] = useState('');
  const [paymentPaidDateError, setPaymentPaidDateError] = useState<string | null>(null);
  const [recordToMarkPaidId, setRecordToMarkPaidId] = useState<string | null>(null);
  const [recordPaidDate, setRecordPaidDate] = useState('');
  const [recordPaidDateError, setRecordPaidDateError] = useState<string | null>(null);
  const [policyToMove, setPolicyToMove] = useState<Policy | null>(null);
  const [isMovingPolicy, setIsMovingPolicy] = useState(false);
  const [kpi, setKpi] = useState({
    total: 0,
    problemCount: 0,
    dueCount: 0,
    expiringSoonCount: 0,
    expiringDays: 30,
  });
  const [localPoliciesError, setLocalPoliciesError] = useState<string | null>(null);
  const [openingClientId, setOpeningClientId] = useState<string | null>(null);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const kpiRequestRef = useRef(0);
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  useEffect(() => {
    setFilters(urlFilters);
    setFilterBarVersion((value) => value + 1);
  }, [urlFilters]);
  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((client) => map.set(client.id, client));
    return map;
  }, [clients]);

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
  const { documentsByPolicyId, loadPolicyDocuments } = usePolicyDocuments();

  useEffect(() => {
    if (!onRefreshPoliciesList) {
      return;
    }
    setLocalPoliciesError(null);
    void onRefreshPoliciesList(serverFilters)
      .then((payload) => {
        if (payload) {
          setKpi(payload);
          setKpiError(null);
          return;
        }
        const requestId = ++kpiRequestRef.current;
        return fetchPoliciesKPI(serverFilters).then((fallbackPayload) => {
          if (requestId === kpiRequestRef.current) {
            setKpi(fallbackPayload);
            setKpiError(null);
          }
        });
      })
      .then((payload) => {
        if (payload) {
          setKpi(payload);
          setKpiError(null);
        }
      })
      .catch((err) => {
        setLocalPoliciesError(err instanceof Error ? err.message : 'Не удалось загрузить полисы');
      });
  }, [onRefreshPoliciesList, serverFilters]);

  useEffect(() => {
    if (onRefreshPoliciesList) {
      return;
    }
    const requestId = ++kpiRequestRef.current;
    const controller = new AbortController();
    fetchPoliciesKPI(serverFilters, { signal: controller.signal })
      .then((payload) => {
        if (requestId === kpiRequestRef.current) {
          setKpi(payload);
          setKpiError(null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && requestId === kpiRequestRef.current) {
          setKpi((prev) => ({ ...prev, total: policies.length }));
          setKpiError('Не удалось обновить показатели полисов.');
        }
      });
    return () => controller.abort();
  }, [onRefreshPoliciesList, policies.length, serverFilters]);

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

  const handleDeletePreset = async (preset: PolicyFilterPreset) => {
    const confirmed = await confirm({
      title: 'Удалить пресет?',
      message: `Пресет «${preset.name}» будет удалён без возможности восстановления.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      tone: 'danger',
    });
    if (!confirmed) return;
    setDeletingPresetId(preset.id);
    persistPresets(presets.filter((item) => item.id !== preset.id));
    setDeletingPresetId(null);
  };

  const updateFilters = (nextFilters: FilterParams) => {
    setFilters(nextFilters);
    const nextParams = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value && !(key === 'ordering' && value === '-start_date')) {
        nextParams.set(key, String(value));
      }
    });
    setSearchParams(nextParams, { replace: true });
  };

  const setQuickEndPeriod = (days: number) => {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    const toIso = (value: Date) => value.toISOString().slice(0, 10);
    updateFilters({ ...filters, end_date_from: toIso(start), end_date_to: toIso(end) });
    setFilterBarVersion((value) => value + 1);
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

  const handleOpenDeal = (dealId: string) => {
    if (onDealPreview) {
      onDealPreview(dealId);
      return;
    }
    onDealSelect?.(dealId);
  };

  const combinedPoliciesError = policiesError ?? localPoliciesError;
  const handleRefreshPolicies = () => {
    setLocalPoliciesError(null);
    void onRefreshPoliciesList?.(serverFilters).catch((err) => {
      setLocalPoliciesError(err instanceof Error ? err.message : 'Не удалось загрузить полисы');
    });
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

  return (
    <section aria-labelledby="policiesViewHeading" className="app-page">
      <PageHeader
        titleId="policiesViewHeading"
        title="Полисы"
        description="Статусы, сроки, платежи и финансовые записи"
      />
      <div className="flex flex-col gap-2">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-white px-3 py-2">
            <p className="app-label">Всего</p>
            <p className="text-lg font-semibold text-slate-900">{kpi.total}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="app-label text-rose-600">Есть неоплаченные записи</p>
            <p className="text-lg font-semibold text-rose-700">{kpi.problemCount}</p>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
            <p className="app-label text-orange-700">К оплате</p>
            <p className="text-lg font-semibold text-orange-700">{kpi.dueCount}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
            <p className="app-label text-sky-700">Скоро истекают ({kpi.expiringDays} дн.)</p>
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
            <Button type="button" variant="quiet" size="sm" onClick={handleSavePreset}>
              Сохранить текущий
            </Button>
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
              >
                <Button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                  onClick={() => handleApplyPreset(preset)}
                >
                  {preset.name}
                </Button>
                <Button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                  onClick={() => void handleDeletePreset(preset)}
                  disabled={deletingPresetId === preset.id}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-2">
          <label className="text-xs text-slate-600">
            Окончание с
            <DateInput
              aria-label="Окончание с"
              className="field field-input mt-1 h-8"
              value={endDateFrom}
              onChange={(event) => updateFilters({ ...filters, end_date_from: event.target.value })}
            />
          </label>
          <label className="text-xs text-slate-600">
            Окончание по
            <DateInput
              aria-label="Окончание по"
              className="field field-input mt-1 h-8"
              value={endDateTo}
              onChange={(event) => updateFilters({ ...filters, end_date_to: event.target.value })}
            />
          </label>
          {[30, 60, 90].map((days) => (
            <Button
              key={days}
              type="button"
              variant="quiet"
              size="sm"
              onClick={() => setQuickEndPeriod(days)}
            >
              {days} дней
            </Button>
          ))}
        </div>
        <FilterBar
          key={`policies-filterbar-${filterBarVersion}`}
          onFilterChange={updateFilters}
          searchPlaceholder="Поиск по номеру, клиенту или компании..."
          initialFilters={filters}
          sortOptions={POLICY_SORT_OPTIONS}
          customFilters={customFilters.filter((filter) => !String(filter.key).includes('date_'))}
          density="compact"
          layout="inline-wrap"
        />
        {isDebouncePending && <div className="text-xs text-slate-500">Применяю фильтр...</div>}
        {kpiError && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
            {kpiError}
          </div>
        )}
        {combinedPoliciesError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{combinedPoliciesError}</span>
              <Button type="button" variant="quiet" size="sm" onClick={handleRefreshPolicies}>
                Повторить
              </Button>
            </div>
          </div>
        )}
      </div>

      {policies.length ? (
        <DataTableShell>
          <table
            className="deals-table w-full min-w-[1100px] table-fixed border-collapse text-left text-sm xl:min-w-0"
            aria-label="Список полисов"
          >
            <thead className={TABLE_THEAD_CLASS}>
              <tr>
                <TableHeadCell padding="sm" className="w-[13%]">
                  Номер полиса
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[25%]">
                  Основные данные
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[8%]">
                  Начало
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[8%]">
                  Конец
                </TableHeadCell>
                <TableHeadCell padding="sm" className="w-[20%]">
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
                const hasMeta = Boolean(metaTitle);
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
                        <div className="space-y-1.5">
                          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
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
                          </p>
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
                          <div className="flex flex-wrap gap-1">
                            {onRequestEditPolicy && (
                              <Button
                                type="button"
                                onClick={() => onRequestEditPolicy(policy)}
                                variant="quiet"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                aria-label={`Редактировать полис ${model.number}`}
                              >
                                Редактировать
                              </Button>
                            )}
                            {onMovePolicy && (
                              <Button
                                type="button"
                                onClick={() => setPolicyToMove(policy)}
                                variant="quiet"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                              >
                                Перенести
                              </Button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td
                        rowSpan={rowSpan}
                        className={`${TABLE_CELL_CLASS_COMPACT} align-top text-xs font-semibold text-slate-700 whitespace-nowrap`}
                      >
                        {model.startDate}
                      </td>
                      <td
                        rowSpan={rowSpan}
                        className={`${TABLE_CELL_CLASS_COMPACT} align-top text-xs font-semibold text-slate-700 whitespace-nowrap`}
                      >
                        {model.endDate}
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
                              {onDeletePayment && (
                                <Button
                                  type="button"
                                  onClick={() =>
                                    onDeletePayment(firstLedgerRow.payment.id).catch(
                                      () => undefined,
                                    )
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
                        ) : null}
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
