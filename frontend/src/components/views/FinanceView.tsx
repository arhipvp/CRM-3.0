import React, { useMemo, useState } from 'react';
import { Payment, FinancialRecord } from '../../types';
import { SummaryCards, FinanceStats } from './financeView/SummaryCards';
import { FiltersSection } from './financeView/FiltersSection';
import { RecordsTable } from './financeView/RecordsTable';

type FinanceFilterType = 'all' | 'income' | 'expense';

interface FinanceViewProps {
  payments: Payment[];
  financialRecords?: FinancialRecord[];
  onAddRecord?: () => void;
  onDeleteRecord?: (id: string) => Promise<void>;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  payments,
  financialRecords = [],
  onAddRecord,
  onDeleteRecord,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FinanceFilterType>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const stats = useMemo<FinanceStats>(() => {
    const paid = payments.filter((p) => Boolean(p.actualDate));
    const incomes = financialRecords.filter((r) => parseFloat(r.amount) >= 0);
    const expenses = financialRecords.filter((r) => parseFloat(r.amount) < 0);

    const sumPayments = (items: Payment[]) =>
      items.reduce((total, item) => total + Number(item.amount || 0), 0);

    const totalIncome = incomes.reduce((total, r) => total + Number(r.amount || 0), 0);
    const totalExpense = Math.abs(expenses.reduce((total, r) => total + Number(r.amount || 0), 0));

    return {
      paidPayments: sumPayments(paid),
      totalPayments: sumPayments(payments),
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
    };
  }, [payments, financialRecords]);

  const filteredRecords = useMemo(() => {
    let result = financialRecords;

    if (filterType !== 'all') {
      result = result.filter((record) =>
        filterType === 'income' ? parseFloat(record.amount) >= 0 : parseFloat(record.amount) < 0
      );
    }

    if (filterDateFrom) {
      result = result.filter((record) => record.date && new Date(record.date) >= new Date(filterDateFrom));
    }

    if (filterDateTo) {
      result = result.filter((record) => record.date && new Date(record.date) <= new Date(filterDateTo));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (record) =>
          record.description?.toLowerCase().includes(query) ||
          record.source?.toLowerCase().includes(query) ||
          record.note?.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [financialRecords, filterType, filterDateFrom, filterDateTo, searchQuery]);

  const resetFilters = () => {
    setFilterType('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchQuery('');
  };

  return (
    <div className="finance-view">
      <SummaryCards stats={stats} />
      <FiltersSection
        searchQuery={searchQuery}
        filterType={filterType}
        filterDateFrom={filterDateFrom}
        filterDateTo={filterDateTo}
        onSearchChange={setSearchQuery}
        onFilterTypeChange={(value) => setFilterType(value as FinanceFilterType)}
        onFilterDateFromChange={setFilterDateFrom}
        onFilterDateToChange={setFilterDateTo}
        onReset={resetFilters}
      />

      <div className="table-header">
        <h3>Записи ({filteredRecords.length})</h3>
        {onAddRecord && (
          <button onClick={onAddRecord} className="btn-primary btn-sm">
            Добавить запись
          </button>
        )}
      </div>

      <RecordsTable records={filteredRecords} onDeleteRecord={onDeleteRecord} />

      <style>{`
        .finance-view {
          padding: 20px;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 15px;
        }

        .stat-label {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 600;
          margin: 8px 0 0 0;
          color: #1e293b;
        }

        .stat-value.income {
          color: #16a34a;
        }

        .stat-value.expense {
          color: #dc2626;
        }

        .stat-value.positive {
          color: #16a34a;
        }

        .stat-value.negative {
          color: #dc2626;
        }

        .filters-section {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          margin-bottom: 10px;
        }

        .filter-group label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .search-input,
        .filter-group input,
        .filter-group select {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 14px;
        }

        .filters-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .btn-reset {
          align-self: flex-end;
          padding: 8px 16px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-reset:hover {
          background: #e2e8f0;
        }

        .records-table {
          width: 100%;
          border-collapse: collapse;
        }

        .records-table thead {
          background: #f8fafc;
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
        }

        .records-table th {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        .records-table td {
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
        }

        .records-table tbody tr:hover {
          background: #f8fafc;
        }

        .records-table .date {
          font-weight: 500;
        }

        .records-table .type {
          font-weight: 600;
        }

        .records-table .amount {
          text-align: right;
          font-weight: 600;
        }

        .record-income .amount {
          color: #16a34a;
        }

        .record-expense .amount {
          color: #dc2626;
        }

        .source {
          font-size: 13px;
        }

        .note {
          font-size: 13px;
          color: #64748b;
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: #64748b;
        }

        .actions {
          text-align: right;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border-bottom: 1px solid #e2e8f0;
          background: white;
          margin-bottom: 15px;
          border-radius: 8px 8px 0 0;
        }

        .table-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-delete {
          background: #fee2e2;
          color: #dc2626;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
        }

        .btn-delete:hover {
          background: #fecaca;
        }
      `}</style>
    </div>
  );
};
