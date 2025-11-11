import React, { useMemo, useState } from "react";
import { Payment, FinancialTransaction } from "../../types";

interface FinanceViewProps {
  payments: Payment[];
  financialTransactions?: FinancialTransaction[];
  onAddTransaction?: () => void;
  onUpdateTransaction?: (id: string, data: Partial<FinancialTransaction>) => Promise<void>;
  onDeleteTransaction?: (id: string) => Promise<void>;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  payments,
  financialTransactions = [],
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const stats = useMemo(() => {
    const planned = payments.filter((p) => p.status === "planned");
    const partial = payments.filter((p) => p.status === "partial");
    const paid = payments.filter((p) => p.status === "paid");

    const incomes = financialTransactions.filter((t) => t.transactionType === "income");
    const expenses = financialTransactions.filter((t) => t.transactionType === "expense");

    const sum = (items: Payment[] | FinancialTransaction[]) =>
      items.reduce((total, item) => total + Number(item.amount || 0), 0);

    return {
      plannedPayments: sum(planned),
      partialPayments: sum(partial),
      paidPayments: sum(paid),
      totalPayments: sum(payments),
      totalIncome: sum(incomes),
      totalExpense: sum(expenses),
      netBalance: sum(incomes) - sum(expenses),
    };
  }, [payments, financialTransactions]);

  const filteredTransactions = useMemo(() => {
    let result = financialTransactions;

    if (filterType !== "all") {
      result = result.filter((t) => t.transactionType === filterType);
    }

    if (filterDateFrom) {
      result = result.filter((t) => new Date(t.transactionDate) >= new Date(filterDateFrom));
    }

    if (filterDateTo) {
      result = result.filter((t) => new Date(t.transactionDate) <= new Date(filterDateTo));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.description?.toLowerCase().includes(query) ||
          t.source?.toLowerCase().includes(query) ||
          t.category?.toLowerCase().includes(query) ||
          t.dealTitle?.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }, [financialTransactions, filterType, filterDateFrom, filterDateTo, searchQuery]);

  const formatRub = (value: number) =>
    value.toLocaleString("ru-RU", { style: "currency", currency: "RUB" });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ru-RU");
  };

  const getTransactionTypeDisplay = (type: string) => {
    return type === "income" ? "Доход" : "Расход";
  };

  const getTransactionTypeClass = (type: string) => {
    return type === "income" ? "transaction-income" : "transaction-expense";
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

      {/* Transactions Table */}
      <div className="transactions-table-section">
        <div className="table-header">
          <h3>Финансовые транзакции ({filteredTransactions.length})</h3>
          {onAddTransaction && (
            <button onClick={onAddTransaction} className="btn-primary btn-sm">
              Добавить транзакцию
            </button>
          )}
        </div>

        {filteredTransactions.length > 0 ? (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Описание</th>
                <th>Сумма</th>
                <th>Источник/Категория</th>
                <th>Сделка</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className={getTransactionTypeClass(transaction.transactionType)}>
                  <td className="date">{formatDate(transaction.transactionDate)}</td>
                  <td className="type">{getTransactionTypeDisplay(transaction.transactionType)}</td>
                  <td className="description">
                    {transaction.description || "-"}
                    {transaction.note && (
                      <div className="note-text">{transaction.note}</div>
                    )}
                  </td>
                  <td className="amount">
                    <strong>{formatRub(Number(transaction.amount))}</strong>
                  </td>
                  <td className="source-category">
                    <div>{transaction.source || "-"}</div>
                    <div className="category-tag">{transaction.category || "-"}</div>
                  </td>
                  <td className="deal-title">{transaction.dealTitle || "-"}</td>
                  <td className="actions">
                    {onDeleteTransaction && (
                      <button
                        onClick={() => {
                          if (confirm("Вы уверены?")) {
                            onDeleteTransaction(transaction.id);
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
            <p>Нет транзакций по выбранным фильтрам</p>
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

        .transactions-table-section {
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

        .transactions-table {
          width: 100%;
          border-collapse: collapse;
        }

        .transactions-table thead {
          background: #f8fafc;
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
        }

        .transactions-table th {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        .transactions-table td {
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
        }

        .transactions-table tbody tr:hover {
          background: #f8fafc;
        }

        .transactions-table .date {
          font-weight: 500;
        }

        .transactions-table .type {
          font-weight: 600;
        }

        .transactions-table .amount {
          text-align: right;
          font-weight: 600;
        }

        .transaction-income .amount {
          color: #16a34a;
        }

        .transaction-expense .amount {
          color: #dc2626;
        }

        .source-category {
          font-size: 13px;
        }

        .category-tag {
          background: #f1f5f9;
          color: #64748b;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          margin-top: 4px;
          display: inline-block;
        }

        .note-text {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
          font-style: italic;
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
