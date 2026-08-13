import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Client, Payment, Policy } from '../../types';
import { fetchPoliciesKPI, FilterParams } from '../../api';
import { useRef } from 'react';
import { confirmTexts } from '../../constants/confirmTexts';
import { POLICY_TEXT } from '../policies/text';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useConfirm } from '../../hooks/useConfirm';
import { usePolicyDocuments } from './policies/usePolicyDocuments';
import { PoliciesTable } from './policies/PoliciesTable';
import { PoliciesViewDialogs } from './policies/PoliciesViewDialogs';
import { PageHeader } from '../common/layoutPrimitives';
import { PoliciesFiltersPanel } from './policies/PoliciesFiltersPanel';
import type { PoliciesViewProps, PolicyFilterPreset } from './policies/policiesViewTypes';
export type { PolicyFilterPreset } from './policies/policiesViewTypes';

const POLICIES_PRESETS_STORAGE_KEY = 'crm.policies.filterPresets.v1';
const POLICY_STATUS_OPTIONS = [
  { value: 'problem', label: 'Есть неоплаченные записи' },
  { value: 'due', label: 'К оплате' },
  { value: 'expired', label: 'Просроченные' },
  { value: 'active', label: 'Активные' },
];

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
      <PoliciesFiltersPanel
        kpi={kpi}
        presetName={presetName}
        presets={presets}
        deletingPresetId={deletingPresetId}
        filters={filters}
        endDateFrom={endDateFrom}
        endDateTo={endDateTo}
        filterBarVersion={filterBarVersion}
        customFilters={customFilters}
        isDebouncePending={isDebouncePending}
        kpiError={kpiError}
        combinedPoliciesError={combinedPoliciesError}
        onPresetNameChange={setPresetName}
        onSavePreset={handleSavePreset}
        onApplyPreset={handleApplyPreset}
        onDeletePreset={handleDeletePreset}
        onUpdateFilters={updateFilters}
        onSetQuickEndPeriod={setQuickEndPeriod}
        onRefreshPolicies={handleRefreshPolicies}
      />

      <PoliciesTable
        policies={policies}
        paymentsByPolicyMap={paymentsByPolicyMap}
        clientsById={clientsById}
        clientDuplicateHints={clientDuplicateHints}
        documentsByPolicyId={documentsByPolicyId}
        openingClientId={openingClientId}
        isPoliciesLoading={isPoliciesLoading}
        onClientOpenById={onClientOpenById}
        onClientFindSimilar={onClientFindSimilar}
        onClientNormalizeName={onClientNormalizeName}
        onDealSelect={onDealSelect}
        onDealPreview={onDealPreview}
        onOpenDeal={handleOpenDeal}
        onLoadPolicyDocuments={loadPolicyDocuments}
        onSetOpeningClientId={setOpeningClientId}
        onRequestEditPolicy={onRequestEditPolicy}
        onRequestMovePolicy={onMovePolicy ? setPolicyToMove : undefined}
        onMarkPaymentPaid={onMarkPaymentPaid ? openMarkPaidPrompt : undefined}
        onDeletePayment={onDeletePayment}
        onMarkFinancialRecordPaid={onMarkFinancialRecordPaid ? openMarkRecordPaidPrompt : undefined}
        onDeleteFinancialRecord={onDeleteFinancialRecord}
        onRefreshPolicies={handleRefreshPolicies}
      />

      <PoliciesViewDialogs
        policiesHasMore={policiesHasMore}
        onLoadMorePolicies={onLoadMorePolicies}
        isLoadingMorePolicies={isLoadingMorePolicies}
        paymentToMarkPaid={paymentToMarkPaid}
        paymentPaidDate={paymentPaidDate}
        paymentPaidDateError={paymentPaidDateError}
        recordToMarkPaidId={recordToMarkPaidId}
        recordPaidDate={recordPaidDate}
        recordPaidDateError={recordPaidDateError}
        policyToMove={policyToMove}
        deals={deals}
        isMovingPolicy={isMovingPolicy}
        ConfirmDialogRenderer={ConfirmDialogRenderer}
        onPaymentPaidDateChange={setPaymentPaidDate}
        onClearPaymentPaidDateError={() => setPaymentPaidDateError(null)}
        onConfirmMarkPaid={handleConfirmMarkPaid}
        onCancelMarkPaid={closeMarkPaidPrompt}
        onRecordPaidDateChange={setRecordPaidDate}
        onClearRecordPaidDateError={() => setRecordPaidDateError(null)}
        onConfirmRecordMarkPaid={handleConfirmRecordMarkPaid}
        onCancelRecordMarkPaid={closeMarkRecordPaidPrompt}
        onCancelMovePolicy={() => setPolicyToMove(null)}
        onConfirmMovePolicy={handleConfirmMovePolicy}
      />
    </section>
  );
};
