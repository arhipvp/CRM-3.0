import React from 'react';
import { DateInput } from '../../../common/forms/DateInput';
import { IconButton } from '../../../common/Button';
import { Panel } from '../../../common/layoutPrimitives';
import type { FinancialRecordDraft } from '../types';

interface FinancialRecordInputsProps {
  paymentIndex: number;
  type: 'incomes' | 'expenses';
  records: FinancialRecordDraft[];
  onUpdateRecord: (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string,
  ) => void;
  onRemoveRecord: (paymentIndex: number, type: 'incomes' | 'expenses', recordIndex: number) => void;
}

export const FinancialRecordInputs: React.FC<FinancialRecordInputsProps> = ({
  paymentIndex,
  type,
  records,
  onUpdateRecord,
  onRemoveRecord,
}) => (
  <>
    {records.map((record, recordIndex) => (
      <Panel variant="flat" padding="sm" key={`${type}-${recordIndex}`} className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">
            {type === 'incomes' ? 'Доход' : 'Расход'} #{recordIndex + 1}
          </span>
          <IconButton
            icon="delete"
            label="Удалить"
            tone="danger"
            size="sm"
            onClick={() => onRemoveRecord(paymentIndex, type, recordIndex)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div
            data-testid={`${type}-record-amount-accent`}
            className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
              Сумма, ₽
            </label>
            <p className="mt-1 text-[11px] text-emerald-700">Главная сумма финансовой записи</p>
            <input
              type="number"
              value={record.amount}
              onChange={(e) =>
                onUpdateRecord(paymentIndex, type, recordIndex, 'amount', e.target.value)
              }
              className="field field-input mt-2 bg-white ring-2 ring-emerald-100/80"
            />
          </div>
          <div
            data-testid={`${type}-record-date-accent`}
            className="rounded-2xl border border-sky-100 bg-white p-3 shadow-sm"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
              Фактическая дата
            </label>
            <p className="mt-1 text-[11px] text-sky-700">Дата поступления или списания</p>
            <DateInput
              value={record.date || ''}
              onChange={(e) =>
                onUpdateRecord(paymentIndex, type, recordIndex, 'date', e.target.value)
              }
              className="field field-input mt-2 border-sky-300 bg-white ring-2 ring-sky-100/80"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Примечание</label>
            <input
              type="text"
              value={record.note || ''}
              onChange={(e) =>
                onUpdateRecord(paymentIndex, type, recordIndex, 'note', e.target.value)
              }
              className="field field-input mt-1"
            />
          </div>
        </div>
      </Panel>
    ))}
  </>
);
