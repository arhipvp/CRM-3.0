import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  aiDocumentPageFragment,
  createAiConversation,
  deleteAiDocument,
  fetchAiCatalog,
  fetchAiConversations,
  fetchAiDocumentContent,
  fetchAiDocuments,
  fetchAiMessages,
  fetchAiProviders,
  streamAiAnswer,
  updateAiDocumentClassification,
  updateAiConversationModel,
  updateAiConversationScope,
  uploadAiDocuments,
  type AiCatalog,
  type AiClassification,
  type AiConversation,
  type AiDocument,
  type AiMessage,
  type AiProvider,
  type AiScopeBranch,
} from '../../api/aiAssistant';
import { AiChatMessage } from './aiAssistant/AiChatMessage';
import { ClassificationFields } from './aiAssistant/ClassificationFields';
import { AiLibraryTree } from './aiAssistant/AiLibraryTree';
import { AiScopeMenu } from './aiAssistant/AiScopeMenu';
import type { User } from '../../types';
import { Button } from '../common/Button';
import { PageHeader } from '../common/layoutPrimitives';

type Tab = 'chat' | 'library';
const emptyCatalog: AiCatalog = {
  total: 0,
  unclassified: 0,
  insurers: [],
  suggestions: { insurers: [], insurance_kinds: [], products: [] },
};
const scopeKey = (value: AiScopeBranch) =>
  value.unclassified
    ? 'unclassified'
    : [value.insurer, value.insurance_kind, value.product].filter(Boolean).join('::');
const scopeLabel = (value: AiScopeBranch) =>
  value.unclassified
    ? 'Нераспределено'
    : [value.insurer, value.insurance_kind, value.product].filter(Boolean).join(' → ');
const documentLabel = (value?: AiClassification | null) => {
  const parts = [value?.insurer, value?.insurance_kind, value?.product].filter(Boolean);
  return parts.length ? parts.join(' → ') : 'Нераспределено';
};
const documentInLibraryBranch = (document: AiDocument, branch: AiScopeBranch | null) => {
  if (!branch) return true;
  const classification = document.classification;
  if (branch.unclassified)
    return !classification?.insurer && !classification?.insurance_kind && !classification?.product;
  return (
    (!branch.insurer || classification?.insurer === branch.insurer) &&
    (!branch.insurance_kind || classification?.insurance_kind === branch.insurance_kind) &&
    (!branch.product || classification?.product === branch.product)
  );
};
const documentStatus = (status: string) => {
  const labels: Record<string, string> = {
    queued: 'В очереди',
    indexing: 'Обрабатывается',
    ready: 'Готово',
    failed: 'Ошибка',
  };
  return labels[status] ?? status;
};
const statusClass = (status: string) => {
  const classes: Record<string, string> = {
    queued: 'bg-amber-50 text-amber-800',
    indexing: 'bg-blue-50 text-blue-800',
    ready: 'bg-emerald-50 text-emerald-800',
    failed: 'bg-red-50 text-red-800',
  };
  return classes[status] ?? 'bg-slate-100 text-slate-700';
};

