import { useCallback, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

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
  clearSelectedDealFocus: () => void;
  resetDealSelection: () => void;
  selectDealById: (dealId: string) => void;
  handleOpenDealPreview: (dealId: string) => void;
  handleCloseDealPreview: () => void;
  requestDealRowFocus: (dealId: string) => void;
};

export const useDealPreviewController = (): DealPreviewController => {
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [isDealFocusCleared, setIsDealFocusCleared] = useState(false);
  const [dealRowFocusRequest, setDealRowFocusRequest] = useState<DealRowFocusRequest | null>(null);
  const [previewDealId, setPreviewDealId] = useState<string | null>(null);
  const dealRowFocusNonceRef = useRef(0);

  const clearSelectedDealFocus = useCallback(() => {
    setSelectedDealId(null);
    setIsDealFocusCleared(true);
  }, []);

  const selectDealById = useCallback((dealId: string) => {
    setSelectedDealId(dealId);
    setIsDealFocusCleared(false);
  }, []);

  const resetDealSelection = useCallback(() => {
    setSelectedDealId(null);
    setIsDealFocusCleared(false);
  }, []);

  const handleOpenDealPreview = useCallback(
    (dealId: string) => {
      setPreviewDealId(dealId);
      selectDealById(dealId);
    },
    [selectDealById],
  );

  const handleCloseDealPreview = useCallback(() => {
    setPreviewDealId(null);
  }, []);

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
    setPreviewDealId,
    clearSelectedDealFocus,
    resetDealSelection,
    selectDealById,
    handleOpenDealPreview,
    handleCloseDealPreview,
    requestDealRowFocus,
  };
};
