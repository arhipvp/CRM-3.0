import React from 'react';

import { FileUploadManager } from '../FileUploadManager';
import { ActionLink, Button } from '../common/Button';
import { InlineAlert } from '../common/InlineAlert';
import {
  collectKnowledgeReferenceItems as collectReferenceItems,
  formatKnowledgeDate as formatDate,
  formatKnowledgeDateTime as formatDateTime,
  renderKnowledgeAnswerWithCitations,
} from './knowledgeDocuments.utils';
import { KnowledgeDocumentsDialogs } from './knowledge/KnowledgeDocumentsDialogs';
import { useKnowledgeDocumentsController } from './knowledge/useKnowledgeDocumentsController';

export const KnowledgeDocumentsView: React.FC = () => {
  const controller = useKnowledgeDocumentsController();
  const {
    notebooks,
    selectedNotebookId,
    selectedNotebookName,
    setSelectedNotebookName,
    newNotebookName,
    setNewNotebookName,
    notebookError,
    isNotebookBusy,
    sortedSources,
    sourcesError,
    sourcesLoading,
    uploadTitle,
    setUploadTitle,
    chatSessions,
    selectedSessionId,
    setSelectedSessionId,
    sessionsError,
    setIsSessionsModalOpen,
    sessionsLoading,
    question,
    setQuestion,
    answer,
    citations,
    isAsking,
    askError,
    savedAnswers,
    savingAnswer,
    savedError,
    handleNotebookSelect,
    handleCreateNotebook,
    handleRenameNotebook,
    handleDeleteNotebook,
    handleUpload,
    handleDeleteSource,
    handleOpenSource,
    handleAsk,
    handleSaveAnswer,
    handleDeleteSavedAnswer,
    ConfirmDialogRenderer,
  } = controller;

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="app-panel space-y-6 p-6 shadow-none">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Библиотека полезной документации</h2>
          <p className="text-sm text-slate-500 mt-1">
            Управляйте блокнотами Open Notebook прямо из CRM: создавайте, загружайте файлы и
            задавайте вопросы.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-1 text-sm text-slate-600">
            Блокнот
            <select
              value={selectedNotebookId}
              onChange={handleNotebookSelect}
              className="field field-input"
              disabled={isNotebookBusy}
            >
              <option value="">Выберите блокнот</option>
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm text-slate-600">
            Название блока
            <input
              type="text"
              value={selectedNotebookName}
              onChange={(event) => setSelectedNotebookName(event.target.value)}
              placeholder="Название выбранного блокнота"
              className="field field-input"
              disabled={!selectedNotebookId || isNotebookBusy}
            />
          </label>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRenameNotebook}
              disabled={!selectedNotebookId || isNotebookBusy}
            >
              Сохранить название
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDeleteNotebook}
              disabled={!selectedNotebookId || isNotebookBusy}
            >
              Удалить блокнот
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={newNotebookName}
            onChange={(event) => setNewNotebookName(event.target.value)}
            placeholder="Название нового блокнота"
            className="field field-input"
            disabled={isNotebookBusy}
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleCreateNotebook}
            disabled={isNotebookBusy}
          >
            Создать блокнот
          </Button>
        </div>
        {notebookError && <InlineAlert>{notebookError}</InlineAlert>}
      </section>

      <section className="app-panel space-y-6 p-6 shadow-none">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Задать вопрос</h3>
          <p className="text-xs text-slate-500">Вопрос будет задан внутри выбранного блокнота.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[220px] space-y-1 text-sm text-slate-600">
            Сессия чата
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              className="field field-input"
              disabled={!selectedNotebookId || sessionsLoading}
            >
              <option value="">{sessionsLoading ? 'Загрузка сессий...' : 'Выберите сессию'}</option>
              {chatSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title || 'Без названия'}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsSessionsModalOpen(true)}
            disabled={!selectedNotebookId}
          >
            Сессии чата
          </Button>
          {sessionsError && <span className={'ui-status-danger-text-xs'}>{sessionsError}</span>}
        </div>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Например: Какие исключения есть в правилах?"
          rows={3}
          className="field field-input"
          disabled={isAsking || !selectedNotebookId}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAsk}
            disabled={isAsking || !selectedNotebookId}
          >
            {isAsking ? 'Отвечаем...' : 'Спросить'}
          </Button>
          {askError && <span className={'ui-status-danger-text-xs'}>{askError}</span>}
        </div>
        {answer && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 whitespace-pre-line space-y-3">
            <div className="text-blue-700">
              {renderKnowledgeAnswerWithCitations(answer, citations, handleOpenSource)}
            </div>
            {collectReferenceItems(answer, citations).length > 0 && (
              <div className="border-t border-slate-100 pt-2 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-700">Источники</div>
                {collectReferenceItems(answer, citations).map((item, index) => (
                  <div key={item.sourceId} className="flex flex-wrap gap-2">
                    <span className="text-slate-500">[{index + 1}]</span>
                    <Button
                      type="button"
                      className="text-blue-600 hover:text-blue-700"
                      onClick={() => handleOpenSource(item.sourceId)}
                    >
                      {item.title}
                    </Button>
                    {item.fileUrl && (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-slate-700"
                      >
                        Файл
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSaveAnswer}
                disabled={savingAnswer || !selectedNotebookId}
              >
                {savingAnswer ? 'Сохраняем...' : 'Сохранить ответ'}
              </Button>
              {savedError && <span className={'ui-status-danger-text-xs'}>{savedError}</span>}
            </div>
          </div>
        )}
      </section>

      <section className="app-panel shadow-none">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Сохранённые ответы</h3>
              <p className="text-xs text-slate-500">
                {savedAnswers.length} ответ{savedAnswers.length === 1 ? '' : 'ов'}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {savedError && <InlineAlert>{savedError}</InlineAlert>}
          {savedAnswers.length === 0 && (
            <div className={'ui-panel-muted-text'}>Пока нет сохранённых ответов.</div>
          )}
          {savedAnswers.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 shadow-sm"
            >
              <div className="text-xs text-slate-500">{formatDate(item.createdAt)}</div>
              <div className="text-sm font-semibold text-slate-900">{item.question}</div>
              <div className="text-sm text-slate-700 whitespace-pre-line">
                <span className="text-blue-700">
                  {renderKnowledgeAnswerWithCitations(
                    item.answer,
                    item.citations,
                    handleOpenSource,
                  )}
                </span>
              </div>
              {collectReferenceItems(item.answer, item.citations).length > 0 && (
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-700">Источники</div>
                  {collectReferenceItems(item.answer, item.citations).map((cite, index) => (
                    <div key={`${item.id}-${cite.sourceId}`} className="flex flex-wrap gap-2">
                      <span className="text-slate-500">[{index + 1}]</span>
                      <Button
                        type="button"
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => handleOpenSource(cite.sourceId)}
                      >
                        {cite.title}
                      </Button>
                      {cite.fileUrl && (
                        <a
                          href={cite.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-slate-700"
                        >
                          Файл
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteSavedAnswer(item.id)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="app-panel space-y-6 p-6 shadow-none">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Файлы блокнота</h3>
          <p className="text-xs text-slate-500">Загрузка файлов идёт напрямую в Open Notebook.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1 text-sm text-slate-600">
            Заголовок (пояснение)
            <input
              type="text"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="Название файла"
              className="field field-input"
              disabled={!selectedNotebookId}
            />
          </label>
        </div>
        <FileUploadManager onUpload={handleUpload} disabled={!selectedNotebookId} />
        {sourcesError && <InlineAlert>{sourcesError}</InlineAlert>}
        <div className="space-y-4">
          {sourcesLoading && (
            <div className="text-xs uppercase tracking-wide text-slate-400">Загрузка...</div>
          )}
          {sortedSources.length === 0 && !sourcesLoading && (
            <div className={'ui-panel-muted-text'}>Пока нет загруженных файлов.</div>
          )}
          {sortedSources.map((source) => (
            <div
              key={source.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {source.title || 'Без названия'}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateTime(source.createdAt)}</p>
                </div>
                {source.embedded !== null && (
                  <span className="text-xs text-slate-500">
                    {source.embedded ? 'Векторизирован' : 'Без эмбеддингов'}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {source.fileUrl ? (
                  <ActionLink
                    href={source.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="secondary"
                    size="sm"
                  >
                    Открыть файл
                  </ActionLink>
                ) : (
                  <span className="text-xs text-slate-400">Ссылка недоступна</span>
                )}
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteSource(source.id)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <KnowledgeDocumentsDialogs controller={controller} />
      <ConfirmDialogRenderer />
    </div>
  );
};
