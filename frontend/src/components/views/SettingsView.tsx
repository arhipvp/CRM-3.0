import React, { useEffect, useMemo, useState } from 'react';

import {
  changePassword,
  createMailbox,
  createTelegramLink,
  deleteMailbox,
  fetchMailboxes,
  fetchMailboxMessages,
  fetchNotificationSettings,
  unlinkTelegram,
  updateNotificationSettings,
  type Mailbox,
  type MailboxMessage,
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
  const [nextContactLeadDaysInput, setNextContactLeadDaysInput] = useState('');
  const [nextContactLeadDaysError, setNextContactLeadDaysError] = useState('');
  const [nextContactLeadDaysSaving, setNextContactLeadDaysSaving] = useState(false);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailboxLoading, setMailboxLoading] = useState(true);
  const [mailboxError, setMailboxError] = useState('');
  const [mailboxLocalPart, setMailboxLocalPart] = useState('');
  const [mailboxDisplayName, setMailboxDisplayName] = useState('');
  const [mailboxCreating, setMailboxCreating] = useState(false);
  const [mailboxCreatedPassword, setMailboxCreatedPassword] = useState<string | null>(null);
  const [mailboxPasswordCopied, setMailboxPasswordCopied] = useState(false);
  const [selectedMailboxId, setSelectedMailboxId] = useState<number | null>(null);
  const [mailMessages, setMailMessages] = useState<MailboxMessage[]>([]);
  const [mailMessagesLoading, setMailMessagesLoading] = useState(false);
  const telegramBotUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '').trim();
  const normalizedTelegramBotUsername = telegramBotUsername.replace(/^@/, '');
  const telegramBotLink = normalizedTelegramBotUsername
    ? `https://t.me/${normalizedTelegramBotUsername}`
    : '';

  const selectedMailbox = useMemo(
    () => mailboxes.find((mailbox) => mailbox.id === selectedMailboxId) ?? null,
    [mailboxes, selectedMailboxId],
  );

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
        setNextContactLeadDaysInput(String(response.settings.next_contact_lead_days ?? 90));
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

  useEffect(() => {
    let mounted = true;
    const loadMailboxes = async () => {
      setMailboxLoading(true);
      setMailboxError('');
      try {
        const items = await fetchMailboxes();
        if (mounted) {
          setMailboxes(items);
        }
      } catch (err) {
        if (mounted) {
          setMailboxError(formatErrorMessage(err, 'Не удалось загрузить почтовые ящики.'));
        }
      } finally {
        if (mounted) {
          setMailboxLoading(false);
        }
      }
    };

    loadMailboxes();
    return () => {
      mounted = false;
    };
  }, []);

  const applyTelegramSettings = (response: {
    settings: NotificationSettings;
    telegram?: { linked?: boolean; linked_at?: string | null };
  }) => {
    setTelegramSettings(response.settings);
    setNextContactLeadDaysInput(String(response.settings.next_contact_lead_days ?? 90));
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

  const handleNextContactLeadDaysSave = async () => {
    if (!telegramSettings) {
      return;
    }
    const trimmed = nextContactLeadDaysInput.trim();
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setNextContactLeadDaysError('Введите целое число от 1.');
      return;
    }
    if (parsed === telegramSettings.next_contact_lead_days) {
      setNextContactLeadDaysError('');
      return;
    }
    setNextContactLeadDaysSaving(true);
    setNextContactLeadDaysError('');
    try {
      const response = await updateNotificationSettings({
        next_contact_lead_days: parsed,
      });
      applyTelegramSettings(response);
    } catch (err) {
      setNextContactLeadDaysInput(String(telegramSettings.next_contact_lead_days ?? 90));
      setNextContactLeadDaysError(formatErrorMessage(err, 'Не удалось сохранить настройки.'));
    } finally {
      setNextContactLeadDaysSaving(false);
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

  const handleMailboxCreate = async () => {
    const localPart = mailboxLocalPart.trim();
    if (!localPart) {
      setMailboxError('Введите имя ящика.');
      return;
    }
    setMailboxCreating(true);
    setMailboxError('');
    setMailboxCreatedPassword(null);
    setMailboxPasswordCopied(false);
    try {
      const mailbox = await createMailbox({
        local_part: localPart,
        display_name: mailboxDisplayName.trim() || undefined,
      });
      setMailboxes((prev) => [mailbox, ...prev]);
      setMailboxLocalPart('');
      setMailboxDisplayName('');
      if (mailbox.initial_password) {
        setMailboxCreatedPassword(mailbox.initial_password);
      }
      setSelectedMailboxId(mailbox.id);
      setMailMessages([]);
      setMailMessagesLoading(true);
      const response = await fetchMailboxMessages(mailbox.id, 20);
      setMailMessages(response.items ?? []);
    } catch (err) {
      setMailboxError(formatErrorMessage(err, 'Не удалось создать ящик.'));
    } finally {
      setMailboxCreating(false);
      setMailMessagesLoading(false);
    }
  };

  const handleMailboxDelete = async (mailboxId: number) => {
    setMailboxError('');
    try {
      await deleteMailbox(mailboxId);
      setMailboxes((prev) => prev.filter((item) => item.id !== mailboxId));
      if (selectedMailboxId === mailboxId) {
        setSelectedMailboxId(null);
        setMailMessages([]);
      }
    } catch (err) {
      setMailboxError(formatErrorMessage(err, 'Не удалось удалить ящик.'));
    }
  };

  const handleMailboxSelect = async (mailboxId: number) => {
    setSelectedMailboxId(mailboxId);
    setMailMessages([]);
    setMailMessagesLoading(true);
    setMailboxError('');
    try {
      const response = await fetchMailboxMessages(mailboxId, 20);
      setMailMessages(response.items ?? []);
    } catch (err) {
      setMailboxError(formatErrorMessage(err, 'Не удалось загрузить письма.'));
    } finally {
      setMailMessagesLoading(false);
    }
  };

  const handleMailboxRefresh = async () => {
    if (!selectedMailboxId) {
      return;
    }
    setMailMessagesLoading(true);
    setMailboxError('');
    try {
      const response = await fetchMailboxMessages(selectedMailboxId, 20);
      setMailMessages(response.items ?? []);
    } catch (err) {
      setMailboxError(formatErrorMessage(err, 'Не удалось загрузить письма.'));
    } finally {
      setMailMessagesLoading(false);
    }
  };

  const handlePasswordCopy = async () => {
    if (!mailboxCreatedPassword) {
      return;
    }
    try {
      await navigator.clipboard.writeText(mailboxCreatedPassword);
      setMailboxPasswordCopied(true);
      setTimeout(() => setMailboxPasswordCopied(false), 2000);
    } catch (err) {
      setMailboxPasswordCopied(false);
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
                Напоминания «Застраховать долг»
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
                Напоминания (сделки/платежи/полисы) отправляются за 5, 3 и 1 день до даты, а за
                &lt;3 дней добавляется «❗».
              </p>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-6 space-y-4">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">Почта</h3>
          <p className="text-sm text-slate-600">
            Создавайте почтовые ящики и просматривайте входящие письма прямо здесь.
          </p>
        </header>

        {mailboxError && <p className="app-alert app-alert-danger">{mailboxError}</p>}

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end">
          <div className="space-y-2">
            <label className="app-label">Имя ящика</label>
            <input
              type="text"
              value={mailboxLocalPart}
              onChange={(event) => setMailboxLocalPart(event.target.value)}
              placeholder="sales"
              className="field field-input"
              disabled={mailboxCreating}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (!mailboxCreating) {
                    handleMailboxCreate();
                  }
                }
              }}
            />
            <p className="text-xs text-slate-500">Будет создан адрес вида sales@zoom78.com.</p>
          </div>
          <div className="space-y-2">
            <label className="app-label">Имя пользователя</label>
            <input
              type="text"
              value={mailboxDisplayName}
              onChange={(event) => setMailboxDisplayName(event.target.value)}
              placeholder="Отдел продаж"
              className="field field-input"
              disabled={mailboxCreating}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (!mailboxCreating) {
                    handleMailboxCreate();
                  }
                }
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleMailboxCreate}
            disabled={mailboxCreating || !mailboxLocalPart.trim()}
          >
            {mailboxCreating ? 'Создаём...' : 'Создать'}
          </button>
        </div>

        {mailboxCreatedPassword && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex flex-wrap items-center justify-between gap-3">
            <div>
              Пароль для нового ящика:{' '}
              <span className="font-semibold">{mailboxCreatedPassword}</span>
            </div>
            <button type="button" className="btn btn-secondary" onClick={handlePasswordCopy}>
              {mailboxPasswordCopied ? 'Скопировано' : 'Скопировать'}
            </button>
          </div>
        )}

        {mailboxLoading ? (
          <p className="text-sm text-slate-500">Загружаем ящики...</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Ваши ящики</p>
              {mailboxes.length === 0 ? (
                <p className="text-sm text-slate-500">Пока нет созданных ящиков.</p>
              ) : (
                <ul className="space-y-2">
                  {mailboxes.map((mailbox) => (
                    <li
                      key={mailbox.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                        selectedMailboxId === mailbox.id
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{mailbox.email}</p>
                        {mailbox.display_name && (
                          <p className="text-xs text-slate-500">{mailbox.display_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleMailboxSelect(mailbox.id)}
                        >
                          Письма
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleMailboxDelete(mailbox.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">Входящие</p>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleMailboxRefresh}
                  disabled={!selectedMailboxId || mailMessagesLoading}
                >
                  Обновить
                </button>
              </div>
              {selectedMailboxId === null ? (
                <p className="text-sm text-slate-500">Выберите ящик, чтобы увидеть письма.</p>
              ) : mailMessagesLoading ? (
                <p className="text-sm text-slate-500">Загружаем письма...</p>
              ) : mailMessages.length === 0 ? (
                <p className="text-sm text-slate-500">Писем пока нет.</p>
              ) : (
                <ul className="space-y-2">
                  {mailMessages.map((message) => (
                    <li key={message.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">{message.date}</div>
                      <div className="text-sm font-semibold text-slate-900">{message.subject}</div>
                      <div className="text-xs text-slate-500">От: {message.from}</div>
                      {message.snippet && (
                        <p className="text-xs text-slate-600 mt-1">{message.snippet}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {selectedMailbox && (
                <p className="text-xs text-slate-500">
                  Ящик: <span className="font-medium">{selectedMailbox.email}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-6 space-y-4">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">Настройки сделок</h3>
          <p className="text-sm text-slate-600">
            Укажите, за сколько дней до выбранного события ставить следующий контакт по умолчанию.
          </p>
        </header>

        {nextContactLeadDaysError && (
          <p className="app-alert app-alert-danger">{nextContactLeadDaysError}</p>
        )}

        <div className="max-w-xs space-y-2">
          <label htmlFor="next-contact-lead-days" className="app-label">
            Дней до события
          </label>
          <input
            id="next-contact-lead-days"
            type="number"
            min={1}
            step={1}
            value={nextContactLeadDaysInput}
            onChange={(event) => {
              setNextContactLeadDaysInput(event.target.value);
              setNextContactLeadDaysError('');
            }}
            onBlur={handleNextContactLeadDaysSave}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
            disabled={nextContactLeadDaysSaving || telegramLoading}
            className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
          />
          <p className="text-xs text-slate-500">
            Минимум 1. Значение влияет на «Отложить до следующего контакта».
          </p>
        </div>
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
