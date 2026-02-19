import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchDealTimeTrackingSummary, sendDealTimeTrackingTick } from '../../../../api/deals';

const DEFAULT_TICK_SECONDS = 10;
const DEFAULT_CONFIRM_INTERVAL_SECONDS = 600;

const formatSecondsAsHms = (value: number) => {
  const safeValue = Number.isFinite(value) ? Math.max(Math.trunc(value), 0) : 0;
  const hours = Math.floor(safeValue / 3600);
  const minutes = Math.floor((safeValue % 3600) / 60);
  const seconds = safeValue % 60;
  return [hours, minutes, seconds].map((chunk) => String(chunk).padStart(2, '0')).join(':');
};

interface UseDealTimeTrackingResult {
  myTotalSeconds: number;
  myTotalLabel: string;
  isConfirmModalOpen: boolean;
  isPausedForConfirm: boolean;
  continueTracking: () => void;
}

export const useDealTimeTracking = (
  selectedDealId?: string,
  options?: { enabled?: boolean },
): UseDealTimeTrackingResult => {
  const featureEnabled = options?.enabled ?? true;
  const [myTotalSeconds, setMyTotalSeconds] = useState(0);
  const [tickSeconds, setTickSeconds] = useState(DEFAULT_TICK_SECONDS);
  const [confirmIntervalSeconds, setConfirmIntervalSeconds] = useState(
    DEFAULT_CONFIRM_INTERVAL_SECONDS,
  );
  const [isServerEnabled, setServerEnabled] = useState(true);
  const [trackedSecondsSinceConfirm, setTrackedSecondsSinceConfirm] = useState(0);
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isPausedForConfirm, setPausedForConfirm] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const clearTickInterval = useCallback(() => {
    if (intervalRef.current === null) {
      return;
    }
    window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const resetLocalState = useCallback(() => {
    clearTickInterval();
    setMyTotalSeconds(0);
    setTrackedSecondsSinceConfirm(0);
    setConfirmModalOpen(false);
    setPausedForConfirm(false);
    setServerEnabled(true);
    setTickSeconds(DEFAULT_TICK_SECONDS);
    setConfirmIntervalSeconds(DEFAULT_CONFIRM_INTERVAL_SECONDS);
  }, [clearTickInterval]);

  const runTick = useCallback(async () => {
    if (!selectedDealId || !featureEnabled || !isServerEnabled || isPausedForConfirm) {
      return;
    }
    try {
      const response = await sendDealTimeTrackingTick(selectedDealId);
      setServerEnabled(response.enabled);
      setTickSeconds(Math.max(response.tickSeconds || DEFAULT_TICK_SECONDS, 1));
      setConfirmIntervalSeconds(
        Math.max(response.confirmIntervalSeconds || DEFAULT_CONFIRM_INTERVAL_SECONDS, 1),
      );
      setMyTotalSeconds(response.myTotalSeconds);
      if (response.counted) {
        setTrackedSecondsSinceConfirm((prev) => prev + (response.tickSeconds || tickSeconds));
      }
    } catch (error) {
      console.error('Ошибка тика учета времени сделки:', error);
    }
  }, [featureEnabled, isPausedForConfirm, isServerEnabled, selectedDealId, tickSeconds]);

  useEffect(() => {
    if (!selectedDealId || !featureEnabled) {
      resetLocalState();
      return;
    }
    let mounted = true;
    clearTickInterval();
    setConfirmModalOpen(false);
    setPausedForConfirm(false);
    setTrackedSecondsSinceConfirm(0);

    fetchDealTimeTrackingSummary(selectedDealId)
      .then((summary) => {
        if (!mounted) {
          return;
        }
        setServerEnabled(summary.enabled);
        setTickSeconds(Math.max(summary.tickSeconds || DEFAULT_TICK_SECONDS, 1));
        setConfirmIntervalSeconds(
          Math.max(summary.confirmIntervalSeconds || DEFAULT_CONFIRM_INTERVAL_SECONDS, 1),
        );
        setMyTotalSeconds(summary.myTotalSeconds);
      })
      .catch((error) => {
        console.error('Ошибка загрузки summary учета времени сделки:', error);
        if (mounted) {
          setServerEnabled(false);
        }
      });

    return () => {
      mounted = false;
      clearTickInterval();
    };
  }, [clearTickInterval, featureEnabled, resetLocalState, selectedDealId]);

  useEffect(() => {
    clearTickInterval();
    if (!selectedDealId || !featureEnabled || !isServerEnabled || isPausedForConfirm) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      void runTick();
    }, tickSeconds * 1000);

    return () => clearTickInterval();
  }, [
    clearTickInterval,
    featureEnabled,
    isPausedForConfirm,
    isServerEnabled,
    runTick,
    selectedDealId,
    tickSeconds,
  ]);

  useEffect(() => {
    if (!featureEnabled || !isServerEnabled || isPausedForConfirm) {
      return;
    }
    if (trackedSecondsSinceConfirm < confirmIntervalSeconds) {
      return;
    }
    clearTickInterval();
    setPausedForConfirm(true);
    setConfirmModalOpen(true);
  }, [
    clearTickInterval,
    confirmIntervalSeconds,
    featureEnabled,
    isPausedForConfirm,
    isServerEnabled,
    trackedSecondsSinceConfirm,
  ]);

  const continueTracking = useCallback(() => {
    setTrackedSecondsSinceConfirm(0);
    setConfirmModalOpen(false);
    setPausedForConfirm(false);
  }, []);

  const myTotalLabel = useMemo(() => formatSecondsAsHms(myTotalSeconds), [myTotalSeconds]);

  return {
    myTotalSeconds,
    myTotalLabel,
    isConfirmModalOpen,
    isPausedForConfirm,
    continueTracking,
  };
};
