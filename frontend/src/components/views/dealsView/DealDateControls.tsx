import React from 'react';
import { BTN_SM_QUIET } from '../../common/buttonStyles';
import { DateInput } from '../../common/forms/DateInput';
import type { ExpectedCloseReasonResult } from './expectedCloseReason';

interface QuickOption {
  label: string;
  days: number;
}

interface DealDateControlsProps {
  nextContactValue: string;
  expectedCloseValue: string;
  headerExpectedCloseTone: string;
  quickOptions: QuickOption[];
  eventDelayLabel?: string;
  eventDelayDisabled?: boolean;
  eventDelayTitle?: string;
  onNextContactChange: (value: string) => void;
  onNextContactBlur: (value: string) => void;
  onQuickShift: (days: number) => void;
  onEventDelayClick?: () => void;
  expectedCloseReason?: ExpectedCloseReasonResult;
  isExpectedCloseReasonsLoading?: boolean;
}

export const DealDateControls: React.FC<DealDateControlsProps> = ({
  nextContactValue,
  expectedCloseValue,
  headerExpectedCloseTone,
  quickOptions,
  eventDelayLabel,
  eventDelayDisabled = false,
  eventDelayTitle,
  onNextContactChange,
  onNextContactBlur,
  onQuickShift,
  onEventDelayClick,
  expectedCloseReason = {
    status: 'empty',
    events: [],
    message: 'Нет событий, которые объясняют крайний срок.',
  },
  isExpectedCloseReasonsLoading = false,
}) => (
  <div className="mt-6 grid gap-4 md:grid-cols-2">
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">Следующий контакт</p>
      <div className="mt-1 max-w-[220px] flex flex-col gap-2">
        <DateInput
          value={nextContactValue}
          onChange={(event) => onNextContactChange(event.target.value)}
          onBlur={() => onNextContactBlur(nextContactValue)}
          className="field field-input font-semibold text-slate-900"
        />
        <div className="flex flex-wrap gap-2">
          {quickOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => onQuickShift(option.days)}
              className={BTN_SM_QUIET}
            >
              {option.label}
            </button>
          ))}
          {eventDelayLabel && onEventDelayClick && (
            <button
              type="button"
              onClick={onEventDelayClick}
              disabled={eventDelayDisabled}
              title={eventDelayTitle}
              className={BTN_SM_QUIET}
            >
              {eventDelayLabel}
            </button>
          )}
        </div>
      </div>
    </div>
    <div>
      <p className={`text-xs uppercase tracking-wide ${headerExpectedCloseTone}`}>Крайний срок</p>
      <div className="mt-1 flex flex-col gap-2">
        <div className="field field-input flex min-h-[40px] max-w-[220px] items-center font-semibold text-slate-900">
          {expectedCloseValue || '—'}
        </div>
        <div className="max-w-[360px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Почему эта дата
          </p>
          {isExpectedCloseReasonsLoading ? (
            <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-slate-200" />
          ) : expectedCloseReason.events.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {expectedCloseReason.status === 'mismatch' && expectedCloseReason.message && (
                <p className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                  {expectedCloseReason.message}
                </p>
              )}
              {expectedCloseReason.events.slice(0, 3).map((event) => (
                <div key={event.id} className="min-w-0 text-xs leading-5">
                  <span className="font-medium text-slate-800">{event.title}</span>
                  {event.description && (
                    <span className="text-slate-500"> · {event.description}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              {expectedCloseReason.message ?? 'Нет событий, которые объясняют крайний срок.'}
            </p>
          )}
        </div>
      </div>
    </div>
  </div>
);
