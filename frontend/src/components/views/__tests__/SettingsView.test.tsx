import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsView } from '../SettingsView';

const apiMocks = vi.hoisted(() => ({
  fetchNotificationSettings: vi.fn(),
  getCurrentUser: vi.fn(),
  fetchMailboxes: vi.fn(),
}));

vi.mock('../../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api')>();
  return {
    ...actual,
    changePassword: vi.fn(),
    createDriveReconnect: vi.fn(),
    createMailbox: vi.fn(),
    createTelegramLink: vi.fn(),
    deleteMailbox: vi.fn(),
    fetchDriveStatus: vi.fn(),
    fetchMailboxes: apiMocks.fetchMailboxes,
    fetchMailboxMessages: vi.fn(),
    fetchNotificationSettings: apiMocks.fetchNotificationSettings,
    getCurrentUser: apiMocks.getCurrentUser,
    unlinkTelegram: vi.fn(),
    updateNotificationSettings: vi.fn(),
  };
});

const hasOwnText = (value: string) => (_content: string, element: Element | null) => {
  if (!element || !element.textContent?.includes(value)) {
    return false;
  }
  return Array.from(element.children).every((child) => !child.textContent?.includes(value));
};

describe('SettingsView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMocks.fetchMailboxes.mockResolvedValue([]);
    apiMocks.fetchNotificationSettings.mockResolvedValue({
      settings: {
        next_contact_lead_days: 90,
        telegram_enabled: false,
        notify_tasks: true,
        notify_deal_events: true,
        notify_deal_expected_close: true,
        notify_payment_due: true,
        notify_policy_expiry: true,
        remind_days: [5, 3, 1],
        sber_login: '',
        has_sber_password: false,
      },
      telegram: { linked: false, linked_at: null },
      drive: {
        status: 'needs_reconnect',
        auth_mode: 'auto',
        using_fallback: true,
        reconnect_available: true,
        last_checked_at: '2026-03-08T12:00:00Z',
        last_error_code: 'oauth_refresh_revoked',
        last_error_message: 'Token has been expired or revoked.',
        active_auth_type: 'service_account',
      },
    });
  });

  it('shows drive reconnect controls for Vova', async () => {
    apiMocks.getCurrentUser.mockResolvedValue({ id: 4, username: 'Vova', roles: ['Admin'] });

    render(<SettingsView />);

    expect(
      await screen.findByText(hasOwnText('Статус: Работаем через резервный service account')),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Переподключить Google Drive' }),
    ).toBeInTheDocument();
  });

  it('hides drive reconnect button for non-vova users', async () => {
    apiMocks.getCurrentUser.mockResolvedValue({ id: 7, username: 'Other', roles: [] });

    render(<SettingsView />);

    expect(
      await screen.findByText(
        hasOwnText('Персональная перепривязка OAuth доступна только для пользователя Vova.'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Переподключить Google Drive' }),
    ).not.toBeInTheDocument();
  });

  it('shows safe mailbox error instead of raw html payload', async () => {
    apiMocks.getCurrentUser.mockResolvedValue({ id: 4, username: 'Vova', roles: ['Admin'] });
    apiMocks.fetchMailboxes.mockRejectedValue(
      new Error('<!doctype html><html><body><h1>Server Error (500)</h1></body></html>'),
    );

    render(<SettingsView />);

    expect(await screen.findByText('Не удалось загрузить почтовые ящики.')).toBeInTheDocument();
    expect(screen.queryByText(/<!doctype html>/i)).not.toBeInTheDocument();
  });
});
