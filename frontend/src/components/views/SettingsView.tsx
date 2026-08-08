import React, { useEffect, useMemo, useState } from 'react';

import {
  changePassword,
  createDriveReconnect,
  createMailbox,
  createTelegramLink,
  deleteMailbox,
  fetchDriveStatus,
  fetchMailboxes,
  fetchMailboxMessages,
  fetchNotificationSettings,
  getCurrentUser,
  unlinkTelegram,
  updateNotificationSettings,
  type DriveStatus,
  type Mailbox,
  type MailboxMessage,
  type NotificationSettings,
  type TelegramLinkResponse,
} from '../../api';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { FORM_INPUT_DISABLED } from '../common/forms/formClassNames';
import { InlineAlert } from '../common/InlineAlert';
import { Panel, SectionHeader, StatusBadge } from '../common/layoutPrimitives';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { useConfirm } from '../../hooks/useConfirm';

export const SettingsView: React.FC = () => {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
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
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveError, setDriveError] = useState('');
  const [driveReconnectBusy, setDriveReconnectBusy] = useState(false);
  const [driveReconnectNotice, setDriveReconnectNotice] = useState('');
  const [canReconnectDrive, setCanReconnectDrive] = useState(false);
  const [capabilities, setCapabilities] = useState<string[]>([]);
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
  const [deletingMailboxId, setDeletingMailboxId] = useState<number | null>(null);
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
      setDriveLoading(true);
      setDriveError('');
      try {
        const [response, currentUser] = await Promise.all([
          fetchNotificationSettings(),
          getCurrentUser(),
        ]);
        if (!mounted) {
          return;
        }
        applyTelegramSettings(response);
        setDriveStatus(response.drive ?? null);
        setCapabilities(currentUser.capabilities ?? []);
        setCanReconnectDrive(
          (currentUser.capabilities ?? []).includes('drive.reconnect') &&
            Boolean(response.drive?.reconnect_available),
        );
      } catch (err) {
        if (mounted) {
          setTelegramError(formatErrorMessage(err, 'Не удалось загрузить Telegram-настройки.'));
          setDriveError(formatErrorMessage(err, 'Не удалось загрузить статус Google Drive.'));
        }
      } finally {
        if (mounted) {
          setTelegramLoading(false);
          setDriveLoading(false);
        }
      }
    };

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reconnectState = params.get('driveReconnect');
    const reconnectMessage = params.get('driveReconnectMessage');
    if (!reconnectState) {
      return;
    }

    const message =
      reconnectMessage && reconnectMessage.trim().length > 0
        ? reconnectMessage
        : reconnectState === 'success'
          ? 'Google Drive переподключён.'
          : 'Не удалось переподключить Google Drive.';
    if (reconnectState === 'success') {
      setDriveReconnectNotice(message);
      setDriveError('');
    } else {
      setDriveError(message);
      setDriveReconnectNotice('');
    }

    void (async () => {
      try {
        const response = await fetchDriveStatus();
        setDriveStatus(response.drive);
      } catch (err) {
        setDriveError(formatErrorMessage(err, message));
      } finally {
        setDriveLoading(false);
      }
    })();

    params.delete('driveReconnect');
    params.delete('driveReconnectMessage');
    const nextQuery = params.toString();
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
    );
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
    drive?: DriveStatus;
  }) => {
    setTelegramSettings(response.settings);
    setNextContactLeadDaysInput(String(response.settings.next_contact_lead_days ?? 90));
    if (response.drive) {
      setDriveStatus(response.drive);
    }
    if (response.telegram) {
      setTelegramLinked(response.telegram.linked ?? false);
      setTelegramLinkedAt(response.telegram.linked_at ?? null);
    }
  };

  const handleDriveRefresh = async () => {
    setDriveLoading(true);
    setDriveError('');
    try {
      const response = await fetchDriveStatus();
      setDriveStatus(response.drive);
    } catch (err) {
      setDriveError(formatErrorMessage(err, 'Не удалось обновить статус Google Drive.'));
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDriveReconnect = async () => {
    setDriveReconnectBusy(true);
    setDriveError('');
    setDriveReconnectNotice('');
    try {
      const response = await createDriveReconnect();
      window.location.assign(response.auth_url);
    } catch (err) {
      setDriveError(formatErrorMessage(err, 'Не удалось запустить перепривязку Google Drive.'));
      setDriveReconnectBusy(false);
    }
  };

  const isDriveReconnectUser = canReconnectDrive;
  const canViewNotifications = capabilities.includes('settings.notifications');
  const canViewIntegrations = capabilities.includes('settings.integrations');
  const canViewMail = capabilities.includes('settings.mail');
  const driveStatusLabel = (() => {
    switch (driveStatus?.status) {
      case 'connected':
        return 'Подключено';
      case 'needs_reconnect':
        return driveStatus.using_fallback
          ? 'Работаем через резервный service account'
          : 'Нужна перепривязка';
      case 'not_configured':
        return 'Не настроено';
      case 'error':
        return 'Ошибка проверки';
      default:
        return 'Неизвестно';
    }
  })();

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
    const confirmed = await confirm({
      title: 'Отвязать Telegram?',
      message: 'Telegram-уведомления перестанут приходить до повторной привязки.',
      confirmText: 'Отвязать',
      cancelText: 'Отмена',
      tone: 'danger',
    });
    if (!confirmed) return;
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
    const mailbox = mailboxes.find((item) => item.id === mailboxId);
    const confirmed = await confirm({
      title: 'Удалить почтовый ящик?',
      message: `Ящик ${mailbox?.email ?? ''} и доступ к его письмам будут удалены.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      tone: 'danger',
    });
    if (!confirmed) return;
    setDeletingMailboxId(mailboxId);
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
    } finally {
      setDeletingMailboxId(null);
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
    } catch {
      setMailboxPasswordCopied(false);
    }
  };

  return (
    <Panel padding="lg" className="space-y-6">
      <SectionHeader
        title="Настройки"
        description="Обновите пароль для доступа в систему. Используйте надежную комбинацию и не повторяйте старые пароли."
      />
      <nav aria-label="Разделы настроек" className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ['security-settings', 'Профиль', true],
            ['telegram-settings', 'Уведомления', canViewNotifications],
            ['drive-settings', 'Интеграции', canViewIntegrations],
            ['mail-settings', 'Почта', canViewMail],
          ] as Array<[string, string, boolean]>
        )
          .filter(([, , visible]) => visible)
          .map(([id, label]) => (
            <a key={id} href={`#${id}`} className="link-action rounded-lg px-2 py-1">
              {label}
            </a>
          ))}
      </nav>

      <Panel
        id="telegram-settings"
        as="section"
        padding="lg"
        variant="flat"
        className={`space-y-4 ${canViewNotifications ? '' : 'hidden'}`}
      >
        <SectionHeader
          title="Telegram-уведомления"
          description="Подключите Telegram и выберите события, по которым хотите получать уведомления."
        />

        {telegramError && <InlineAlert as="p">{telegramError}</InlineAlert>}

        {telegramLoading ? (
          <p className="text-sm text-slate-500">Загружаем настройки Telegram...</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">Статус:</span>{' '}
                  <StatusBadge tone={telegramLinked ? 'success' : 'neutral'}>
                    {telegramLinked ? 'Привязан' : 'Не привязан'}
                  </StatusBadge>
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
                <Button
                  onClick={handleGenerateTelegramCode}
                  variant="secondary"
                  disabled={telegramSaving}
                >
                  Получить код привязки
                </Button>
                {telegramLinked && (
                  <Button
                    onClick={handleUnlinkTelegram}
                    variant="outline"
                    disabled={telegramSaving}
                  >
                    Отвязать
                  </Button>
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
                    className="btn btn-secondary text-indigo-600 hover:border-indigo-300 hover:text-indigo-700"
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
                Напоминания «Крайний срок»
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
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">Следующий контакт</h3>
          <p className="mt-1 text-xs text-slate-500">
            Укажите, за сколько дней до выбранного события ставить следующий контакт по умолчанию.
          </p>
          {nextContactLeadDaysError && (
            <InlineAlert as="p" className="mt-3">
              {nextContactLeadDaysError}
            </InlineAlert>
          )}
          <div className="mt-3 max-w-xs space-y-2">
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
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              disabled={nextContactLeadDaysSaving || telegramLoading}
              className={FORM_INPUT_DISABLED}
            />
            <p className="text-xs text-slate-500">
              Минимум 1. Значение влияет на «Отложить до следующего контакта».
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        id="drive-settings"
        as="section"
        padding="lg"
        variant="flat"
        className={`space-y-4 ${canViewIntegrations ? '' : 'hidden'}`}
      >
        <SectionHeader
          title="Google Drive"
          description="Контролируйте состояние интеграции Drive и перепривязывайте OAuth без ручного SSH."
        />

        {driveError && <InlineAlert as="p">{driveError}</InlineAlert>}
        {driveReconnectNotice && (
          <InlineAlert as="p" tone="success">
            {driveReconnectNotice}
          </InlineAlert>
        )}

        {driveLoading ? (
          <p className="text-sm text-slate-500">Проверяем Google Drive...</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">Статус:</span>{' '}
                  <StatusBadge
                    tone={
                      driveStatus?.status === 'connected'
                        ? 'success'
                        : driveStatus?.status === 'error'
                          ? 'danger'
                          : driveStatus?.status === 'needs_reconnect'
                            ? 'warning'
                            : 'neutral'
                    }
                  >
                    {driveStatusLabel}
                  </StatusBadge>
                </p>
                <p className="text-xs text-slate-500">
                  Режим: {driveStatus?.auth_mode || 'неизвестно'}
                  {driveStatus?.active_auth_type
                    ? ` · активная авторизация: ${driveStatus.active_auth_type}`
                    : ''}
                </p>
                {driveStatus?.last_checked_at && (
                  <p className="text-xs text-slate-500">
                    Последняя проверка:{' '}
                    {new Date(driveStatus.last_checked_at).toLocaleString('ru-RU')}
                  </p>
                )}
                {driveStatus?.last_error_message && (
                  <p className="text-xs text-amber-700">
                    Причина: {driveStatus.last_error_message}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleDriveRefresh}
                  variant="outline"
                  disabled={driveLoading || driveReconnectBusy}
                >
                  Обновить статус
                </Button>
                {isDriveReconnectUser && driveStatus?.reconnect_available && (
                  <Button
                    onClick={handleDriveReconnect}
                    variant="primary"
                    disabled={driveReconnectBusy}
                  >
                    {driveReconnectBusy ? 'Переходим в Google...' : 'Переподключить Google Drive'}
                  </Button>
                )}
              </div>
            </div>

            {!isDriveReconnectUser && (
              <p className="text-xs text-slate-500">
                Персональная перепривязка OAuth доступна назначенному владельцу интеграции.
              </p>
            )}
            {driveStatus?.using_fallback && (
              <p className="text-xs text-slate-500">
                Основные файловые сценарии продолжают работать через service account, пока OAuth не
                будет перепривязан.
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel
        id="mail-settings"
        as="section"
        padding="lg"
        variant="flat"
        className={`space-y-4 ${canViewMail ? '' : 'hidden'}`}
      >
        <SectionHeader
          title="Почта"
          description="Создавайте почтовые ящики и просматривайте входящие письма прямо здесь."
        />

        {mailboxError && <InlineAlert as="p">{mailboxError}</InlineAlert>}

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
          <Button
            onClick={handleMailboxCreate}
            variant="primary"
            disabled={mailboxCreating || !mailboxLocalPart.trim()}
          >
            {mailboxCreating ? 'Создаём...' : 'Создать'}
          </Button>
        </div>

        {mailboxCreatedPassword && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex flex-wrap items-center justify-between gap-3">
            <div>
              Пароль для нового ящика:{' '}
              <span className="font-semibold">{mailboxCreatedPassword}</span>
            </div>
            <Button onClick={handlePasswordCopy} variant="secondary">
              {mailboxPasswordCopied ? 'Скопировано' : 'Скопировать'}
            </Button>
          </div>
        )}

        {mailboxLoading ? (
          <p className="text-sm text-slate-500">Загружаем ящики...</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Ваши ящики</p>
              {mailboxes.length === 0 ? (
                <EmptyState compact>Пока нет созданных ящиков.</EmptyState>
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
                        <Button
                          onClick={() => handleMailboxSelect(mailbox.id)}
                          variant="secondary"
                          size="sm"
                        >
                          Письма
                        </Button>
                        <Button
                          onClick={() => void handleMailboxDelete(mailbox.id)}
                          variant="outline"
                          size="sm"
                          disabled={deletingMailboxId === mailbox.id}
                        >
                          {deletingMailboxId === mailbox.id ? 'Удаляем...' : 'Удалить'}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">Входящие</p>
                <Button
                  onClick={handleMailboxRefresh}
                  variant="outline"
                  size="sm"
                  disabled={!selectedMailboxId || mailMessagesLoading}
                >
                  Обновить
                </Button>
              </div>
              {selectedMailboxId === null ? (
                <EmptyState compact>Выберите ящик, чтобы увидеть письма.</EmptyState>
              ) : mailMessagesLoading ? (
                <p className="text-sm text-slate-500">Загружаем письма...</p>
              ) : mailMessages.length === 0 ? (
                <EmptyState compact>Писем пока нет.</EmptyState>
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
      </Panel>

      <form id="security-settings" onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {error && <InlineAlert as="p">{error}</InlineAlert>}
        {success && (
          <InlineAlert as="p" tone="success">
            {success}
          </InlineAlert>
        )}

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
            className={FORM_INPUT_DISABLED}
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
            className={FORM_INPUT_DISABLED}
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
            className={FORM_INPUT_DISABLED}
          />
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Сохраняем...' : 'Обновить пароль'}
          </Button>
        </div>
      </form>
      <ConfirmDialogRenderer />
    </Panel>
  );
};
