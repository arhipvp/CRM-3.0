import { useEffect, useMemo, useState } from 'react';

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
} from '../../../api';
import { useConfirm } from '../../../hooks/useConfirm';
import { formatErrorMessage } from '../../../utils/formatErrorMessage';

export const useSettingsController = () => {
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

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    success,
    telegramSettings,
    telegramLinked,
    telegramLinkedAt,
    telegramLink,
    telegramLoading,
    telegramSaving,
    telegramError,
    driveStatus,
    driveLoading,
    driveError,
    driveReconnectBusy,
    driveReconnectNotice,
    nextContactLeadDaysInput,
    setNextContactLeadDaysInput,
    setNextContactLeadDaysError,
    nextContactLeadDaysError,
    nextContactLeadDaysSaving,
    mailboxes,
    mailboxLoading,
    mailboxError,
    mailboxLocalPart,
    setMailboxLocalPart,
    mailboxDisplayName,
    setMailboxDisplayName,
    mailboxCreating,
    mailboxCreatedPassword,
    mailboxPasswordCopied,
    selectedMailboxId,
    mailMessages,
    mailMessagesLoading,
    deletingMailboxId,
    normalizedTelegramBotUsername,
    telegramBotLink,
    selectedMailbox,
    canViewNotifications,
    canViewIntegrations,
    canViewMail,
    driveStatusLabel,
    isDriveReconnectUser,
    handleSubmit,
    handleDriveRefresh,
    handleDriveReconnect,
    handleTelegramToggle,
    handleNextContactLeadDaysSave,
    handleUnlinkTelegram,
    handleGenerateTelegramCode,
    handleMailboxCreate,
    handleMailboxDelete,
    handleMailboxSelect,
    handleMailboxRefresh,
    handlePasswordCopy,
    ConfirmDialogRenderer,
  };
};
