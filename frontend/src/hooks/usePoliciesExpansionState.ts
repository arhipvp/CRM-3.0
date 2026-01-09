import { useEffect, useState } from 'react';

export const POLICIES_PAYMENTS_EXPANDED_STORAGE_KEY = 'crm:policies:payments-expanded';
export const POLICIES_RECORDS_EXPANDED_STORAGE_KEY = 'crm:policies:records-expanded';

const parsePaymentsExpanded = (raw: string | null): Record<string, boolean> => {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
        key,
        value === true,
      ]),
    );
  } catch {
    return {};
  }
};

export const usePoliciesExpansionState = () => {
  const [paymentsExpanded, setPaymentsExpanded] = useState<Record<string, boolean>>({});
  const [recordsExpandedAll, setRecordsExpandedAll] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setPaymentsExpanded(
      parsePaymentsExpanded(window.localStorage.getItem(POLICIES_PAYMENTS_EXPANDED_STORAGE_KEY)),
    );
    setRecordsExpandedAll(
      window.localStorage.getItem(POLICIES_RECORDS_EXPANDED_STORAGE_KEY) === 'true',
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      POLICIES_PAYMENTS_EXPANDED_STORAGE_KEY,
      JSON.stringify(paymentsExpanded),
    );
  }, [paymentsExpanded]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      POLICIES_RECORDS_EXPANDED_STORAGE_KEY,
      recordsExpandedAll ? 'true' : 'false',
    );
  }, [recordsExpandedAll]);

  return {
    paymentsExpanded,
    setPaymentsExpanded,
    recordsExpandedAll,
    setRecordsExpandedAll,
  };
};
