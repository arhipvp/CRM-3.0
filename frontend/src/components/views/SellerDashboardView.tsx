import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchSellerDashboard } from '../../api/policies';
import type { SellerDashboardResponse } from '../../types';
import { formatCurrencyRu, formatDateRu } from '../../utils/formatting';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  TABLE_CELL_CLASS_MD,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';

export const SellerDashboardView: React.FC = () => {
  const [dashboard, setDashboard] = useState<SellerDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadDashboard = useCallback(async (override?: { startDate?: string; endDate?: string }) => {
    setIsLoading(true);
    try {
      const payload = await fetchSellerDashboard(override);
      setDashboard(payload);
      setError(null);
      setStartDate((prev) => prev || payload.rangeStart || '');
      setEndDate((prev) => prev || payload.rangeEnd || '');
    } catch (err) {
      setDashboard(null);
      setError(formatErrorMessage(err, 'Ошибка загрузки дашборда.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const periodLabel = useMemo(() => {
    if (!dashboard?.rangeStart || !dashboard?.rangeEnd) {
      return 'Период';
    }
    return `Период: ${formatDateRu(dashboard.rangeStart)} — ${formatDateRu(dashboard.rangeEnd)}`;
  }, [dashboard?.rangeEnd, dashboard?.rangeStart]);

  const policies = dashboard?.policies ?? [];
  const totalPaid = dashboard?.totalPaid ?? '0';
  const isEmpty = !isLoading && policies.length === 0;

  const handleApply = useCallback(() => {
    void loadDashboard({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }, [endDate, loadDashboard, startDate]);

  return (
    <section aria-labelledby="sellerDashboardHeading" className="space-y-6">
      <div className="app-panel p-6 shadow-none space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Дашборд продавца
            </p>
            <h1 id="sellerDashboardHeading" className="text-2xl font-semibold text-slate-900">
              Продажи по дате начала полиса
            </h1>
            <p className="text-sm text-slate-600">{periodLabel}</p>
          </div>
          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
              Сумма оплаченных платежей
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatCurrencyRu(totalPaid, '—')}
            </p>
          </div>
        </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="app-label" htmlFor="sellerDashboardStart">
                Дата начала
              </label>
              <input
                id="sellerDashboardStart"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="field field-input"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="app-label" htmlFor="sellerDashboardEnd">
                Дата окончания
              </label>
              <input
                id="sellerDashboardEnd"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="field field-input"
              />
            </div>
          <button
            type="button"
            onClick={handleApply}
            className="btn btn-primary btn-sm rounded-xl"
            disabled={isLoading}
          >
            Показать
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Учитываются только полисы с датой начала в выбранном диапазоне и только оплаченные платежи.
        </p>
        {error && (
          <div className="app-panel-muted px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>

      <section className="app-panel p-6 shadow-none space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Полисы выбранного периода</h2>
        {isLoading ? (
          <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
            Загрузка данных...
          </div>
        ) : isEmpty ? (
          <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
            В этом периоде у вас нет полисов с началом в выбранном диапазоне.
          </div>
        ) : (
          <div className="app-panel shadow-none overflow-hidden">
            <div className="overflow-x-auto bg-white">
              <table className="deals-table w-full table-fixed border-collapse text-left text-sm">
                <thead className={TABLE_THEAD_CLASS}>
                  <tr>
                    <TableHeadCell padding="md" className="w-[20%]">Полис</TableHeadCell>
                    <TableHeadCell padding="md" className="w-[26%]">Клиент</TableHeadCell>
                    <TableHeadCell padding="md" className="w-[20%]">Дата начала</TableHeadCell>
                    <TableHeadCell padding="md" align="right" className="w-[20%]">
                      Оплачено
                    </TableHeadCell>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {policies.map((policy) => {
                    const clientLabel =
                      policy.insuredClientName ?? policy.clientName ?? '—';

                    return (
                      <tr key={policy.id} className={`${TABLE_ROW_CLASS} border-t border-slate-200`}>
                        <td className={TABLE_CELL_CLASS_MD}>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900 break-all">
                              {policy.number || '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {policy.insuranceCompany}
                            </p>
                          </div>
                        </td>
                        <td className={TABLE_CELL_CLASS_MD}>
                          <p className="text-sm font-semibold text-slate-900 break-words">{clientLabel}</p>
                          <p className="text-xs text-slate-500">{policy.insuranceType}</p>
                        </td>
                        <td className={TABLE_CELL_CLASS_MD}>
                          <p className="text-sm text-slate-700">{formatDateRu(policy.startDate)}</p>
                        </td>
                        <td className={`${TABLE_CELL_CLASS_MD} text-right`}>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrencyRu(policy.paidAmount, '—')}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </section>
  );
};
