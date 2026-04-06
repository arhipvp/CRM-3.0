import React from 'react';
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
      <div
        key={`${type}-${recordIndex}`}
        className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white"
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-900">
            {type === 'incomes' ? 'Доход' : 'Расход'} #{recordIndex + 1}
          </span>
          <button
            type="button"
            className="link-danger text-xs"
            onClick={() => onRemoveRecord(paymentIndex, type, recordIndex)}
          >
            Удалить
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            data-testid={`${type}-record-amount-accent`}
            className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 shadow-inner shadow-emerald-100/70"
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
            className="rounded-2xl border border-sky-200 bg-sky-50/90 p-3 shadow-inner shadow-sky-100/70"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
              Фактическая дата
            </label>
            <p className="mt-1 text-[11px] text-sky-700">Дата поступления или списания</p>
            <input
              type="date"
              value={record.date || ''}
              onChange={(e) =>
                onUpdateRecord(paymentIndex, type, recordIndex, 'date', e.target.value)
              }
              className="field field-input mt-2 border-sky-300 bg-white ring-2 ring-sky-100/80"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </div>
    ))}
  </>
);
