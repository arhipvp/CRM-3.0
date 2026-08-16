import React from 'react';
import { formatCurrencyRu } from '../../../utils/formatting';
import { Button } from '../../common/Button';
import { DateInput } from '../../common/forms/DateInput';
import { PageHeader } from '../../common/layoutPrimitives';
import {
  useSellerDashboardController,
  type SellerDashboardFinancialSort,
} from '../hooks/useSellerDashboardController';
import { parseNumber } from './dashboardCalculations';
import { LineChart, StackedBarChart } from './DashboardCharts';
import { FinancialCellView } from './FinancialCellView';
import { useSellerDashboardViewModel } from './useSellerDashboardViewModel';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

const calendarDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const formatCalendarDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return calendarDateFormatter.format(date);
};

export const SellerDashboardView: React.FC = () => {
  const {
    dashboard,
    isLoading,
    error,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    financialSearch,
    setFinancialSearch,
    financialSort,
    setFinancialSort,
    hideZeroRowsCols,
    setHideZeroRowsCols,
    showOnlyWithData,
    setShowOnlyWithData,
    resetFinancialControls,
    handleApply,
  } = useSellerDashboardController();

  const {
    calendarMax,
    calendarWeeks,
    executorSeries,
    financialMatrix,
    financialTotals,
    paymentsSeries,
    periodLabel,
    policies,
    policyDrilldownHref,
  } = useSellerDashboardViewModel({
    dashboard,
    financialSearch,
    hideZeroRowsCols,
    showOnlyWithData,
    financialSort,
  });

  return (
    <section aria-labelledby="sellerDashboardHeading" className="app-page pb-2">
      <PageHeader
        titleId="sellerDashboardHeading"
        eyebrow="Дашборд продавца"
        title="Продажи по дате начала полиса"
        description={periodLabel}
      />
      <div className="app-panel space-y-4 p-4 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <a
              href={policyDrilldownHref}
              aria-label="Открыть полисы выбранного периода"
              className="rounded-[var(--app-radius-md)] border border-blue-100 bg-blue-50 px-4 py-3 text-right transition hover:border-blue-300 hover:shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                Сумма оплаченных платежей
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatCurrencyRu(dashboard?.totalPaid ?? '0', '—')}
              </p>
            </a>
            <a
              href="/tasks?only_my_tasks=true"
              aria-label="Открыть текущие задачи"
              className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-white px-4 py-3 text-right shadow-sm transition hover:border-blue-300"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Текущие задачи
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {dashboard?.tasksCurrent ?? 0}
              </p>
            </a>
            <a
              href="/tasks?only_my_tasks=true&show_completed=true"
              aria-label="Открыть задачи, включая завершённые"
              className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-white px-4 py-3 text-right shadow-sm transition hover:border-blue-300"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Завершено задач
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {dashboard?.tasksCompleted ?? 0}
              </p>
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="app-label" htmlFor="sellerDashboardStart">
              Дата начала
            </label>
            <DateInput
              id="sellerDashboardStart"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="field field-input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="app-label" htmlFor="sellerDashboardEnd">
              Дата окончания
            </label>
            <DateInput
              id="sellerDashboardEnd"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="field field-input"
            />
          </div>
          <Button onClick={handleApply} variant="primary" size="sm" disabled={isLoading}>
            Показать
          </Button>
        </div>
        <p className="text-sm text-slate-600">
          Учитываются только полисы с датой начала в выбранном диапазоне и только оплаченные
          платежи.
        </p>
        {error && <div className="app-panel-muted px-4 py-3 text-sm text-rose-700">{error}</div>}
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="app-panel space-y-4 border-none p-6 shadow-none">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Оплаченные платежи по дням</h2>
            <p className="text-xs text-slate-500">Сумма оплат по фактической дате платежа</p>
          </div>
          {isLoading ? (
            <div className="app-panel-muted flex h-[190px] items-center justify-center text-sm text-slate-500">
              Загрузка данных...
            </div>
          ) : (
            <LineChart
              points={paymentsSeries}
              formatter={(value) => formatCurrencyRu(value, '—')}
            />
          )}
        </div>
        <div className="app-panel space-y-4 border-none p-6 shadow-none">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Завершенные задачи по дням</h2>
            <p className="text-xs text-slate-500">Только задачи по сделкам, где вы продавец</p>
          </div>
          {isLoading ? (
            <div className="app-panel-muted flex h-[190px] items-center justify-center text-sm text-slate-500">
              Загрузка данных...
            </div>
          ) : (
            <StackedBarChart points={executorSeries.data} executors={executorSeries.executors} />
          )}
          {!!executorSeries.executors.length && (
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              {executorSeries.executors.map((executor) => (
                <span
                  key={executor.id}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: executor.color }}
                  />
                  {executor.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="app-panel space-y-4 border-none p-6 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Финансовая аналитика</h2>
            <p className="text-xs text-slate-500">
              Доходы и расходы по проведенным финзаписям в полисах выбранного периода
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Проведено записей:{' '}
            <span className="font-semibold text-slate-700">{financialTotals.recordsCount}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Доходы</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatCurrencyRu(financialTotals.incomeTotal, '—')}
            </p>
          </div>
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Расходы</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatCurrencyRu(financialTotals.expenseTotal, '—')}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Чистая</p>
            <p
              className={`text-2xl font-semibold ${
                parseNumber(financialTotals.netTotal) < 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {formatCurrencyRu(financialTotals.netTotal, '—')}
            </p>
          </div>
        </div>

        <div className="app-panel-muted p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto_auto_auto]">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="financialMatrixSearch"
                className="text-xs font-semibold text-slate-500"
              >
                Поиск по СК и виду
              </label>
              <input
                id="financialMatrixSearch"
                type="search"
                value={financialSearch}
                onChange={(event) => setFinancialSearch(event.target.value)}
                placeholder="Например: РЕСО, КАСКО"
                className="field field-input"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="financialMatrixSort" className="text-xs font-semibold text-slate-500">
                Сортировка
              </label>
              <select
                id="financialMatrixSort"
                className="field field-select"
                value={financialSort}
                onChange={(event) =>
                  setFinancialSort(event.target.value as SellerDashboardFinancialSort)
                }
              >
                <option value="net_desc">Чистая (убыв.)</option>
                <option value="net_asc">Чистая (возр.)</option>
                <option value="income_desc">Доход (убыв.)</option>
                <option value="expense_desc">Расход (убыв.)</option>
                <option value="count_desc">Записей (убыв.)</option>
                <option value="alpha">Алфавит</option>
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={hideZeroRowsCols}
                onChange={(event) => setHideZeroRowsCols(event.target.checked)}
                className="check"
              />
              Скрыть пустые строки и колонки
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={showOnlyWithData}
                onChange={(event) => setShowOnlyWithData(event.target.checked)}
                className="check"
              />
              Только ячейки с данными
            </label>
            <Button
              type="button"
              className="field field-input text-sm font-medium"
              onClick={resetFinancialControls}
            >
              Сбросить фильтры
            </Button>
          </div>
        </div>

        {!isLoading && Boolean(dashboard?.financialByCompanyType.length) && (
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Топ-3 СК по чистой
              </p>
              <div className="mt-2 space-y-1 text-sm">
                {financialMatrix.topCompanies.length ? (
                  financialMatrix.topCompanies.map((company, index) => (
                    <div
                      key={company.companyKey}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-slate-600">
                        {index + 1}. {company.companyName}
                      </span>
                      <span
                        className={
                          company.totals.net < 0
                            ? 'font-semibold text-rose-700'
                            : 'font-semibold text-slate-900'
                        }
                      >
                        {formatCurrencyRu(company.totals.net, '—')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">Нет данных</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Топ-3 видов по чистой
              </p>
              <div className="mt-2 space-y-1 text-sm">
                {financialMatrix.topTypes.length ? (
                  financialMatrix.topTypes.map((typeRow, index) => (
                    <div key={typeRow.typeName} className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">
                        {index + 1}. {typeRow.typeName}
                      </span>
                      <span
                        className={
                          typeRow.totals.net < 0
                            ? 'font-semibold text-rose-700'
                            : 'font-semibold text-slate-900'
                        }
                      >
                        {formatCurrencyRu(typeRow.totals.net, '—')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">Нет данных</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Наибольший расход
              </p>
              {financialMatrix.maxExpensePair ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="font-semibold text-slate-900">
                    {financialMatrix.maxExpensePair.companyName}
                  </p>
                  <p className="text-slate-600">{financialMatrix.maxExpensePair.typeName}</p>
                  <p className="font-semibold text-rose-700">
                    {formatCurrencyRu(financialMatrix.maxExpensePair.expense, '—')}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Нет данных</p>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="app-panel-muted flex h-[240px] items-center justify-center text-sm text-slate-500">
            Загрузка данных...
          </div>
        ) : !dashboard?.financialByCompanyType.length ? (
          <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
            Нет проведенных финансовых записей за выбранный период.
          </div>
        ) : !(
            financialMatrix.rows.length > 0 &&
            (financialMatrix.types.length > 0 || !showOnlyWithData)
          ) ? (
          <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
            По текущим фильтрам данных нет. Сбросьте фильтры.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Страховая компания
                  </th>
                  {financialMatrix.types.map((typeColumn) => (
                    <th
                      key={typeColumn.typeKey}
                      className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {typeColumn.typeName}
                    </th>
                  ))}
                  <th className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Итого по СК
                  </th>
                </tr>
              </thead>
              <tbody>
                {financialMatrix.rows.map((companyRow, index) => (
                  <tr
                    key={companyRow.companyKey}
                    className={`align-top ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                  >
                    <td
                      className={`sticky left-0 z-10 border-b border-slate-100 px-3 py-3 text-sm font-semibold text-slate-700 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                      }`}
                    >
                      {companyRow.companyName}
                    </td>
                    {financialMatrix.types.map((typeColumn) => (
                      <td
                        key={`${companyRow.companyKey}-${typeColumn.typeKey}`}
                        className="border-b border-slate-100 px-3 py-3"
                      >
                        <FinancialCellView
                          cell={companyRow.cells.get(typeColumn.typeKey)}
                          showEmptyPlaceholder={!showOnlyWithData}
                        />
                      </td>
                    ))}
                    <td className="border-b border-slate-200 bg-slate-100 px-3 py-3">
                      <FinancialCellView cell={companyRow.totals} />
                    </td>
                  </tr>
                ))}
                <tr className="align-top">
                  <td className="sticky left-0 z-10 border-t border-slate-400 bg-slate-100 px-3 py-3 text-sm font-semibold text-slate-900">
                    Итого по видам
                  </td>
                  {financialMatrix.types.map((typeColumn) => (
                    <td
                      key={`totals-${typeColumn.typeKey}`}
                      className="border-t border-slate-400 bg-slate-100 px-3 py-3"
                    >
                      <FinancialCellView
                        cell={financialMatrix.columnTotals.get(typeColumn.typeKey)}
                      />
                    </td>
                  ))}
                  <td className="border-t border-slate-400 bg-slate-200 px-3 py-3">
                    <FinancialCellView cell={financialMatrix.grandTotals} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="app-panel space-y-4 border-none p-6 shadow-none">
        <div className="ui-section-header">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Календарь нагрузки</h2>
            <p className="text-xs text-slate-500">
              Окончания полисов и следующие контакты по выбранному диапазону
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--app-danger-surface)] px-2 py-1 text-[var(--app-danger-text)]">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
              Окончания полисов
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--app-info-surface)] px-2 py-1 text-[var(--app-info-text)]">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
              Следующие контакты
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-2 py-1 text-sky-800">
              <span
                aria-hidden="true"
                className="h-2 w-8 rounded-full bg-gradient-to-r from-sky-50 to-sky-500"
              />
              Общая нагрузка: меньше → больше
            </span>
          </div>
        </div>
        {isLoading ? (
          <div className="app-panel-muted flex h-[260px] items-center justify-center text-sm text-slate-500">
            Загрузка данных...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-7 gap-2 text-xs text-slate-400">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label) => (
                <div key={label} className="text-center uppercase tracking-wide">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarWeeks.map((week, weekIndex) => (
                <React.Fragment key={`week-${weekIndex}`}>
                  {week.map((day) => {
                    const total = day.policyExpirations + day.nextContacts;
                    const isEmpty = total === 0;
                    const intensity = calendarMax > 0 ? clamp(total / calendarMax, 0, 1) : 0;
                    const heatmapColor =
                      day.isInRange && !isEmpty
                        ? `rgba(14, 165, 233, ${0.06 + intensity * 0.24})`
                        : undefined;
                    return (
                      <div
                        key={day.date}
                        title={`П: ${day.policyExpirations} / К: ${day.nextContacts}`}
                        className={`min-h-[132px] rounded-[var(--app-radius-md)] border px-3 py-3 text-sm ${
                          day.isInRange
                            ? isEmpty
                              ? 'border-slate-100 text-slate-400'
                              : 'border-[var(--app-border)] text-slate-700 shadow-sm'
                            : 'border-transparent text-slate-300'
                        }`}
                        style={{
                          backgroundColor: heatmapColor ?? '#f8fafc',
                        }}
                      >
                        <div
                          className={`flex items-center justify-between gap-2 ${
                            day.isWeekend ? 'text-rose-500' : 'text-slate-500'
                          }`}
                        >
                          <span className="font-semibold">{formatCalendarDate(day.date)}</span>
                          {total > 0 && (
                            <span
                              className="app-counter h-6 shrink-0 px-2 text-xs"
                              aria-label={`Всего: ${total}`}
                            >
                              Всего: {total}
                            </span>
                          )}
                        </div>
                        {total > 0 && (
                          <div className="mt-3 grid gap-1.5">
                            <div className="flex items-center justify-between gap-2 rounded-[var(--app-radius-sm)] bg-[var(--app-danger-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--app-danger-text)]">
                              <span>Окончания полисов</span>
                              <span className="text-sm">{day.policyExpirations}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 rounded-[var(--app-radius-sm)] bg-[var(--app-info-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--app-info-text)]">
                              <span>Контакты</span>
                              <span className="text-sm">{day.nextContacts}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="app-panel space-y-4 border-none p-6 shadow-none">
        <h2 className="text-sm font-semibold text-slate-700">Полисы выбранного периода</h2>
        {isLoading ? (
          <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
            Загрузка данных...
          </div>
        ) : policies.length === 0 ? (
          <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
            В этом периоде у вас нет полисов с началом в выбранном диапазоне.
          </div>
        ) : (
          <div className="text-sm text-slate-600">
            Всего полисов в диапазоне:{' '}
            <span className="font-semibold text-slate-900">{policies.length}</span>
          </div>
        )}
      </section>
    </section>
  );
};
