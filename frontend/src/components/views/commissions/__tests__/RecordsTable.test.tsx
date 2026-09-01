import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { IncomeExpenseRow } from '../RecordsTable';
import { RecordsTable } from '../RecordsTable';

const buildRow = (overrides: Partial<IncomeExpenseRow> = {}): IncomeExpenseRow => ({
  key: 'payment-1-record-1',
  payment: {
    id: 'payment-1',
    amount: '15000',
    scheduledDate: '2026-03-15',
    actualDate: null,
    financialRecords: [],
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  recordId: 'record-1',
  recordKind: 'income',
  recordAmount: 1500,
  paymentScheduledDate: '2026-03-15',
  policyId: 'policy-1',
  policyNumber: 'SYS123456',
  recordDate: null,
  ...overrides,
});

const renderTable = ({
  row = buildRow(),
  onToggleAllRecordsSort = vi.fn(),
  onToggleCommentSort = vi.fn(),
  getCommentSortLabel = () => 'не сортируется',
  getCommentSortIndicator = () => '↕',
  onRequestEditPolicy,
  isRecordAmountEditable = false,
  onRecordAmountChange = vi.fn(),
  viewMode = 'all',
  statementAmountDraft = { mode: 'rub' as const, value: '' },
  onStatementAmountChange = vi.fn(),
}: {
  row?: IncomeExpenseRow;
  onToggleAllRecordsSort?: (
    key: 'none' | 'payment' | 'paymentDate' | 'saldo' | 'comment' | 'amount',
  ) => void;
  onToggleCommentSort?: () => void;
  getCommentSortLabel?: () => string;
  getCommentSortIndicator?: () => string;
  onRequestEditPolicy?: (row: IncomeExpenseRow) => void;
  isRecordAmountEditable?: boolean;
  onRecordAmountChange?: (recordId: string, value: string) => void;
  viewMode?: 'all' | 'statements';
  statementAmountDraft?: { mode: 'rub' | 'percent'; value: string };
  onStatementAmountChange?: (value: string) => void;
} = {}) => {
  render(
    <RecordsTable
      isAttachStatementPaid={false}
      isSelectedStatementPaid={false}
      selectedStatement={
        viewMode === 'statements'
          ? {
              id: 'statement-1',
              name: 'Ведомость',
              statementType: 'income',
              status: 'draft',
              createdAt: '2026-03-01T00:00:00Z',
              updatedAt: '2026-03-01T00:00:00Z',
            }
          : undefined
      }
      viewMode={viewMode}
      selectedRecordIds={[]}
      selectableRecordIds={[]}
      allSelectableSelected={false}
      selectAllRef={{ current: null }}
      filteredRows={[row]}
      policiesById={new Map()}
      statementsById={new Map()}
      amountDrafts={{}}
      statementAmountDraft={statementAmountDraft}
      isApplyingStatementAmount={false}
      isAllRecordsLoading={false}
      isStatementRecordsLoading={false}
      isRecordAmountEditable={isRecordAmountEditable}
      canAttachSelectedAction={false}
      canRemoveSelectedAction={false}
      normalizeText={(value) => value ?? ''}
      canAttachRow={() => true}
      onAttachSelected={vi.fn()}
      onRemoveSelected={vi.fn()}
      onResetSelection={vi.fn()}
      onToggleSelectAll={vi.fn()}
      onToggleRecordSelection={vi.fn()}
      onOpenDeal={vi.fn()}
      onRequestEditPolicy={onRequestEditPolicy}
      onToggleAllRecordsSort={onToggleAllRecordsSort}
      getAllRecordsSortLabel={() => 'не сортируется'}
      getAllRecordsSortIndicator={() => '↕'}
      onToggleCommentSort={onToggleCommentSort}
      getCommentSortLabel={getCommentSortLabel}
      getCommentSortIndicator={getCommentSortIndicator}
      onToggleAmountSort={vi.fn()}
      getAmountSortLabel={() => 'не сортируется'}
      getAmountSortIndicator={() => '↕'}
      getPercentFromSaldo={() => '0'}
      getAbsoluteSaldoBase={() => 0}
      onRecordAmountChange={onRecordAmountChange}
      onRecordAmountBlur={vi.fn()}
      onToggleRecordAmountMode={vi.fn()}
      onStatementAmountChange={onStatementAmountChange}
      onToggleStatementAmountMode={vi.fn()}
      onApplyStatementAmount={vi.fn()}
    />,
  );
};

describe('RecordsTable', () => {
  it('renders scheduled payment date and toggles scheduled date sorting', () => {
    const onToggleAllRecordsSort = vi.fn();

    renderTable({ onToggleAllRecordsSort });

    expect(screen.getByText('15.03.2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Сортировать по дате платежа/i }));

    expect(onToggleAllRecordsSort).toHaveBeenCalledWith('paymentDate');
  });

  it('opens policy edit handler from policy number instead of copy action', () => {
    const onRequestEditPolicy = vi.fn();

    renderTable({ onRequestEditPolicy });

    fireEvent.click(screen.getByRole('button', { name: 'Редактировать полис SYS123456' }));

    expect(onRequestEditPolicy).toHaveBeenCalledWith(
      expect.objectContaining({ policyId: 'policy-1', policyNumber: 'SYS123456' }),
    );
  });

  it('renders policy number as plain text when row has no policy id', () => {
    const onRequestEditPolicy = vi.fn();

    renderTable({
      row: buildRow({ policyId: null, policyNumber: 'WITHOUT-ID' }),
      onRequestEditPolicy,
    });

    expect(screen.getByText('WITHOUT-ID')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Редактировать полис WITHOUT-ID' }),
    ).not.toBeInTheDocument();
  });

  it('highlights a row and normalizes a pasted amount', () => {
    const onRecordAmountChange = vi.fn();

    renderTable({ isRecordAmountEditable: true, onRecordAmountChange });

    const input = screen.getByDisplayValue('1500');
    fireEvent.focus(input);
    fireEvent.paste(input, { clipboardData: { getData: () => '1\u00a0234,56' } });

    expect(input.closest('tr')).toHaveClass('focus-within:bg-sky-200/90');
    expect(input.closest('tr')).toHaveClass('focus-within:[&>td]:!bg-sky-100');
    expect(onRecordAmountChange).toHaveBeenCalledWith('record-1', '1234.56');
  });

  it('normalizes a pasted amount for all statement records', () => {
    const onStatementAmountChange = vi.fn();

    renderTable({
      viewMode: 'statements',
      isRecordAmountEditable: true,
      onStatementAmountChange,
    });

    fireEvent.paste(screen.getByLabelText('Общая сумма для всей ведомости'), {
      clipboardData: { getData: () => '1,234.56' },
    });

    expect(onStatementAmountChange).toHaveBeenCalledWith('1234.56');
  });

  it('toggles comment sorting in statement mode and exposes its current order', () => {
    const onToggleCommentSort = vi.fn();

    renderTable({
      viewMode: 'statements',
      onToggleCommentSort,
      getCommentSortLabel: () => 'по возрастанию',
      getCommentSortIndicator: () => '↑',
    });

    const sortButton = screen.getByRole('button', {
      name: 'Сортировать по примечанию, текущий порядок по возрастанию',
    });
    expect(sortButton).toHaveTextContent('Примечание');
    expect(sortButton).toHaveTextContent('↑');

    fireEvent.click(sortButton);

    expect(onToggleCommentSort).toHaveBeenCalledOnce();
  });

  it('shows the operations that form the saldo in statement mode', () => {
    renderTable({
      viewMode: 'statements',
      row: buildRow({
        paymentPaidBalance: 80,
        paymentPaidEntries: [
          { amount: '100.00', date: '2026-08-05' },
          { amount: '-20.00', date: '2026-08-07' },
        ],
      }),
    });

    expect(screen.getByText('80,00 ₽')).toBeInTheDocument();
    expect(screen.getByText('Доход 100,00 ₽ · 05.08.2026')).toBeInTheDocument();
    expect(screen.getByText('Расход 20,00 ₽ · 07.08.2026')).toBeInTheDocument();
    expect(screen.queryByText('Операций нет')).not.toBeInTheDocument();
  });
});
