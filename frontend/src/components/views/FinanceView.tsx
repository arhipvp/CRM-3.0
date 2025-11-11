import React, { useMemo, useState } from "react";
import { Payment, FinancialRecord } from "../../types";

interface FinanceViewProps {
  payments: Payment[];
  financialRecords?: FinancialRecord[];
  onAddRecord?: () => void;
  onUpdateRecord?: (id: string, data: Partial<FinancialRecord>) => Promise<void>;
  onDeleteRecord?: (id: string) => Promise<void>;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  payments,
  financialRecords = [],
  onAddRecord,
  onDeleteRecord,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const stats = useMemo(() => {
    const planned = payments.filter((p) => p.status === "planned");
    const partial = payments.filter((p) => p.status === "partial");
    const paid = payments.filter((p) => p.status === "paid");

    const incomes = financialRecords.filter((r) => parseFloat(r.amount) >= 0);
    const expenses = financialRecords.filter((r) => parseFloat(r.amount) < 0);

    const sumPayments = (items: Payment[]) =>
      items.reduce((total, item) => total + Number(item.amount || 0), 0);

    const totalIncome = incomes.reduce((total, r) => total + Number(r.amount || 0), 0);
    const totalExpense = Math.abs(expenses.reduce((total, r) => total + Number(r.amount || 0), 0));

    return {
      plannedPayments: sumPayments(planned),
      partialPayments: sumPayments(partial),
      paidPayments: sumPayments(paid),
      totalPayments: sumPayments(payments),
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
    };
  }, [payments, financialRecords]);

  const filteredRecords = useMemo(() => {
    let result = financialRecords;

    if (filterType !== "all") {
      if (filterType === "income") {
        result = result.filter((r) => parseFloat(r.amount) >= 0);
      } else if (filterType === "expense") {
        result = result.filter((r) => parseFloat(r.amount) < 0);
      }
    }

    if (filterDateFrom) {
      result = result.filter((r) => r.date && new Date(r.date) >= new Date(filterDateFrom));
    }

    if (filterDateTo) {
      result = result.filter((r) => r.date && new Date(r.date) <= new Date(filterDateTo));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.description?.toLowerCase().includes(query) ||
          r.source?.toLowerCase().includes(query) ||
          r.note?.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [financialRecords, filterType, filterDateFrom, filterDateTo, searchQuery]);

  const formatRub = (value: number) =>
    value.toLocaleString("ru-RU", { style: "currency", currency: "RUB" });

  const formatDate = (date?: string | null) => {
    return date ? new Date(date).toLocaleDateString("ru-RU") : "—";
  };

  const getRecordTypeDisplay = (amount: string) => {
    return parseFloat(amount) >= 0 ? "Доход" : "Расход";
  };

  const getRecordTypeClass = (amount: string) => {
    return parseFloat(amount) >= 0 ? "record-income" : "record-expense";
  };

  return (
    <div className="finance-view">
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="stat-card">
          <p className="stat-label">Доходы</p>
          <p className="stat-value income">{formatRub(stats.totalIncome)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Расходы</p>
          <p className="stat-value expense">{formatRub(stats.totalExpense)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Баланс</p>
          <p className={`stat-value ${stats.netBalance >= 0 ? "positive" : "negative"}`}>
            {formatRub(stats.netBalance)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Оплачено платежей</p>
          <p className="stat-value">{formatRub(stats.paidPayments)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Поиск по описанию, источнику, категории..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <label>Тип</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
              <option value="all">Все</option>
              <option value="income">Доходы</option>
              <option value="expense">Расходы</option>
            </select>
          </div>

          <div className="filter-group">
            <label>С даты</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>По дату</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>

          <button onClick={() => {
            setFilterType("all");
            setFilterDateFrom("");
            setFilterDateTo("");
            setSearchQuery("");
          }} className="btn-reset">
            Сброс фильтров
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="records-table-section">
        <div className="table-header">
          <h3>Финансовые записи ({filteredRecords.length})</h3>
          {onAddRecord && (
            <button onClick={onAddRecord} className="btn-primary btn-sm">
              Добавить запись
            </button>
          )}
        </div>

        {filteredRecords.length > 0 ? (
          <table className="records-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Описание</th>
                <th>Сумма</th>
                <th>Источник</th>
                <th>Примечание</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className={getRecordTypeClass(record.amount)}>
                  <td className="date">{formatDate(record.date)}</td>
                  <td className="type">{getRecordTypeDisplay(record.amount)}</td>
                  <td className="description">{record.description || "—"}</td>
                  <td className="amount">
                    <strong>{formatRub(Math.abs(Number(record.amount)))}</strong>
                  </td>
                  <td className="source">
                    {record.source || "—"}
                  </td>
                  <td className="note">
                    {record.note || "—"}
                  </td>
                  <td className="actions">
                    {onDeleteRecord && (
                      <button
                        onClick={() => {
                          if (confirm("Вы уверены?")) {
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
            <p>Нет записей по выбранным фильтрам</p>
          </div>
        )}
      </div>

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

        .records-table-section {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border-bottom: 1px solid #e2e8f0;
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
      `}</style>
    </div>
  );
};
