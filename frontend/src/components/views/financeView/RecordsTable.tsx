import React from 'react';
import type { FinancialRecord } from '../../../types';

interface RecordsTableProps {
  records: FinancialRecord[];
  onDeleteRecord?: (id: string) => Promise<void>;
}

const formatRub = (value: number) =>
  value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });

const formatDate = (date?: string | null) => (date ? new Date(date).toLocaleDateString('ru-RU') : '—');

const getRecordTypeDisplay = (amount: string) => (parseFloat(amount) >= 0 ? 'Доход' : 'Расход');

const getRecordTypeClass = (amount: string) => (parseFloat(amount) >= 0 ? 'record-income' : 'record-expense');

export const RecordsTable: React.FC<RecordsTableProps> = ({ records, onDeleteRecord }) => (
  <div className="records-table-section">
    <div className="table-header">
      <h3>Записи ({records.length})</h3>
    </div>

    {records.length > 0 ? (
      <table className="records-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Тип</th>
            <th>Описание</th>
            <th>Сумма</th>
            <th>Источник</th>
            <th>Заметка</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className={getRecordTypeClass(record.amount)}>
              <td className="date">{formatDate(record.date)}</td>
              <td className="type">{getRecordTypeDisplay(record.amount)}</td>
              <td className="description">{record.description || '—'}</td>
              <td className="amount">
                <strong>{formatRub(Math.abs(Number(record.amount)))}</strong>
              </td>
              <td className="source">{record.source || '—'}</td>
              <td className="note">{record.note || '—'}</td>
              <td className="actions">
                {onDeleteRecord && (
                  <button
                    onClick={() => {
                      if (confirm('Удалить запись?')) {
                        onDeleteRecord(record.id);
                      }
                    }}
                    className="btn-delete btn-sm"
                  >
                    Удалить
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="empty-state">
        <p>Записей пока нет</p>
      </div>
    )}
  </div>
);
