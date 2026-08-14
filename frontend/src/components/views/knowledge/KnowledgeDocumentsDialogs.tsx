import React from 'react';

import { Modal } from '../../Modal';
import { ActionLink, Button } from '../../common/Button';
import { formatKnowledgeDateTime as formatDateTime } from '../knowledgeDocuments.utils';
import type { useKnowledgeDocumentsController } from './useKnowledgeDocumentsController';

interface KnowledgeDocumentsDialogsProps {
  controller: ReturnType<typeof useKnowledgeDocumentsController>;
}

export const KnowledgeDocumentsDialogs: React.FC<KnowledgeDocumentsDialogsProps> = ({
  controller,
}) => {
  const {
    isSessionsModalOpen,
    setIsSessionsModalOpen,
    handleCancelEditSession,
    newSessionTitle,
    setNewSessionTitle,
    handleCreateSession,
    selectedNotebookId,
    sessionsError,
    chatSessions,
    selectedSessionId,
    editingSessionId,
    editingSessionTitle,
    setEditingSessionTitle,
    handleSaveSessionTitle,
    setSelectedSessionId,
    handleStartEditSession,
    handleDeleteSession,
    isSourceModalOpen,
    sourceDetail,
    setIsSourceModalOpen,
    setSourceDetail,
    setSourceError,
    sourceLoading,
    sourceError,
  } = controller;

  return (
    <>
      {isSessionsModalOpen && (
        <Modal
          title="Сессии чата"
          onClose={() => {
            setIsSessionsModalOpen(false);
            handleCancelEditSession();
          }}
          size="md"
        >
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={newSessionTitle}
                onChange={(event) => setNewSessionTitle(event.target.value)}
                placeholder="Название новой сессии"
                className="field field-input"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon="plus"
                onClick={handleCreateSession}
                disabled={!selectedNotebookId}
              >
                Создать
              </Button>
            </div>
            {sessionsError && <div className={'ui-status-danger-text-xs'}>{sessionsError}</div>}
            <div className="space-y-2">
              {chatSessions.length === 0 && (
                <div className="text-sm text-slate-500">Сессий пока нет.</div>
              )}
              {chatSessions.map((session) => {
                const isSelected = session.id === selectedSessionId;
                const isEditing = session.id === editingSessionId;
                return (
                  <div
                    key={session.id}
                    className={`rounded-xl border p-3 space-y-2 ${
                      isSelected ? 'border-blue-200 bg-blue-50' : 'border-slate-200'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingSessionTitle}
                          onChange={(event) => setEditingSessionTitle(event.target.value)}
                          className="field field-input"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            icon="check"
                            onClick={handleSaveSessionTitle}
                          >
                            Сохранить
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon="close"
                            onClick={handleCancelEditSession}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {session.title || 'Без названия'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDateTime(session.updatedAt || session.createdAt)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedSessionId(session.id)}
                            >
                              Использовать
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleStartEditSession(session)}
                            >
                              Переименовать
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              icon="delete"
                              onClick={() => handleDeleteSession(session.id)}
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
      {isSourceModalOpen && (
        <Modal
          title={sourceDetail?.title || 'Источник'}
          onClose={() => {
            setIsSourceModalOpen(false);
            setSourceDetail(null);
            setSourceError(null);
          }}
          size="xl"
        >
          <div className="space-y-3">
            {sourceLoading && <div className="text-sm text-slate-500">Загрузка источника...</div>}
            {sourceError && <div className="text-sm text-rose-600">{sourceError}</div>}
            {!sourceLoading && !sourceError && (
              <>
                <div className="text-xs text-slate-500">
                  {formatDateTime(sourceDetail?.createdAt)}
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {sourceDetail?.content || 'Текст источника недоступен.'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sourceDetail?.fileUrl && (
                    <ActionLink
                      href={sourceDetail.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      variant="secondary"
                      size="sm"
                    >
                      Открыть файл
                    </ActionLink>
                  )}
                  {sourceDetail?.assetUrl && (
                    <ActionLink
                      href={sourceDetail.assetUrl}
                      target="_blank"
                      rel="noreferrer"
                      variant="secondary"
                      size="sm"
                    >
                      Оригинал
                    </ActionLink>
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
