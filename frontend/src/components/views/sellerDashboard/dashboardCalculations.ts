import type {
  SellerDashboardFinancialByCompanyTypeRow,
  SellerDashboardPaymentsByDay,
  SellerDashboardTasksByExecutor,
} from '../../../types';
import { RU_LOCALE } from '../../../utils/formatting';
import type { SellerDashboardFinancialSort } from '../hooks/useSellerDashboardController';

export const EXECUTOR_COLORS = [
  '#0284c7',
  '#0ea5e9',
  '#14b8a6',
  '#f97316',
  '#a855f7',
  '#e11d48',
  '#22c55e',
];

export type ChartPoint = { date: string; value: number };
export type ExecutorSeries = { id: string; name: string; color: string };
export type ExecutorPoint = { date: string; totals: Record<string, number> };
export type CalendarDay = {
  date: string;
  day: number;
  isInRange: boolean;
  isWeekend: boolean;
  policyExpirations: number;
  nextContacts: number;
};
export type FinancialCell = { income: number; expense: number; net: number; count: number };
export type FinancialCompanyRow = {
  companyKey: string;
  companyName: string;
  cells: Map<string, FinancialCell>;
  totals: FinancialCell;
};
export type FinancialTypeColumn = { typeKey: string; typeName: string };
export type FinancialMaxExpensePair = {
  companyName: string;
  typeName: string;
  expense: number;
  net: number;
  count: number;
};
export type FinancialMatrixResult = {
  rows: FinancialCompanyRow[];
  types: FinancialTypeColumn[];
  columnTotals: Map<string, FinancialCell>;
  grandTotals: FinancialCell;
  topCompanies: FinancialCompanyRow[];
  topTypes: Array<{ typeName: string; totals: FinancialCell }>;
  maxExpensePair: FinancialMaxExpensePair | null;
};

export const parseNumber = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null;
};
const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const addUtcDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
const weekdayIndex = (date: Date) => (date.getUTCDay() + 6) % 7;
export const UNKNOWN_GROUP_LABEL = 'Не указано';
export const createEmptyFinancialCell = (): FinancialCell => ({
  income: 0,
  expense: 0,
  net: 0,
  count: 0,
});
const appendFinancialCell = (target: FinancialCell, cell: FinancialCell) => {
  target.income += cell.income;
  target.expense += cell.expense;
  target.net += cell.net;
  target.count += cell.count;
};
export const isFinancialCellEmpty = (cell?: FinancialCell | null) =>
  !cell || (!cell.income && !cell.expense && !cell.net && !cell.count);
const compareLabels = (left: string, right: string) => {
  if (left === UNKNOWN_GROUP_LABEL && right !== UNKNOWN_GROUP_LABEL) return 1;
  if (left !== UNKNOWN_GROUP_LABEL && right === UNKNOWN_GROUP_LABEL) return -1;
  return left.localeCompare(right, RU_LOCALE);
};

export function buildDateRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];
  const days: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function buildCalendarDays(
  rangeStart: string,
  rangeEnd: string,
  policyExpirations: Map<string, number>,
  nextContacts: Map<string, number>,
): CalendarDay[] {
  const start = parseIsoDate(rangeStart);
  const end = parseIsoDate(rangeEnd);
  if (!start || !end || start > end) return [];
  const calendarEnd = addUtcDays(end, 6 - weekdayIndex(end));
  const days: CalendarDay[] = [];
  for (
    let cursor = addUtcDays(start, -weekdayIndex(start));
    cursor <= calendarEnd;
    cursor = addUtcDays(cursor, 1)
  ) {
    const date = formatIsoDate(cursor);
    days.push({
      date,
      day: cursor.getUTCDate(),
      isInRange: cursor >= start && cursor <= end,
      isWeekend: [5, 6].includes(weekdayIndex(cursor)),
      policyExpirations: policyExpirations.get(date) ?? 0,
      nextContacts: nextContacts.get(date) ?? 0,
    });
  }
  return days;
}

export function buildPaymentsSeries(
  rangeStart: string,
  rangeEnd: string,
  items: SellerDashboardPaymentsByDay[],
): ChartPoint[] {
  const values = new Map(items.map((item) => [item.date, parseNumber(item.total)]));
  return buildDateRange(rangeStart, rangeEnd).map((date) => ({
    date,
    value: values.get(date) ?? 0,
  }));
}

export function buildExecutorSeries(
  rangeStart: string,
  rangeEnd: string,
  items: SellerDashboardTasksByExecutor[],
) {
  const executors: ExecutorSeries[] = [];
  const executorMap = new Map<string, ExecutorSeries>();
  items.forEach((item) => {
    const id = item.executorId ?? 'unknown';
    if (!executorMap.has(id)) {
      const entry = {
        id,
        name: item.executorName || 'Неизвестный',
        color: EXECUTOR_COLORS[executorMap.size % EXECUTOR_COLORS.length],
      };
      executorMap.set(id, entry);
      executors.push(entry);
    }
  });
  const data: ExecutorPoint[] = buildDateRange(rangeStart, rangeEnd).map((date) => ({
    date,
    totals: Object.fromEntries(executors.map((executor) => [executor.id, 0])),
  }));
  const indexByDate = new Map(data.map((item, index) => [item.date, index]));
  items.forEach((item) => {
    const index = indexByDate.get(item.date);
    if (index !== undefined) {
      const id = item.executorId ?? 'unknown';
      data[index].totals[id] = (data[index].totals[id] ?? 0) + item.count;
    }
  });
  return { executors, data };
}

