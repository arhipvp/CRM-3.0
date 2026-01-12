import { request } from './request';

export interface NotificationSettings {
  telegram_enabled: boolean;
  notify_tasks: boolean;
  notify_deal_events: boolean;
  notify_deal_expected_close: boolean;
  notify_payment_due: boolean;
  notify_policy_expiry: boolean;
  remind_days: number[];
}

export interface TelegramStatus {
  linked: boolean;
  linked_at?: string | null;
}

export interface NotificationSettingsResponse {
  settings: NotificationSettings;
  telegram: TelegramStatus;
  bot_username?: string;
}

export interface TelegramLinkResponse {
  link_code: string;
  expires_at: string;
  deep_link?: string | null;
  bot_username?: string;
}

export async function fetchNotificationSettings(): Promise<NotificationSettingsResponse> {
  return request<NotificationSettingsResponse>('/notifications/settings/');
}

export async function updateNotificationSettings(
  payload: Partial<NotificationSettings>,
): Promise<NotificationSettingsResponse> {
  return request<NotificationSettingsResponse>('/notifications/settings/', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createTelegramLink(): Promise<TelegramLinkResponse> {
  return request<TelegramLinkResponse>('/notifications/telegram-link/', {
    method: 'POST',
  });
}

export async function unlinkTelegram(): Promise<{ linked: boolean }> {
  return request<{ linked: boolean }>('/notifications/telegram-unlink/', {
    method: 'POST',
  });
}
