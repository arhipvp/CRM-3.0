import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearTokens, getCurrentUser, hasStoredTokens } from '../../api';
import { useAuthBootstrap } from '../../hooks/useAuthBootstrap';

vi.mock('../../api', () => ({
  clearTokens: vi.fn(),
  getCurrentUser: vi.fn(),
  hasStoredTokens: vi.fn(),
}));

const mockedClearTokens = vi.mocked(clearTokens);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedHasStoredTokens = vi.mocked(hasStoredTokens);

const TestHarness: React.FC<{ loadData: () => Promise<void> }> = ({ loadData }) => {
  const { authLoading, currentUser, handleLoginSuccess, isAuthenticated } =
    useAuthBootstrap(loadData);

  if (authLoading) {
    return <div>loading</div>;
  }

  return (
    <div>
      <span>{isAuthenticated ? currentUser?.username : 'anon'}</span>
      <button type="button" onClick={() => void handleLoginSuccess()}>
        login
      </button>
    </div>
  );
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useAuthBootstrap', () => {
  it('returns unauthenticated state when there are no stored tokens', async () => {
    mockedHasStoredTokens.mockReturnValue(false);
    const loadData = vi.fn().mockResolvedValue(undefined);

    render(<TestHarness loadData={loadData} />);

    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument());
    expect(mockedGetCurrentUser).not.toHaveBeenCalled();
    expect(loadData).not.toHaveBeenCalled();
  });

  it('loads current user when tokens are present and authenticated', async () => {
    mockedHasStoredTokens.mockReturnValue(true);
    mockedGetCurrentUser.mockResolvedValue({
      id: 1,
      username: 'john',
      is_authenticated: true,
      user_roles: [],
      roles: ['Admin'],
      first_name: 'John',
      last_name: 'Doe',
    } as const);
    const loadData = vi.fn().mockResolvedValue(undefined);

    render(<TestHarness loadData={loadData} />);

    await waitFor(() => expect(screen.getByText('john')).toBeInTheDocument());
    expect(loadData).toHaveBeenCalledTimes(1);
  });

  it('clears tokens when backend reports unauthenticated user', async () => {
    mockedHasStoredTokens.mockReturnValue(true);
    mockedGetCurrentUser.mockResolvedValue({ is_authenticated: false } as const);
    const loadData = vi.fn().mockResolvedValue(undefined);

    render(<TestHarness loadData={loadData} />);

    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument());
    expect(mockedClearTokens).toHaveBeenCalled();
    expect(loadData).not.toHaveBeenCalled();
  });

  it('handles manual login success flow', async () => {
    mockedHasStoredTokens.mockReturnValue(false);
    mockedGetCurrentUser.mockResolvedValue({
      id: 2,
      username: 'maria',
      is_authenticated: true,
      user_roles: [],
      roles: ['Manager'],
      first_name: 'Maria',
      last_name: 'Stone',
    } as const);
    const loadData = vi.fn().mockResolvedValue(undefined);

    render(<TestHarness loadData={loadData} />);

    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => expect(screen.getByText('maria')).toBeInTheDocument());
    expect(loadData).toHaveBeenCalledTimes(1);
  });
});
