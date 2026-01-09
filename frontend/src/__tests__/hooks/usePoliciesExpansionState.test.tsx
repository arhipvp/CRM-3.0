import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  POLICIES_PAYMENTS_EXPANDED_STORAGE_KEY,
  POLICIES_RECORDS_EXPANDED_STORAGE_KEY,
  usePoliciesExpansionState,
} from '../../hooks/usePoliciesExpansionState';

const Harness: React.FC = () => {
  const { paymentsExpanded, recordsExpandedAll, setPaymentsExpanded, setRecordsExpandedAll } =
    usePoliciesExpansionState();

  return (
    <div>
      <pre data-testid="payments">{JSON.stringify(paymentsExpanded)}</pre>
      <pre data-testid="records">{JSON.stringify(recordsExpandedAll)}</pre>
      <button type="button" onClick={() => setPaymentsExpanded({ a: true, b: false })}>
        setPayments
      </button>
      <button type="button" onClick={() => setRecordsExpandedAll(true)}>
        setRecords
      </button>
    </div>
  );
};

describe('usePoliciesExpansionState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('initializes from localStorage', () => {
    window.localStorage.setItem(
      POLICIES_PAYMENTS_EXPANDED_STORAGE_KEY,
      JSON.stringify({ a: true, b: 'nope', c: false }),
    );
    window.localStorage.setItem(POLICIES_RECORDS_EXPANDED_STORAGE_KEY, 'true');

    render(<Harness />);

    expect(screen.getByTestId('payments').textContent).toBe(
      JSON.stringify({ a: true, b: false, c: false }),
    );
    expect(screen.getByTestId('records').textContent).toBe('true');
  });

  it('persists changes to localStorage', async () => {
    render(<Harness />);

    const user = userEvent.setup();
    await user.click(screen.getByText('setPayments'));
    await user.click(screen.getByText('setRecords'));

    await waitFor(() => {
      expect(window.localStorage.getItem(POLICIES_PAYMENTS_EXPANDED_STORAGE_KEY)).toBe(
        JSON.stringify({ a: true, b: false }),
      );
      expect(window.localStorage.getItem(POLICIES_RECORDS_EXPANDED_STORAGE_KEY)).toBe('true');
    });
  });
});
