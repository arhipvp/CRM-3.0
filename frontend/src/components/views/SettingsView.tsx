import React, { useEffect, useState } from 'react';

import {
  changePassword,
  createTelegramLink,
  fetchNotificationSettings,
  unlinkTelegram,
  updateNotificationSettings,
  type NotificationSettings,
  type TelegramLinkResponse,
} from '../../api';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

export const SettingsView: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [telegramSettings, setTelegramSettings] = useState<NotificationSettings | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramLinkedAt, setTelegramLinkedAt] = useState<string | null>(null);
  const [telegramLink, setTelegramLink] = useState<TelegramLinkResponse | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramError, setTelegramError] = useState('');
  const telegramBotUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '').trim();
  const normalizedTelegramBotUsername = telegramBotUsername.replace(/^@/, '');
  const telegramBotLink = normalizedTelegramBotUsername
    ? `https://t.me/${normalizedTelegramBotUsername}`
    : '';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Заполните все поля для смены пароля.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Новый пароль и подтверждение не совпадают.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Пароль обновлен.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось обновить пароль.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      setTelegramLoading(true);
      setTelegramError('');
      try {
        const response = await fetchNotificationSettings();
        if (!mounted) {
          return;
        }
        setTelegramSettings(response.settings);
        setTelegramLinked(response.telegram?.linked ?? false);
        setTelegramLinkedAt(response.telegram?.linked_at ?? null);
      } catch (err) {
        if (mounted) {
          setTelegramError(formatErrorMessage(err, 'Не удалось загрузить Telegram-настройки.'));
        }
      } finally {
        if (mounted) {
          setTelegramLoading(false);
        }
      }
    };

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const applyTelegramSettings = (response: {
    settings: NotificationSettings;
    telegram?: { linked?: boolean; linked_at?: string | null };
  }) => {
    setTelegramSettings(response.settings);
    if (response.telegram) {
      setTelegramLinked(response.telegram.linked ?? false);
      setTelegramLinkedAt(response.telegram.linked_at ?? null);
    }
  };

  const handleTelegramToggle = async (field: keyof NotificationSettings, value: boolean) => {
    if (!telegramSettings) {
      return;
    }
    const previous = telegramSettings;
    setTelegramSettings({ ...telegramSettings, [field]: value });
    setTelegramSaving(true);
    setTelegramError('');
    try {
      const response = await updateNotificationSettings({ [field]: value });
      applyTelegramSettings(response);
    } catch (err) {
      setTelegramSettings(previous);
      setTelegramError(formatErrorMessage(err, 'Не удалось сохранить настройки.'));
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    setTelegramError('');
    setTelegramSaving(true);
    try {
      await unlinkTelegram();
      setTelegramLinked(false);
      setTelegramLinkedAt(null);
      setTelegramLink(null);
    } catch (err) {
      setTelegramError(formatErrorMessage(err, 'Не удалось отвязать Telegram.'));
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleGenerateTelegramCode = async () => {
    setTelegramError('');
    setTelegramSaving(true);
    try {
      const response = await createTelegramLink();
      setTelegramLink(response);
    } catch (err) {
      setTelegramError(formatErrorMessage(err, 'Не удалось получить код привязки.'));
    } finally {
      setTelegramSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Настройки</h2>
        <p className="text-sm text-slate-600 mt-2">
          Обновите пароль для доступа в систему. Используйте надежную комбинацию и не повторяйте
          старые пароли.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 p-6 space-y-4">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">Telegram-уведомления</h3>
          <p className="text-sm text-slate-600">
            Подключите Telegram и выберите события, по которым хотите получать уведомления.
          </p>
        </header>

        {telegramError && <p className="app-alert app-alert-danger">{telegramError}</p>}

        {telegramLoading ? (
          <p className="text-sm text-slate-500">Загружаем настройки Telegram...</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Статус: {telegramLinked ? 'Привязан' : 'Не привязан'}
                </p>
                {telegramLinkedAt && (
                  <p className="text-xs text-slate-500">
                    Привязан: {new Date(telegramLinkedAt).toLocaleString('ru-RU')}
                  </p>
                )}
                {telegramBotLink && (
                  <p className="text-xs text-slate-500">
                    Бот:{' '}
                    <a
                      href={telegramBotLink}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      @{normalizedTelegramBotUsername}
                    </a>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleGenerateTelegramCode}
                  disabled={telegramSaving}
                >
                  Получить код привязки
                </button>
                {telegramLinked && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleUnlinkTelegram}
                    disabled={telegramSaving}
                  >
                    Отвязать
                  </button>
                )}
              </div>
            </div>

            {telegramLink && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
                <p className="text-slate-700">
                  Код для /start: <span className="font-semibold">{telegramLink.link_code}</span>
                </p>
                {telegramLink.deep_link ? (
                  <a
                    href={telegramLink.deep_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-indigo-600 hover:text-indigo-700 hover:border-indigo-300"
                  >
                    Открыть бота с кодом
                  </a>
                ) : (
                  <p className="text-xs text-slate-500">
                    Откройте бота вручную и отправьте команду: /start {telegramLink.link_code}
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={telegramSettings?.telegram_enabled ?? false}
                  onChange={(event) =>
                    handleTelegramToggle('telegram_enabled', event.target.checked)
                  }
                  className="check"
                  disabled={telegramSaving}
                />
                Включить Telegram-уведомления
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={telegramSettings?.notify_tasks ?? false}
                  onChange={(event) => handleTelegramToggle('notify_tasks', event.target.checked)}
                  className="check"
                  disabled={telegramSaving}
                />
                Новые задачи
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={telegramSettings?.notify_deal_events ?? false}
                  onChange={(event) =>
                    handleTelegramToggle('notify_deal_events', event.target.checked)
                  }
                  className="check"
                  disabled={telegramSaving}
                />
                События по сделкам (статус/стадия)
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={telegramSettings?.notify_deal_expected_close ?? false}
                  onChange={(event) =>
                    handleTelegramToggle('notify_deal_expected_close', event.target.checked)
                  }
                  className="check"
                  disabled={telegramSaving}
                />
                Напоминания «Застраховать до»
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={telegramSettings?.notify_payment_due ?? false}
                  onChange={(event) =>
                    handleTelegramToggle('notify_payment_due', event.target.checked)
                  }
                  className="check"
                  disabled={telegramSaving}
                />
                Напоминания об оплате
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={telegramSettings?.notify_policy_expiry ?? false}
                  onChange={(event) =>
                    handleTelegramToggle('notify_policy_expiry', event.target.checked)
                  }
                  className="check"
                  disabled={telegramSaving}
                />
                Напоминания о заканчивающихся полисах
              </label>
              <p className="text-xs text-slate-500">
                Напоминания (сделки/платежи/полисы) отправляются за 5, 3 и 1 день до даты, а за &lt;3 дней добавляется «❗».
              </p>
            </div>
          </>
        )}
      </section>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {error && <p className="app-alert app-alert-danger">{error}</p>}
        {success && <p className="app-alert app-alert-success">{success}</p>}

        <div className="space-y-2">
          <label htmlFor="current-password" className="app-label">
            Текущий пароль
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            disabled={loading}
            required
            className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="new-password" className="app-label">
            Новый пароль
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={loading}
            required
            className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="app-label">
            Подтвердите новый пароль
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={loading}
            required
            className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div className="flex items-center justify-end pt-2">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Сохраняем...' : 'Обновить пароль'}
          </button>
        </div>
      </form>
    </div>
  );
};
