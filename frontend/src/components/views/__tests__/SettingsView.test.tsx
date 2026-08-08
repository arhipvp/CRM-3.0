import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsView } from '../SettingsView';

const apiMocks = vi.hoisted(() => ({
  fetchNotificationSettings: vi.fn(),
  getCurrentUser: vi.fn(),
  fetchMailboxes: vi.fn(),
  deleteMailbox: vi.fn(),
  unlinkTelegram: vi.fn(),
  updateNotificationSettings: vi.fn(),
}));

vi.mock('../../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api')>();
  return {
    ...actual,
    changePassword: vi.fn(),
    createDriveReconnect: vi.fn(),
    createMailbox: vi.fn(),
    createTelegramLink: vi.fn(),
    deleteMailbox: apiMocks.deleteMailbox,
    fetchDriveStatus: vi.fn(),
    fetchMailboxes: apiMocks.fetchMailboxes,
    fetchMailboxMessages: vi.fn(),
    fetchNotificationSettings: apiMocks.fetchNotificationSettings,
    getCurrentUser: apiMocks.getCurrentUser,
    unlinkTelegram: apiMocks.unlinkTelegram,
    updateNotificationSettings: apiMocks.updateNotificationSettings,
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

  it('shows drive reconnect controls for the configured Drive owner', async () => {
    apiMocks.getCurrentUser.mockResolvedValue({
      id: 4,
      username: 'Vova',
      roles: ['Admin'],
      capabilities: [
        'settings.profile',
        'settings.notifications',
        'settings.mail',
        'settings.integrations',
        'settings.admin',
        'drive.reconnect',
      ],
    });

    render(<SettingsView />);

    expect(
      await screen.findByText(hasOwnText('Статус: Работаем через резервный service account')),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Переподключить Google Drive' }),
    ).toBeInTheDocument();
  });

  it('hides drive reconnect button for users without Drive owner capability', async () => {
    apiMocks.getCurrentUser.mockResolvedValue({
      id: 7,
      username: 'Other',
      roles: [],
      capabilities: [
        'settings.profile',
        'settings.notifications',
        'settings.mail',
        'settings.integrations',
      ],
    });

    render(<SettingsView />);

    expect(
      await screen.findByText(
        hasOwnText('Персональная перепривязка OAuth доступна назначенному владельцу интеграции.'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Переподключить Google Drive' }),
    ).not.toBeInTheDocument();
  });

  it('lets a regular authenticated user update next-contact lead days', async () => {
    apiMocks.getCurrentUser.mockResolvedValue({
      id: 7,
      username: 'seller',
      roles: [],
      capabilities: [
        'settings.profile',
        'settings.notifications',
        'settings.mail',
        'settings.integrations',
      ],
    });
    apiMocks.updateNotificationSettings.mockResolvedValue({
      settings: {
        next_contact_lead_days: 45,
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
      drive: null,
    });

    render(<SettingsView />);

    const input = await screen.findByLabelText('Дней до события');
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(apiMocks.updateNotificationSettings).toHaveBeenCalledWith({
        next_contact_lead_days: 45,
      }),
    );
  });

  it('shows safe mailbox error instead of raw html payload', async () => {
    apiMocks.getCurrentUser.mockResolvedValue({
      id: 4,
      username: 'Vova',
      roles: ['Admin'],
      capabilities: [
        'settings.profile',
        'settings.notifications',
        'settings.mail',
        'settings.integrations',
        'settings.admin',
      ],
    });
    apiMocks.fetchMailboxes.mockRejectedValue(
      new Error('<!doctype html><html><body><h1>Server Error (500)</h1></body></html>'),
    );

    render(<SettingsView />);

    expect(await screen.findByText('Не удалось загрузить почтовые ящики.')).toBeInTheDocument();
    expect(screen.queryByText(/<!doctype html>/i)).not.toBeInTheDocument();
  });

  it('requires confirmation before unlinking Telegram', async () => {
    apiMocks.getCurrentUser.mockResolvedValue({
      id: 4,
      username: 'Admin',
      roles: ['Admin'],
      capabilities: [
        'settings.profile',
        'settings.notifications',
        'settings.mail',
        'settings.integrations',
        'settings.admin',
      ],
    });
    apiMocks.fetchNotificationSettings.mockResolvedValue({
      settings: {
        next_contact_lead_days: 90,
        telegram_enabled: true,
        notify_tasks: true,
        notify_deal_events: true,
        notify_deal_expected_close: true,
        notify_payment_due: true,
        notify_policy_expiry: true,
        remind_days: [5, 3, 1],
        sber_login: '',
        has_sber_password: false,
      },
      telegram: { linked: true, linked_at: '2026-03-08T12:00:00Z' },
      drive: null,
    });
    apiMocks.unlinkTelegram.mockResolvedValue(undefined);

    render(<SettingsView />);

    fireEvent.click(await screen.findByRole('button', { name: 'Отвязать' }));
    expect(apiMocks.unlinkTelegram).not.toHaveBeenCalled();
    expect(await screen.findByText('Отвязать Telegram?')).toBeInTheDocument();

    const unlinkButtons = screen.getAllByRole('button', { name: 'Отвязать' });
    fireEvent.click(unlinkButtons[unlinkButtons.length - 1]);
    await waitFor(() => expect(apiMocks.unlinkTelegram).toHaveBeenCalledTimes(1));
  });

  it('requires confirmation before deleting a mailbox', async () => {
    apiMocks.getCurrentUser.mockResolvedValue({
      id: 4,
      username: 'Admin',
      roles: ['Admin'],
      capabilities: [
        'settings.profile',
        'settings.notifications',
        'settings.mail',
        'settings.integrations',
        'settings.admin',
      ],
    });
    apiMocks.fetchMailboxes.mockResolvedValue([
      { id: 11, email: 'sales@example.test', display_name: 'Продажи' },
    ]);
    apiMocks.deleteMailbox.mockResolvedValue(undefined);

    render(<SettingsView />);

    fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
    expect(apiMocks.deleteMailbox).not.toHaveBeenCalled();
    expect(await screen.findByText('Удалить почтовый ящик?')).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button', { name: 'Удалить' });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(apiMocks.deleteMailbox).toHaveBeenCalledWith(11));
  });
});
