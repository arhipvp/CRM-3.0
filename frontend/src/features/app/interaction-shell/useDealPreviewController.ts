import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

type DealRowFocusRequest = {
  dealId: string;
  nonce: number;
};

export type DealPreviewController = {
  selectedDealId: string | null;
  isDealFocusCleared: boolean;
  dealRowFocusRequest: DealRowFocusRequest | null;
  previewDealId: string | null;
  setPreviewDealId: Dispatch<SetStateAction<string | null>>;
  clearSelectedDealFocus: (expectedDealId?: string) => void;
  resetDealSelection: () => void;
  selectDealById: (dealId: string) => void;
  handleOpenDealPreview: (dealId: string) => void;
  handleCloseDealPreview: () => void;
  requestDealRowFocus: (dealId: string) => void;
};

export const useDealPreviewController = (): DealPreviewController => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(() =>
    location.pathname === '/deals' ? searchParams.get('dealId') : null,
  );
  const [isDealFocusCleared, setIsDealFocusCleared] = useState(false);
  const [dealRowFocusRequest, setDealRowFocusRequest] = useState<DealRowFocusRequest | null>(null);
  const [previewDealId, setPreviewDealId] = useState<string | null>(null);
  const dealRowFocusNonceRef = useRef(0);
  const selectedDealIdRef = useRef(selectedDealId);
  const isClearSelectionNavigationPendingRef = useRef(false);
  const pathnameRef = useRef(location.pathname);
  const searchParamsRef = useRef(searchParams);
  const setSearchParamsRef = useRef(setSearchParams);

  useEffect(() => {
    pathnameRef.current = location.pathname;
    searchParamsRef.current = searchParams;
    setSearchParamsRef.current = setSearchParams;
    setPreviewDealId(searchParams.get('previewDeal'));
    if (location.pathname === '/deals') {
      const nextSelectedDealId = searchParams.get('dealId');
      if (isClearSelectionNavigationPendingRef.current && nextSelectedDealId) {
        return;
      }
      isClearSelectionNavigationPendingRef.current = false;
      selectedDealIdRef.current = nextSelectedDealId;
      setSelectedDealId(nextSelectedDealId);
    }
  }, [location.pathname, searchParams, setSearchParams]);

  const updatePreviewDealId: Dispatch<SetStateAction<string | null>> = useCallback(
    (value) => {
      const nextValue = typeof value === 'function' ? value(previewDealId) : value;
      setPreviewDealId(nextValue);
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        if (nextValue) {
          nextParams.set('previewDeal', nextValue);
        } else {
          nextParams.delete('previewDeal');
        }
        return nextParams;
      });
    },
    [previewDealId, setSearchParams],
  );

  const clearSelectedDealFocus = useCallback((expectedDealId?: string) => {
    if (expectedDealId && selectedDealIdRef.current !== expectedDealId) {
      return;
    }
    selectedDealIdRef.current = null;
    setSelectedDealId(null);
    setIsDealFocusCleared(true);
    if (pathnameRef.current === '/deals') {
      isClearSelectionNavigationPendingRef.current = true;
      setSearchParamsRef.current((current) => {
        const next = new URLSearchParams(current);
        next.delete('dealId');
        next.delete('tab');
        return next;
      });
    }
  }, []);

  const selectDealById = useCallback((dealId: string) => {
    isClearSelectionNavigationPendingRef.current = false;
    selectedDealIdRef.current = dealId;
    setSelectedDealId(dealId);
    setIsDealFocusCleared(false);
    if (pathnameRef.current === '/deals' && searchParamsRef.current.get('dealId') !== dealId) {
      setSearchParamsRef.current((current) => {
        const next = new URLSearchParams(current);
        next.set('dealId', dealId);
        return next;
      });
    }
  }, []);

  const resetDealSelection = useCallback(() => {
    isClearSelectionNavigationPendingRef.current = false;
    selectedDealIdRef.current = null;
    setSelectedDealId(null);
    setIsDealFocusCleared(false);
  }, []);

  const handleOpenDealPreview = useCallback((dealId: string) => {
    isClearSelectionNavigationPendingRef.current = false;
    setPreviewDealId(dealId);
    selectedDealIdRef.current = dealId;
    setSelectedDealId(dealId);
    setIsDealFocusCleared(false);
    setSearchParamsRef.current((current) => {
      const next = new URLSearchParams(current);
      next.set('previewDeal', dealId);
      if (pathnameRef.current === '/deals') next.set('dealId', dealId);
      return next;
    });
  }, []);

  const handleCloseDealPreview = useCallback(() => {
    updatePreviewDealId(null);
  }, [updatePreviewDealId]);

  const requestDealRowFocus = useCallback((dealId: string) => {
    setDealRowFocusRequest({
      dealId,
      nonce: (dealRowFocusNonceRef.current += 1),
    });
  }, []);

  return {
    selectedDealId,
    isDealFocusCleared,
    dealRowFocusRequest,
    previewDealId,
    setPreviewDealId: updatePreviewDealId,
    clearSelectedDealFocus,
    resetDealSelection,
    selectDealById,
    handleOpenDealPreview,
    handleCloseDealPreview,
    requestDealRowFocus,
  };
};
