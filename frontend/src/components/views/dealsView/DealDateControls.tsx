import React from 'react';
import { BTN_SM_QUIET } from '../../common/buttonStyles';

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
}) => (
  <div className="mt-6 grid gap-4 md:grid-cols-2">
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">Следующий контакт</p>
      <div className="mt-1 max-w-[220px] flex flex-col gap-2">
        <input
          type="date"
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
      <input
        type="date"
        value={expectedCloseValue}
        onChange={(event) => onExpectedCloseChange(event.target.value)}
        onBlur={(event) => onExpectedCloseBlur(event.target.value)}
        className="field field-input mt-1 max-w-[220px] font-semibold text-slate-900"
      />
    </div>
  </div>
);
