import React from 'react';

import { Button } from '../../common/Button';
import { EmptyState } from '../../common/EmptyState';
import { InlineAlert } from '../../common/InlineAlert';
import { Panel, SectionHeader } from '../../common/layoutPrimitives';
import type { useSettingsController } from './useSettingsController';

interface SettingsMailSectionProps {
  controller: ReturnType<typeof useSettingsController>;
}

export const SettingsMailSection: React.FC<SettingsMailSectionProps> = ({ controller }) => {
  const {
    canViewMail,
    mailboxError,
    mailboxLocalPart,
    setMailboxLocalPart,
    mailboxDisplayName,
    setMailboxDisplayName,
    mailboxCreating,
    handleMailboxCreate,
    mailboxCreatedPassword,
    handlePasswordCopy,
    mailboxPasswordCopied,
    mailboxLoading,
    mailboxes,
    selectedMailboxId,
    deletingMailboxId,
    handleMailboxSelect,
    handleMailboxDelete,
    handleMailboxRefresh,
    mailMessagesLoading,
    mailMessages,
    selectedMailbox,
  } = controller;

  return (
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
            Пароль для нового ящика: <span className="font-semibold">{mailboxCreatedPassword}</span>
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
  );
};
