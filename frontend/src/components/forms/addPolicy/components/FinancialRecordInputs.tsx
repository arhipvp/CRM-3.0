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
    value: string
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
      <div key={`${type}-${recordIndex}`} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-900">
            {type === 'incomes' ? 'Доход' : 'Расход'} #{recordIndex + 1}
          </span>
          <button
            type="button"
            className="text-xs text-red-500 hover:underline"
            onClick={() => onRemoveRecord(paymentIndex, type, recordIndex)}
          >
            Удалить
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Сумма, ₽</label>
            <input
              type="number"
              value={record.amount}
              onChange={(e) =>
                onUpdateRecord(paymentIndex, type, recordIndex, 'amount', e.target.value)
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Фактическая дата</label>
            <input
              type="date"
              value={record.date || ''}
              onChange={(e) => onUpdateRecord(paymentIndex, type, recordIndex, 'date', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Описание</label>
            <input
              type="text"
              value={record.description || ''}
              onChange={(e) =>
                onUpdateRecord(paymentIndex, type, recordIndex, 'description', e.target.value)
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Источник</label>
            <input
              type="text"
              value={record.source || ''}
              onChange={(e) =>
                onUpdateRecord(paymentIndex, type, recordIndex, 'source', e.target.value)
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Примечание</label>
            <input
              type="text"
              value={record.note || ''}
              onChange={(e) =>
                onUpdateRecord(paymentIndex, type, recordIndex, 'note', e.target.value)
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>
    ))}
  </>
);
