import { request } from './request';

export interface NotificationSettings {
  next_contact_lead_days: number;
  telegram_enabled: boolean;
  notify_tasks: boolean;
  notify_deal_events: boolean;
  notify_deal_expected_close: boolean;
  notify_payment_due: boolean;
  notify_policy_expiry: boolean;
  remind_days: number[];
  sber_login: string;
  has_sber_password: boolean;
}

export interface TelegramStatus {
  linked: boolean;
  linked_at?: string | null;
}

export interface DriveStatus {
  status: string;
  auth_mode: string;
  using_fallback: boolean;
  reconnect_available: boolean;
  last_checked_at: string;
  last_error_code: string;
  last_error_message: string;
  active_auth_type: string;
}

export interface NotificationSettingsResponse {
  settings: NotificationSettings;
  telegram: TelegramStatus;
  bot_username?: string;
  drive?: DriveStatus;
}

export interface TelegramLinkResponse {
  link_code: string;
  expires_at: string;
  deep_link?: string | null;
  bot_username?: string;
}

export interface DriveReconnectResponse {
  auth_url: string;
}

export async function fetchNotificationSettings(): Promise<NotificationSettingsResponse> {
  return request<NotificationSettingsResponse>('/notifications/settings/');
}

export async function fetchDriveStatus(): Promise<{ drive: DriveStatus }> {
  return request<{ drive: DriveStatus }>('/notifications/settings/drive-status/');
}

export async function updateNotificationSettings(
  payload: Partial<NotificationSettings> & { sber_password?: string | null },
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

export async function createDriveReconnect(): Promise<DriveReconnectResponse> {
  return request<DriveReconnectResponse>('/notifications/settings/drive-reconnect/', {
    method: 'POST',
  });
}
