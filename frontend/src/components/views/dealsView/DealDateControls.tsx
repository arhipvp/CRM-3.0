import React from 'react';
import type { DealTimelineEvent } from '../../../types';
import { BTN_SM_QUIET } from '../../common/buttonStyles';
import { DateInput } from '../../common/forms/DateInput';

interface QuickOption {
  label: string;
  days: number;
}

interface DealDateControlsProps {
  nextContactValue: string;
  expectedCloseValue: string;
  headerExpectedCloseTone: string;
  quickOptions: QuickOption[];
  onNextContactChange: (value: string) => void;
  onNextContactBlur: (value: string) => void;
  onExpectedCloseChange: (value: string) => void;
  onExpectedCloseBlur: (value: string) => void;
  onQuickShift: (days: number) => void;
  expectedCloseReasons?: DealTimelineEvent[];
  isExpectedCloseReasonsLoading?: boolean;
}

export const DealDateControls: React.FC<DealDateControlsProps> = ({
  nextContactValue,
  expectedCloseValue,
  headerExpectedCloseTone,
  quickOptions,
  onNextContactChange,
  onNextContactBlur,
  onExpectedCloseChange,
  onExpectedCloseBlur,
  onQuickShift,
  expectedCloseReasons = [],
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
        </div>
      </div>
    </div>
    <div>
      <p className={`text-xs uppercase tracking-wide ${headerExpectedCloseTone}`}>
        Застраховать до
      </p>
      <div className="mt-1 flex flex-col gap-2">
        <DateInput
          value={expectedCloseValue}
          onChange={(event) => onExpectedCloseChange(event.target.value)}
          onBlur={(event) => onExpectedCloseBlur(event.target.value)}
          className="field field-input max-w-[220px] font-semibold text-slate-900"
        />
        <div className="max-w-[360px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Почему эта дата
          </p>
          {isExpectedCloseReasonsLoading ? (
            <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-slate-200" />
          ) : expectedCloseReasons.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {expectedCloseReasons.slice(0, 3).map((event) => (
                <div key={event.id} className="min-w-0 text-xs leading-5">
                  <span className="font-medium text-slate-800">{event.title}</span>
                  {event.description && (
                    <span className="text-slate-500"> · {event.description}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Причина не определена</p>
          )}
        </div>
      </div>
    </div>
  </div>
);
