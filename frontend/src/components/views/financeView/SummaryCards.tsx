import React from 'react';

export interface FinanceStats {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  paidPayments: number;
}

interface SummaryCardsProps {
  stats: FinanceStats;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ stats }) => (
  <div className="summary-cards">
    <div className="stat-card">
      <p className="stat-label">Доходы</p>
      <p className="stat-value income">{stats.totalIncome.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</p>
    </div>
    <div className="stat-card">
      <p className="stat-label">Расходы</p>
      <p className="stat-value expense">{stats.totalExpense.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</p>
    </div>
    <div className="stat-card">
      <p className="stat-label">Баланс</p>
      <p className={`stat-value ${stats.netBalance >= 0 ? 'positive' : 'negative'}`}>
        {stats.netBalance.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
      </p>
    </div>
    <div className="stat-card">
      <p className="stat-label">Оплачено</p>
      <p className="stat-value">{stats.paidPayments.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</p>
    </div>
  </div>
);
