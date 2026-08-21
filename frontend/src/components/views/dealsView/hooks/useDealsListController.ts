import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { Client, Deal } from '../../../../types';

export type DealsSortKey = 'deadline' | 'nextContact';
export type DealsSortDirection = 'asc' | 'desc' | null;

const DEALS_LIST_HEIGHT_STORAGE_KEY = 'crm:deals:list-height';
export const MIN_DEALS_LIST_HEIGHT_PX = 220;
export const MAX_DEALS_LIST_HEIGHT_VIEWPORT_RATIO = 0.7;

const getMaxDealsListHeight = () => {
  if (typeof window === 'undefined') return 760;
  return Math.max(
    MIN_DEALS_LIST_HEIGHT_PX,
    Math.round(window.innerHeight * MAX_DEALS_LIST_HEIGHT_VIEWPORT_RATIO),
  );
};

const clampDealsListHeight = (height: number) =>
  Math.min(Math.max(Math.round(height), MIN_DEALS_LIST_HEIGHT_PX), getMaxDealsListHeight());

const parseStoredDealsListHeight = (raw: string | null) => {
  if (!raw || !/^\d+px$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? `${clampDealsListHeight(parsed)}px` : null;
};

const useIsDesktopDealsLayout = () => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px)').matches
      : true,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return isDesktop;
};

interface UseDealsListControllerOptions {
  selectedDeal: Deal | null;
  dealRowFocusRequest?: { dealId: string; nonce: number } | null;
  dealOrdering?: string;
  onDealOrderingChange: (value: string | undefined) => void;
  clients: Client[];
}

export function useDealsListController({
  selectedDeal,
  dealRowFocusRequest,
  dealOrdering,
  onDealOrderingChange,
  clients,
}: UseDealsListControllerOptions) {
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const lastHandledFocusNonceRef = useRef<number | null>(null);
  const [dealsListHeight, setDealsListHeight] = useState('26vh');
  const isDesktopLayout = useIsDesktopDealsLayout();
  const selectedDealId = selectedDeal?.id ?? null;
  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((client) => map.set(client.id, client));
    return map;
  }, [clients]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedHeight = parseStoredDealsListHeight(
      window.localStorage.getItem(DEALS_LIST_HEIGHT_STORAGE_KEY),
    );
    if (storedHeight) setDealsListHeight(storedHeight);
  }, []);

  const saveDealsListHeight = useCallback((height: number) => {
    const nextHeight = `${clampDealsListHeight(height)}px`;
    setDealsListHeight(nextHeight);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEALS_LIST_HEIGHT_STORAGE_KEY, nextHeight);
    }
  }, []);

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!tableScrollRef.current) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const startY = event.clientY;
      const startHeight = tableScrollRef.current.getBoundingClientRect().height;
      const handlePointerMove = (moveEvent: PointerEvent) =>
        saveDealsListHeight(startHeight + moveEvent.clientY - startY);
      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp, { once: true });
    },
    [saveDealsListHeight],
  );

  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const currentHeight = tableScrollRef.current?.getBoundingClientRect().height ?? 0;
      if (event.key === 'Home') saveDealsListHeight(MIN_DEALS_LIST_HEIGHT_PX);
      else if (event.key === 'End') saveDealsListHeight(getMaxDealsListHeight());
      else {
        const step = event.shiftKey ? 48 : 16;
        saveDealsListHeight(currentHeight + (event.key === 'ArrowDown' ? step : -step));
      }
    },
    [saveDealsListHeight],
  );

  useEffect(() => {
    if (!selectedDealId || !selectedRowRef.current?.isConnected) return;
    selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedDealId]);

  useEffect(() => {
    if (
      !dealRowFocusRequest ||
      lastHandledFocusNonceRef.current === dealRowFocusRequest.nonce ||
      dealRowFocusRequest.dealId !== selectedDealId
    )
      return;
    lastHandledFocusNonceRef.current = dealRowFocusRequest.nonce;
    if (selectedRowRef.current?.isConnected) {
      selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      selectedRowRef.current.focus({ preventScroll: true });
    }
  }, [dealRowFocusRequest, selectedDealId]);

  const getOrderingField = (key: DealsSortKey) =>
    key === 'deadline' ? 'expected_close' : 'next_contact_date';
  const getSortDirection = (key: DealsSortKey): DealsSortDirection => {
    const field = getOrderingField(key);
    if (dealOrdering === `-${field}`) return 'desc';
    if (dealOrdering === field) return 'asc';
    return null;
  };
  const toggleColumnSort = (key: DealsSortKey) => {
    const field = getOrderingField(key);
    const direction = getSortDirection(key);
    onDealOrderingChange(!direction ? field : direction === 'asc' ? `-${field}` : undefined);
  };
  const getSortIndicator = (key: DealsSortKey) => {
    const direction = getSortDirection(key);
    return !direction ? '↕' : direction === 'asc' ? '↑' : '↓';
  };
  const getSortLabel = (key: DealsSortKey) => {
    const direction = getSortDirection(key);
    return !direction ? 'не сортируется' : direction === 'asc' ? 'по возрастанию' : 'по убыванию';
  };
  const getColumnTitleClass = (key: DealsSortKey) => {
    const base = 'text-[11px] font-semibold uppercase tracking-wide';
    return getSortDirection(key)
      ? `${base} text-rose-600 underline decoration-rose-500 decoration-2 underline-offset-2`
      : `${base} text-slate-900`;
  };
  const getAriaSort = (key: DealsSortKey): 'ascending' | 'descending' | 'none' => {
    const direction = getSortDirection(key);
    return !direction ? 'none' : direction === 'asc' ? 'ascending' : 'descending';
  };

  return {
    clientsById,
    dealsListHeight,
    getAriaSort,
    getColumnTitleClass,
    getSortIndicator,
    getSortLabel,
    handleResizeKeyDown,
    handleResizePointerDown,
    isDesktopLayout,
    selectedRowRef,
    tableScrollRef,
    toggleColumnSort,
  };
}