export function AiAssistantView({ currentUser }: { currentUser: User | null }) {
  const canManage = Boolean(
    currentUser?.isStaff || currentUser?.username.toLocaleLowerCase() === 'vova',
  );
  const [tab, setTab] = useState<Tab>('chat');
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [documents, setDocuments] = useState<AiDocument[]>([]);
  const [catalog, setCatalog] = useState<AiCatalog>(emptyCatalog);
  const [libraryBranch, setLibraryBranch] = useState<AiScopeBranch | null>(null);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [question, setQuestion] = useState('');
  const [search, setSearch] = useState('');
  const [classification, setClassification] = useState<AiClassification>({});
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [savingScope, setSavingScope] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [opening, setOpening] = useState<Set<string>>(new Set());
  const uploadInput = useRef<HTMLInputElement>(null);

  const loadLibrary = useCallback(async () => {
    const [items, tree] = await Promise.all([fetchAiDocuments(), fetchAiCatalog()]);
    setDocuments(items);
    setCatalog(tree);
  }, []);
  useEffect(() => {
    void fetchAiConversations()
      .then((items) => {
        setConversations(items);
        setSelectedId((id) => id ?? items[0]?.id ?? null);
      })
      .catch((err) => setError(String(err)));
    void loadLibrary().catch((err) => setError(String(err)));
    void fetchAiProviders()
      .then((response) => setProviders(response.providers.filter((provider) => provider.available)))
      .catch(() => setError('Не удалось загрузить список моделей Polza.'));
  }, [loadLibrary]);
  useEffect(() => {
    if (selectedId)
      void fetchAiMessages(selectedId)
        .then(setMessages)
        .catch((err) => setError(String(err)));
  }, [selectedId]);
  useEffect(() => {
    if (!documents.some((document) => ['queued', 'indexing'].includes(document.status))) return;
    const timer = window.setInterval(() => {
      void loadLibrary().catch(() => setError('Не удалось обновить статус обработки документов.'));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [documents, loadLibrary]);
  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedId),
    [conversations, selectedId],
  );
  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === (selected?.provider ?? 'polza')),
    [providers, selected?.provider],
  );
  const selectedModel = selected?.model ?? selectedProvider?.default_model ?? '';
  const scope = selected?.scope ?? [];
  const scopeSummary = scope.length ? `Поиск: ${scope.length} ветки` : 'Поиск: вся библиотека';
  const lastUsage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant')?.usage,
    [messages],
  );
  const visibleDocuments = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return documents.filter(
      (item) =>
        documentInLibraryBranch(item, libraryBranch) &&
        (!needle || item.filename.toLocaleLowerCase().includes(needle)),
    );
  }, [documents, libraryBranch, search]);
  const isUnclassifiedFolder = Boolean(libraryBranch?.unclassified);
  const selectedScope = (branch: AiScopeBranch) =>
    scope.some((item) => scopeKey(item) === scopeKey(branch));
  const toggleDocument = (id: string) =>
    setSelectedDocuments((items) => {
      const next = new Set(items);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const changeClassification = (field: keyof AiClassification, value: string) => {
    setClassificationError(null);
    setClassification((item) => ({ ...item, [field]: value || undefined }));
  };
  const hasCompleteClassification = () => {
    const values = [classification.insurer, classification.insurance_kind, classification.product];
    return values.every(Boolean);
  };
  const selectLibraryBranch = (branch: AiScopeBranch | null) => {
    setLibraryBranch(branch);
    setSelectedDocuments(new Set());
    setClassificationError(null);
  };

  const openDocument = async (
    id: string,
    location?: AiMessage['citations'][number]['location'],
  ) => {
    if (opening.has(id)) return;
    const target = window.open('', '_blank');
    setOpening((items) => new Set(items).add(id));
    try {
      const url = await fetchAiDocumentContent(id);
      const page = aiDocumentPageFragment(location);
      if (target) target.location.href = `${url}${page}`;
      else window.open(`${url}${page}`, '_blank');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      target?.close();
      setError(err instanceof Error ? err.message : 'Не удалось открыть источник.');
    } finally {
      setOpening((items) => {
        const next = new Set(items);
        next.delete(id);
        return next;
      });
    }
  };
  const createChat = async () => {
    const chat = await createAiConversation();
    setConversations((items) => [chat, ...items]);
    setSelectedId(chat.id);
    setMessages([]);
  };
  const changeModel = async (model: string) => {
    if (!selected || !selectedProvider || !model || savingModel) return;
    setSavingModel(true);
    setError(null);
    try {
      const updated = await updateAiConversationModel(selected.id, selectedProvider.id, model);
      setConversations((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить модель для чата.');
    } finally {
      setSavingModel(false);
    }
  };
  const saveScope = async (nextScope: AiScopeBranch[]) => {
    if (!selected || savingScope) {
      if (!selected) setError('Сначала создайте или выберите чат для настройки области поиска.');
      return;
    }
    setSavingScope(true);
    setError(null);
    try {
      const updated = await updateAiConversationScope(selected.id, nextScope);
      setConversations((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить область поиска.');
    } finally {
      setSavingScope(false);
    }
  };
  const toggleScope = (branch: AiScopeBranch) =>
    void saveScope(
      selectedScope(branch)
        ? scope.filter((item) => scopeKey(item) !== scopeKey(branch))
        : [...scope, branch],
    );
  const send = async () => {
    const text = question.trim();
    if (!text || loading) return;
    let id = selectedId;
    if (!id) {
      const chat = await createAiConversation(text.slice(0, 60));
      setConversations((items) => [chat, ...items]);
      setSelectedId(chat.id);
      id = chat.id;
    }
    setQuestion('');
    setLoading(true);
    setError(null);
    setMessages((items) => [
      ...items,
      { id: `local-${Date.now()}`, role: 'user', content: text, citations: [] },
      { id: 'pending', role: 'assistant', content: '', citations: [] },
    ]);
    try {
      await streamAiAnswer(id, text, (event, payload) => {
        if (event === 'delta' && typeof payload === 'string')
          setMessages((items) =>
            items.map((item) =>
              item.id === 'pending' ? { ...item, content: item.content + payload } : item,
            ),
          );
        if (event === 'done' && payload && typeof payload === 'object') {
          const result = payload as {
            content?: string;
            citations?: AiMessage['citations'];
            usage?: AiMessage['usage'];
          };
          setMessages((items) =>
            items.map((item) =>
              item.id === 'pending'
                ? {
                    ...item,
                    id: `answer-${Date.now()}`,
                    content: result.content ?? item.content,
                    citations: result.citations ?? [],
                    usage: result.usage,
                  }
                : item,
            ),
          );
        }
        if (event === 'error') setError(typeof payload === 'string' ? payload : 'Ошибка ответа');
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages((items) => items.filter((item) => item.id !== 'pending'));
    } finally {
      setLoading(false);
    }
  };
  const upload = async (files: File[]) => {
    if (!files.length || uploading) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      await uploadAiDocuments(files);
      setLibraryBranch({ unclassified: true });
      setSelectedDocuments(new Set());
      await loadLibrary();
      setNotice(
        `Добавлено в «Нераспределено»: ${files.length} ${files.length === 1 ? 'документ' : 'документов'}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить документы.');
    } finally {
      setUploading(false);
    }
  };
  const move = async () => {
    if (!selectedDocuments.size) {
      setClassificationError('Сначала отметьте документы для распределения.');
      return;
    }
    if (!hasCompleteClassification()) {
      setClassificationError('Заполните страховщика, вид страхования и продукт.');
      return;
    }
    if (moving) return;
    setMoving(true);
    setClassificationError(null);
    setError(null);
    setNotice(null);
    try {
      await updateAiDocumentClassification([...selectedDocuments], classification);
      const movedCount = selectedDocuments.size;
      setSelectedDocuments(new Set());
      setClassification({});
      await loadLibrary();
      setNotice(`Распределено: ${movedCount} ${movedCount === 1 ? 'документ' : 'документов'}.`);
    } catch (err) {
      setClassificationError(
        err instanceof Error ? err.message : 'Не удалось распределить выбранные документы.',
      );
    } finally {
      setMoving(false);
    }
  };
  const removeDocument = async (id: string) => {
    if (deleting.has(id)) return;
    if (!window.confirm('Удалить документ из общей библиотеки? Это также удалит его из поиска.'))
      return;
    setDeleting((items) => new Set(items).add(id));
    setError(null);
    setNotice(null);
    try {
      await deleteAiDocument(id);
      setSelectedDocuments((items) => {
        const next = new Set(items);
        next.delete(id);
        return next;
      });
      await loadLibrary();
      setNotice('Документ удалён из библиотеки.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить источник.');
    } finally {
      setDeleting((items) => {
        const next = new Set(items);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="ИИ-помощник"
        description="Ответы строятся только по общей библиотеке страховых документов."
      />
      <div className="inline-flex rounded-xl border border-[var(--app-border)] bg-slate-100 p-1 shadow-sm">
        {(
          [
            ['chat', 'Чат'],
            ['library', `Библиотека · ${catalog.total}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-lg px-5 py-2 text-sm ${tab === value ? 'bg-white text-[var(--app-brand-700)] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {tab === 'chat' ? (
        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded border border-[var(--app-border)] bg-white p-3">
            <Button onClick={() => void createChat()} variant="primary" size="block">
              Новый чат
            </Button>
            <div className="mt-3 space-y-1">
              {conversations.map((chat) => (
                <button
                  key={chat.id}
                  className={`w-full rounded px-2 py-2 text-left text-sm ${chat.id === selectedId ? 'bg-[var(--app-brand-50)]' : 'hover:bg-slate-50'}`}
                  onClick={() => setSelectedId(chat.id)}
                >
                  <span className="block truncate">{chat.title}</span>
                  {chat.model && (
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {chat.model}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>
          <section className="flex min-h-[620px] flex-col rounded border border-[var(--app-border)] bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{selected?.title ?? 'Новый чат'} · Polza</span>
              <label className="flex items-center gap-1 text-xs">
                <span className="sr-only">Модель Polza для этого чата</span>
                <select
                  value={selectedModel}
                  disabled={!selected || !selectedProvider || loading || savingModel}
                  onChange={(event) => void changeModel(event.target.value)}
                  className="rounded border border-[var(--app-border)] bg-white px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                  aria-label="Модель Polza для этого чата"
                >
                  {!selectedModel && <option value="">Модель загружается…</option>}
                  {selected?.model && !selectedProvider?.models.includes(selected.model) && (
                    <option value={selected.model}>Модель недоступна: {selected.model}</option>
                  )}
                  {selectedProvider?.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              {savingModel && <span className="text-xs">Сохраняю модель…</span>}
              {selectedProvider && (
                <span className="text-xs text-amber-700">Запросы тарифицируются Polza</span>
              )}
              {lastUsage && (
                <span className="text-xs">
                  Последний:{' '}
                  {lastUsage.cost_rub != null
                    ? `${lastUsage.cost_rub} ₽`
                    : 'стоимость не предоставлена API'}
                </span>
              )}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={scopeOpen}
                  aria-label="Настроить область поиска этого чата"
                  disabled={!selected || savingScope}
                  className="cursor-pointer text-[var(--app-brand-700)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--app-brand-900)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-brand-500)] disabled:cursor-not-allowed disabled:text-slate-400"
                  onClick={() => setScopeOpen((open) => !open)}
                >
                  {scopeSummary}
                </button>
                {scopeOpen && (
                  <AiScopeMenu
                    catalog={catalog}
                    scope={scope}
                    disabled={!selected || savingScope}
                    onReset={() => void saveScope([])}
                    onToggle={toggleScope}
                  />
                )}
              </div>
              {scope.map((branch) => (
                <span
                  key={scopeKey(branch)}
                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
                >
                  {scopeLabel(branch)}{' '}
                  <button
                    type="button"
                    aria-label={`Убрать ${scopeLabel(branch)}`}
                    onClick={() => toggleScope(branch)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex-1 space-y-5 overflow-auto px-1 py-2">
              {messages.map((message) => (
                <AiChatMessage
                  key={message.id}
                  message={message}
                  loading={loading}
                  opening={opening}
                  onOpenDocument={openDocument}
                />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                className="min-h-12 flex-1 rounded border border-[var(--app-border)] p-3 text-sm"
                placeholder="Спросите по страховым документам…"
              />
              <Button onClick={() => void send()} variant="primary" disabled={loading}>
                Отправить
              </Button>
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
          <AiLibraryTree
            catalog={catalog}
            selected={libraryBranch}
            onSelect={selectLibraryBranch}
          />
          <section className="rounded border border-[var(--app-border)] bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">Источники</h2>
                <p className="text-sm text-slate-500">
                  {libraryBranch ? scopeLabel(libraryBranch) : 'Вся библиотека'} · показано{' '}
                  {visibleDocuments.length} из {catalog.total} документов.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="rounded border border-[var(--app-border)] px-3 py-2 text-sm"
                  placeholder="Поиск по названию…"
                />
                {canManage && (
                  <>
                    <input
                      ref={uploadInput}
                      className="hidden"
                      type="file"
                      multiple
                      aria-label="Загрузить документы"
                      onChange={(event) => {
                        void upload(Array.from(event.target.files ?? []));
                        event.target.value = '';
                      }}
                    />
                    <Button
                      variant="secondary"
                      disabled={uploading}
                      onClick={() => uploadInput.current?.click()}
                    >
                      {uploading ? 'Добавляю…' : 'Загрузить документы'}
                    </Button>
                  </>
                )}
              </div>
            </div>
            {canManage && isUnclassifiedFolder && (
              <div className="mt-3 rounded border border-[var(--app-border)] bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">Распределить документы</h3>
                    <p className="text-xs text-slate-500">
                      {selectedDocuments.size
                        ? `Выбрано: ${selectedDocuments.size}. Укажите целевую ветку.`
                        : 'Отметьте документы из «Нераспределено» в списке ниже.'}
                    </p>
                  </div>
                  {selectedDocuments.size > 0 && (
                    <Button onClick={() => void move()} variant="primary" disabled={moving}>
                      {moving ? 'Распределяю…' : `Распределить (${selectedDocuments.size})`}
                    </Button>
                  )}
                </div>
                {selectedDocuments.size > 0 && (
                  <ClassificationFields
                    value={classification}
                    catalog={catalog}
                    onChange={changeClassification}
                    error={classificationError}
                  />
                )}
              </div>
            )}
            <div className="mt-3 max-h-[calc(100vh-17rem)] space-y-2 overflow-y-auto pr-1">
              {!visibleDocuments.length && (
                <p className="rounded bg-slate-50 p-4 text-sm text-slate-500">
                  В этой папке пока нет документов.
                </p>
              )}
              {visibleDocuments.map((document) => (
                <div
                  key={document.id}
                  className="flex items-start gap-2 rounded bg-slate-50 p-2.5 text-sm"
                >
                  {canManage && isUnclassifiedFolder && (
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={selectedDocuments.has(document.id)}
                      onChange={() => toggleDocument(document.id)}
                      aria-label={`Выбрать ${document.filename}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={opening.has(document.id)}
                      onClick={() => void openDocument(document.id)}
                      title="Открыть источник"
                      className="cursor-pointer text-left text-[var(--app-brand-700)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--app-brand-900)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-brand-500)] disabled:cursor-wait disabled:no-underline"
                    >
                      {opening.has(document.id) ? 'Открываю источник…' : document.filename}
                    </button>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{documentLabel(document.classification)}</span>
                      <span>·</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 ${statusClass(document.status)}`}
                      >
                        {documentStatus(document.status)}
                      </span>
                      <span>{document.chunks} фрагм.</span>
                    </p>
                    {document.status === 'failed' && (
                      <p className="mt-1 text-xs text-red-700">
                        {document.error ?? 'Не удалось обработать файл. Загрузите его повторно.'}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      disabled={deleting.has(document.id)}
                      className="text-xs text-red-600 hover:text-red-800 disabled:cursor-wait disabled:text-slate-400"
                      onClick={() => void removeDocument(document.id)}
                    >
                      {deleting.has(document.id) ? 'Удаляю…' : 'Удалить'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {uploading && (
        <p className="text-sm text-slate-500">Документы добавляются в очередь индексации…</p>
      )}
    </div>
  );
}
