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

interface UseDealInlineDatesParams {
  selectedDeal: Deal | null;
  sortedDeals: Deal[];
  onUpdateDeal: (dealId: string, data: DealFormValues) => Promise<void>;
  onSelectDeal: (dealId: string) => void;
  onPostponeDeal?: (dealId: string, data: DealFormValues) => Promise<void>;
}

export const useDealInlineDates = ({
  selectedDeal,
  sortedDeals,
  onUpdateDeal,
  onSelectDeal,
  onPostponeDeal,
}: UseDealInlineDatesParams) => {
  const [nextContactInputValue, setNextContactInputValue] = useState('');
  const [expectedCloseInputValue, setExpectedCloseInputValue] = useState('');

  const buildPayload = useCallback(
    (fields: {
      nextContactDate?: string | null;
      expectedClose?: string | null;
    }): DealFormValues | null => {
      if (!selectedDeal) {
        return null;
      }

      return {
        title: selectedDeal.title,
        description: selectedDeal.description || '',
        clientId: selectedDeal.clientId,
        source: selectedDeal.source ?? null,
        nextContactDate: fields.nextContactDate ?? selectedDeal.nextContactDate ?? null,
        expectedClose: fields.expectedClose ?? selectedDeal.expectedClose ?? null,
      };
    },
    [selectedDeal],
  );

  const updateDealDates = useCallback(
    async (fields: { nextContactDate?: string | null; expectedClose?: string | null }) => {
      const payload = buildPayload(fields);
      if (!payload || !selectedDeal) {
        return;
      }
      await onUpdateDeal(selectedDeal.id, payload);
    },
    [buildPayload, onUpdateDeal, selectedDeal],
  );

  useEffect(() => {
    setNextContactInputValue(selectedDeal?.nextContactDate ?? '');
  }, [selectedDeal?.id, selectedDeal?.nextContactDate]);

  useEffect(() => {
    setExpectedCloseInputValue(selectedDeal?.expectedClose ?? '');
  }, [selectedDeal?.id, selectedDeal?.expectedClose]);

  const handleInlineDateSave = useCallback(
    async (
      field: DateField,
      rawValue: string,
      options?: { selectTopDeal?: boolean },
    ): Promise<void> => {
      if (!selectedDeal) {
        return;
      }

      const value = rawValue || null;

      try {
        await updateDealDates(
          field === 'nextContactDate' ? { nextContactDate: value } : { expectedClose: value },
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
    [onSelectDeal, selectedDeal, sortedDeals, updateDealDates],
  );

  const handleNextContactChange = useCallback((value: string) => {
    setNextContactInputValue(value);
  }, []);

  const handleExpectedCloseChange = useCallback((value: string) => {
    setExpectedCloseInputValue(value);
  }, []);

  const handleNextContactBlur = useCallback(
    (value: string) => handleInlineDateSave('nextContactDate', value),
    [handleInlineDateSave],
  );

  const handleExpectedCloseBlur = useCallback(
    (value: string) => handleInlineDateSave('expectedClose', value),
    [handleInlineDateSave],
  );

  const handleQuickNextContactShift = useCallback(
    (newValue: string) => {
      setNextContactInputValue(newValue);
      return handleInlineDateSave('nextContactDate', newValue, { selectTopDeal: true });
    },
    [handleInlineDateSave],
  );

  const handleQuickNextContactPostpone = useCallback(
    async (
      fields: {
        nextContactDate?: string | null;
        expectedClose?: string | null;
      },
      options?: { updateInput?: boolean },
    ) => {
      if (!selectedDeal || !onPostponeDeal) {
        return;
      }
      const nextContactDateValue = fields.nextContactDate ?? '';
      if (options?.updateInput ?? true) {
        setNextContactInputValue(nextContactDateValue);
      }
      const payload = buildPayload({
        nextContactDate: fields.nextContactDate ?? null,
        expectedClose: fields.expectedClose,
      });
      if (!payload) {
        return;
      }

      try {
        await onPostponeDeal(selectedDeal.id, payload);
      } catch (err) {
        console.error('Ошибка при быстром переносе следующего контакта:', err);
      }
    },
    [buildPayload, onPostponeDeal, selectedDeal],
  );

  const postponeDealDates = useCallback(
    async (fields: { nextContactDate?: string | null; expectedClose?: string | null }) => {
      await handleQuickNextContactPostpone(fields, { updateInput: true });
    },
    [handleQuickNextContactPostpone],
  );

  const quickInlineShift = useCallback(
    (days: number) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      handleQuickNextContactShift(formatDateForInput(targetDate));
    },
    [handleQuickNextContactShift],
  );

  const quickInlinePostponeShift = useCallback(
    (days: number) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      void handleQuickNextContactPostpone({ nextContactDate: formatDateForInput(targetDate) });
    },
    [handleQuickNextContactPostpone],
  );

  const quickInlineDateOptions = useMemo(
    () => QUICK_INLINE_DATE_OPTIONS.map((option) => ({ ...option })),
    [],
  );

  return {
    nextContactInputValue,
    expectedCloseInputValue,
    handleNextContactChange,
    handleExpectedCloseChange,
    handleNextContactBlur,
    handleExpectedCloseBlur,
    handleQuickNextContactShift,
    handleQuickNextContactPostpone,
    quickInlineShift,
    quickInlinePostponeShift,
    quickInlineDateOptions,
    updateDealDates,
    postponeDealDates,
  };
};
