import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NotificationProvider } from '../../../../contexts/NotificationProvider';
import type { IncomeExpenseRow } from '../RecordsTable';
import { RecordsTable } from '../RecordsTable';

const buildRow = (): IncomeExpenseRow => ({
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
  recordDate: null,
});

const renderTable = (onToggleAllRecordsSort = vi.fn()) => {
  render(
    <NotificationProvider>
      <RecordsTable
        isAttachStatementPaid={false}
        isSelectedStatementPaid={false}
        viewMode="all"
        selectedRecordIds={[]}
        selectableRecordIds={[]}
        allSelectableSelected={false}
        selectAllRef={{ current: null }}
        filteredRows={[buildRow()]}
        policiesById={new Map()}
        statementsById={new Map()}
        amountDrafts={{}}
        statementAmountDraft={{ mode: 'rub', value: '' }}
        isApplyingStatementAmount={false}
        isAllRecordsLoading={false}
        isStatementRecordsLoading={false}
        isRecordAmountEditable={false}
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
        onToggleAllRecordsSort={onToggleAllRecordsSort}
        getAllRecordsSortLabel={() => 'не сортируется'}
        getAllRecordsSortIndicator={() => '↕'}
        onToggleAmountSort={vi.fn()}
        getAmountSortLabel={() => 'не сортируется'}
        getAmountSortIndicator={() => '↕'}
        getPercentFromSaldo={() => '0'}
        getAbsoluteSaldoBase={() => 0}
        onRecordAmountChange={vi.fn()}
        onRecordAmountBlur={vi.fn()}
        onToggleRecordAmountMode={vi.fn()}
        onStatementAmountChange={vi.fn()}
        onToggleStatementAmountMode={vi.fn()}
        onApplyStatementAmount={vi.fn()}
      />
    </NotificationProvider>,
  );
};

describe('RecordsTable', () => {
  it('renders scheduled payment date and toggles scheduled date sorting', () => {
    const onToggleAllRecordsSort = vi.fn();

    renderTable(onToggleAllRecordsSort);

    expect(screen.getByText('15.03.2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Сортировать по дате платежа/i }));

    expect(onToggleAllRecordsSort).toHaveBeenCalledWith('paymentDate');
  });
});
