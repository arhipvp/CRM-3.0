import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Deal } from '../../../../types';
import type { DealFormValues } from '../../../forms/DealForm';

type DateField = 'nextContactDate' | 'expectedClose';

const QUICK_INLINE_DATE_OPTIONS = [
  { label: 'завтра', days: 1 },
  { label: '+2 дня', days: 2 },
  { label: '+5 дней', days: 5 },
] as const;

const formatDateForInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDateString = (value: string) => {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if ([year, month, day].some((segment) => Number.isNaN(segment))) {
    return null;
  }

  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
};

interface UseDealInlineDatesParams {
  selectedDeal: Deal | null;
  sortedDeals: Deal[];
  onUpdateDeal: (dealId: string, data: DealFormValues) => Promise<void>;
  onSelectDeal: (dealId: string) => void;
}

export const useDealInlineDates = ({
  selectedDeal,
  sortedDeals,
  onUpdateDeal,
  onSelectDeal,
}: UseDealInlineDatesParams) => {
  const [nextContactInputValue, setNextContactInputValue] = useState('');
  const [expectedCloseInputValue, setExpectedCloseInputValue] = useState('');

  const updateDealDates = useCallback(
    async (fields: { nextContactDate?: string | null; expectedClose?: string | null }) => {
      if (!selectedDeal) {
        return;
      }
      const payload: DealFormValues = {
        title: selectedDeal.title,
        description: selectedDeal.description || '',
        clientId: selectedDeal.clientId,
        source: selectedDeal.source ?? null,
        nextContactDate: fields.nextContactDate ?? selectedDeal.nextContactDate ?? null,
        expectedClose: fields.expectedClose ?? selectedDeal.expectedClose ?? null,
      };
      await onUpdateDeal(selectedDeal.id, payload);
    },
    [onUpdateDeal, selectedDeal]
  );

  useEffect(() => {
    setNextContactInputValue(selectedDeal?.nextContactDate ?? '');
  }, [selectedDeal?.nextContactDate]);

  useEffect(() => {
    setExpectedCloseInputValue(selectedDeal?.expectedClose ?? '');
  }, [selectedDeal?.expectedClose]);

  const handleInlineDateSave = useCallback(
    async (
      field: DateField,
      rawValue: string,
      options?: { selectTopDeal?: boolean }
    ): Promise<void> => {
      if (!selectedDeal) {
        return;
      }

      const value = rawValue || null;

      try {
        await updateDealDates(
          field === 'nextContactDate'
            ? { nextContactDate: value }
            : { expectedClose: value }
        );

        if (field === 'nextContactDate') {
          setNextContactInputValue(value ?? '');
        }
        if (field === 'expectedClose') {
          setExpectedCloseInputValue(value ?? '');
        }

        if (options?.selectTopDeal) {
          const topDeal = sortedDeals[0];
          if (topDeal && topDeal.id !== selectedDeal.id) {
            onSelectDeal(topDeal.id);
          }
        }
      } catch (err) {
        console.error('Ошибка обновления даты сделки:', err);
      }
    },
    [onSelectDeal, selectedDeal, sortedDeals, updateDealDates]
  );

  const handleNextContactChange = useCallback((value: string) => {
    setNextContactInputValue(value);
  }, []);

  const handleExpectedCloseChange = useCallback((value: string) => {
    setExpectedCloseInputValue(value);
  }, []);

  const handleNextContactBlur = useCallback(
    (value: string) => handleInlineDateSave('nextContactDate', value),
    [handleInlineDateSave]
  );

  const handleExpectedCloseBlur = useCallback(
    (value: string) => handleInlineDateSave('expectedClose', value),
    [handleInlineDateSave]
  );

  const handleQuickNextContactShift = useCallback(
    (newValue: string) => {
      setNextContactInputValue(newValue);
      return handleInlineDateSave('nextContactDate', newValue, { selectTopDeal: true });
    },
    [handleInlineDateSave]
  );

  const quickInlineShift = useCallback(
    (days: number) => {
      const value = selectedDeal?.nextContactDate ? parseIsoDateString(selectedDeal.nextContactDate) : null;
      const baseDate = value ? value : (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      })();
      baseDate.setDate(baseDate.getDate() + days);
      handleQuickNextContactShift(formatDateForInput(baseDate));
    },
    [handleQuickNextContactShift, selectedDeal?.nextContactDate]
  );

  const quickInlineDateOptions = useMemo(
    () => QUICK_INLINE_DATE_OPTIONS.map((option) => ({ ...option })),
    []
  );

  return {
    nextContactInputValue,
    expectedCloseInputValue,
    handleNextContactChange,
    handleExpectedCloseChange,
    handleNextContactBlur,
    handleExpectedCloseBlur,
    handleQuickNextContactShift,
    quickInlineShift,
    quickInlineDateOptions,
    updateDealDates,
  };
};
