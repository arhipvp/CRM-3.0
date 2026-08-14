import React from 'react';

import { Button } from '../common/Button';
import { FORM_INPUT_DISABLED } from '../common/forms/formClassNames';
import { InlineAlert } from '../common/InlineAlert';
import {
  PageHeader,
  PageShell,
  Panel,
  SectionHeader,
  StatusBadge,
} from '../common/layoutPrimitives';
import { SettingsMailSection } from './settings/SettingsMailSection';
import { useSettingsController } from './settings/useSettingsController';

export const SettingsView: React.FC = () => {
  const controller = useSettingsController();
  const {
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
    normalizedTelegramBotUsername,
    telegramBotLink,
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
    ConfirmDialogRenderer,
  } = controller;

  return (
    <PageShell>
      <PageHeader
        title="Настройки"
        description="Профиль, уведомления и подключения внешних сервисов"
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
                  icon="refresh"
                  disabled={driveLoading || driveReconnectBusy}
                >
                  Обновить статус
                </Button>
                {isDriveReconnectUser && driveStatus?.reconnect_available && (
                  <Button
                    onClick={handleDriveReconnect}
                    variant="primary"
                    icon="arrowRight"
                    iconPosition="end"
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

      <SettingsMailSection controller={controller} />

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
          <Button type="submit" variant="primary" icon="check" disabled={loading}>
            {loading ? 'Сохраняем...' : 'Обновить пароль'}
          </Button>
        </div>
      </form>
      <ConfirmDialogRenderer />
    </PageShell>
  );
};