export function buildFinancialMatrix(
  financialRows: SellerDashboardFinancialByCompanyTypeRow[],
  search: string,
  hideZero: boolean,
  onlyWithData: boolean,
  sort: SellerDashboardFinancialSort,
): FinancialMatrixResult {
  const typeNames = new Map<string, string>();
  const rowsByCompany = new Map<string, FinancialCompanyRow>();
  const columnTotals = new Map<string, FinancialCell>();
  const grandTotals = createEmptyFinancialCell();
  financialRows.forEach((item) => {
    const companyName = item.insuranceCompanyName?.trim() || UNKNOWN_GROUP_LABEL;
    const typeName = item.insuranceTypeName?.trim() || UNKNOWN_GROUP_LABEL;
    const companyKey = item.insuranceCompanyId || `unknown-company:${companyName}`;
    const typeKey = item.insuranceTypeId || `unknown-type:${typeName}`;
    typeNames.set(typeKey, typeName);
    const row = rowsByCompany.get(companyKey) ?? {
      companyKey,
      companyName,
      cells: new Map<string, FinancialCell>(),
      totals: createEmptyFinancialCell(),
    };
    rowsByCompany.set(companyKey, row);
    const cell = {
      income: parseNumber(item.incomeTotal),
      expense: parseNumber(item.expenseTotal),
      net: parseNumber(item.netTotal),
      count: Number(item.recordsCount ?? 0),
    };
    row.cells.set(typeKey, cell);
    appendFinancialCell(row.totals, cell);
    const column = columnTotals.get(typeKey) ?? createEmptyFinancialCell();
    columnTotals.set(typeKey, column);
    appendFinancialCell(column, cell);
    appendFinancialCell(grandTotals, cell);
  });
  const allTypes = [...typeNames]
    .map(([typeKey, typeName]) => ({ typeKey, typeName }))
    .sort((a, b) => compareLabels(a.typeName, b.typeName));
  const baseRows = [...rowsByCompany.values()];
  const normalized = search.trim().toLocaleLowerCase(RU_LOCALE);
  let rows = baseRows.filter(
    (row) =>
      !normalized ||
      row.companyName.toLocaleLowerCase(RU_LOCALE).includes(normalized) ||
      allTypes.some(
        (type) =>
          row.cells.has(type.typeKey) &&
          type.typeName.toLocaleLowerCase(RU_LOCALE).includes(normalized),
      ),
  );
  let types = allTypes.filter(
    (type) =>
      !normalized ||
      type.typeName.toLocaleLowerCase(RU_LOCALE).includes(normalized) ||
      rows.some(
        (row) =>
          row.companyName.toLocaleLowerCase(RU_LOCALE).includes(normalized) &&
          row.cells.has(type.typeKey),
      ),
  );
  if (hideZero) {
    rows = rows.filter((row) => !isFinancialCellEmpty(row.totals));
    types = types.filter((type) => !isFinancialCellEmpty(columnTotals.get(type.typeKey)));
  }
  if (onlyWithData) {
    rows = rows.filter((row) =>
      types.some((type) => !isFinancialCellEmpty(row.cells.get(type.typeKey))),
    );
    types = types.filter((type) =>
      rows.some((row) => !isFinancialCellEmpty(row.cells.get(type.typeKey))),
    );
  }
  const value = (row: FinancialCompanyRow) =>
    sort.startsWith('net')
      ? row.totals.net
      : sort === 'income_desc'
        ? row.totals.income
        : sort === 'expense_desc'
          ? row.totals.expense
          : row.totals.count;
  rows = [...rows].sort((a, b) =>
    sort === 'alpha'
      ? compareLabels(a.companyName, b.companyName)
      : (sort === 'net_asc' ? value(a) - value(b) : value(b) - value(a)) ||
        compareLabels(a.companyName, b.companyName),
  );
  const finalizedRows = rows.map((row) => {
    const totals = createEmptyFinancialCell();
    types.forEach((type) => {
      const cell = row.cells.get(type.typeKey);
      if (cell) appendFinancialCell(totals, cell);
    });
    return { ...row, totals };
  });
  const finalizedColumns = new Map<string, FinancialCell>();
  types.forEach((type) => {
    const total = createEmptyFinancialCell();
    finalizedRows.forEach((row) => {
      const cell = row.cells.get(type.typeKey);
      if (cell) appendFinancialCell(total, cell);
    });
    finalizedColumns.set(type.typeKey, total);
  });
  const finalizedGrand = createEmptyFinancialCell();
  finalizedRows.forEach((row) => appendFinancialCell(finalizedGrand, row.totals));
  const topCompanies = [...baseRows]
    .filter((row) => !isFinancialCellEmpty(row.totals))
    .sort((a, b) => b.totals.net - a.totals.net || compareLabels(a.companyName, b.companyName))
    .slice(0, 3);
  const topTypes = allTypes
    .map((type) => ({
      typeName: type.typeName,
      totals: columnTotals.get(type.typeKey) ?? createEmptyFinancialCell(),
    }))
    .filter((item) => !isFinancialCellEmpty(item.totals))
    .sort((a, b) => b.totals.net - a.totals.net || compareLabels(a.typeName, b.typeName))
    .slice(0, 3);
  let maxExpensePair: FinancialMaxExpensePair | null = null;
  baseRows.forEach((row) =>
    row.cells.forEach((cell, typeKey) => {
      if (cell.expense && (!maxExpensePair || cell.expense > maxExpensePair.expense))
        maxExpensePair = {
          companyName: row.companyName,
          typeName: typeNames.get(typeKey) ?? UNKNOWN_GROUP_LABEL,
          expense: cell.expense,
          net: cell.net,
          count: cell.count,
        };
    }),
  );
  return {
    rows: finalizedRows,
    types,
    columnTotals: finalizedColumns,
    grandTotals: finalizedGrand,
    topCompanies,
    topTypes,
    maxExpensePair,
  };
}
