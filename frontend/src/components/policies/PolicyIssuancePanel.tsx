import React from 'react';

import {
  cancelPolicyIssuance,
  fetchPolicyIssuanceStatus,
  resumePolicyIssuance,
  startPolicyIssuance,
} from '../../api';
import type { Policy, PolicyIssuanceStatus } from '../../types';
import { BTN_SM_PRIMARY, BTN_SM_QUIET, BTN_SM_SECONDARY } from '../common/buttonStyles';
import { formatDateTime } from '../views/dealsView/helpers';

const ACTIVE_STATUSES: PolicyIssuanceStatus['status'][] = ['queued', 'running', 'waiting_manual'];

const STATUS_LABELS: Record<PolicyIssuanceStatus['status'], string> = {
  queued: 'В очереди',
  running: 'В работе',
  waiting_manual: 'Ждёт оператора',
  succeeded: 'Успешно',
  failed: 'Ошибка',
  canceled: 'Отменено',
};

const STATUS_TONE_CLASS: Record<PolicyIssuanceStatus['status'], string> = {
  queued: 'bg-slate-100 text-slate-700',
  running: 'bg-sky-100 text-sky-700',
  waiting_manual: 'bg-amber-100 text-amber-700',
  succeeded: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  canceled: 'bg-slate-200 text-slate-700',
};

interface PolicyIssuancePanelProps {
  policy: Policy;
}

export const PolicyIssuancePanel: React.FC<PolicyIssuancePanelProps> = ({ policy }) => {
  const [issuance, setIssuance] = React.useState<PolicyIssuanceStatus | null>(
    policy.sberIssuance ?? null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  const policyId = policy.id;

  const refresh = React.useCallback(async () => {
    try {
      const next = await fetchPolicyIssuanceStatus(policyId);
      setIssuance(next);
      setError(null);
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Не удалось получить статус.';
      if (!issuance) {
        setError(detail);
      }
    }
  }, [issuance, policyId]);

  React.useEffect(() => {
    if (!issuance || !ACTIVE_STATUSES.includes(issuance.status)) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      window.clearInterval(timer);
    };
  }, [issuance, refresh]);

  const handleStart = async () => {
    setIsBusy(true);
    try {
      const next = await startPolicyIssuance(policyId);
      setIssuance(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось запустить оформление.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleResume = async () => {
    setIsBusy(true);
    try {
      const next = await resumePolicyIssuance(policyId);
      setIssuance(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось продолжить оформление.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancel = async () => {
    setIsBusy(true);
    try {
      const next = await cancelPolicyIssuance(policyId);
      setIssuance(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отменить оформление.');
    } finally {
      setIsBusy(false);
    }
  };

  const latestLog = issuance?.log?.[issuance.log.length - 1];

  if (!issuance) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Сбер ОСАГО
            </p>
            <p className="text-xs text-slate-600">Автооформление ещё не запускалось.</p>
          </div>
          <button
            type="button"
            className={BTN_SM_PRIMARY}
            onClick={() => void handleStart()}
            disabled={isBusy}
          >
            Запустить
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Сбер ОСАГО
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE_CLASS[issuance.status]}`}
            >
              {STATUS_LABELS[issuance.status]}
            </span>
          </div>
          <p className="text-xs text-slate-700">Шаг: {issuance.step || '—'}</p>
          <p className="text-xs text-slate-500">Обновлено: {formatDateTime(issuance.updatedAt)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {issuance.status === 'waiting_manual' && (
            <button
              type="button"
              className={BTN_SM_PRIMARY}
              onClick={() => void handleResume()}
              disabled={isBusy}
            >
              Продолжить
            </button>
          )}
          {ACTIVE_STATUSES.includes(issuance.status) && (
            <button
              type="button"
              className={BTN_SM_SECONDARY}
              onClick={() => void handleCancel()}
              disabled={isBusy}
            >
              Отменить
            </button>
          )}
          {!ACTIVE_STATUSES.includes(issuance.status) && issuance.status !== 'succeeded' && (
            <button
              type="button"
              className={BTN_SM_QUIET}
              onClick={() => void handleStart()}
              disabled={isBusy}
            >
              Запустить заново
            </button>
          )}
          {!ACTIVE_STATUSES.includes(issuance.status) && (
            <button
              type="button"
              className={BTN_SM_QUIET}
              onClick={() => void refresh()}
              disabled={isBusy}
            >
              Обновить
            </button>
          )}
        </div>
      </div>

      {issuance.externalPolicyNumber && (
        <p className="mt-2 text-sm font-semibold text-emerald-700">
          Номер полиса: {issuance.externalPolicyNumber}
        </p>
      )}
      {issuance.manualStepReason && (
        <p className="mt-2 text-xs text-amber-700">{issuance.manualStepReason}</p>
      )}
      {issuance.manualStepInstructions && (
        <p className="mt-1 text-xs text-slate-600">{issuance.manualStepInstructions}</p>
      )}
      {issuance.vncHint && (
        <p className="mt-1 text-xs text-slate-600">VNC/RDP: {issuance.vncHint}</p>
      )}
      {issuance.lastError && <p className="mt-2 text-xs text-rose-600">{issuance.lastError}</p>}
      {latestLog && (
        <p className="mt-2 text-xs text-slate-500">Последнее событие: {latestLog.message}</p>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
};
