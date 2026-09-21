import { useEffect, useMemo, useState } from 'react';

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
  formatAiCitationLocation,
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
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [question, setQuestion] = useState('');
  const [search, setSearch] = useState('');
  const [classification, setClassification] = useState<AiClassification>({});
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [savingScope, setSavingScope] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState<Set<string>>(new Set());

  const loadLibrary = async () => {
    const [items, tree] = await Promise.all([fetchAiDocuments(), fetchAiCatalog()]);
    setDocuments(items);
    setCatalog(tree);
  };
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
  }, []);
  useEffect(() => {
    if (selectedId)
      void fetchAiMessages(selectedId)
        .then(setMessages)
        .catch((err) => setError(String(err)));
  }, [selectedId]);
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
  const lastUsage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant')?.usage,
    [messages],
  );
  const visibleDocuments = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return needle
      ? documents.filter((item) => item.filename.toLocaleLowerCase().includes(needle))
      : documents;
  }, [documents, search]);
  const selectedScope = (branch: AiScopeBranch) =>
    scope.some((item) => scopeKey(item) === scopeKey(branch));
  const toggleDocument = (id: string) =>
    setSelectedDocuments((items) => {
      const next = new Set(items);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const changeClassification = (field: keyof AiClassification, value: string) =>
    setClassification((item) => ({ ...item, [field]: value || undefined }));
  const validClassification = () => {
    const values = [classification.insurer, classification.insurance_kind, classification.product];
    return !values.some(Boolean) || values.every(Boolean);
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
    if (!validClassification()) {
      setError('Заполните всю ветку или оставьте поля пустыми для «Нераспределено».');
      return;
    }
    setUploading(true);
    try {
      await uploadAiDocuments(files, classification);
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить документы.');
    } finally {
      setUploading(false);
    }
  };
  const move = async () => {
    if (!selectedDocuments.size || !validClassification()) return;
    try {
      await updateAiDocumentClassification([...selectedDocuments], classification);
      setSelectedDocuments(new Set());
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить классификацию.');
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
              <button
                type="button"
                className="cursor-pointer text-[var(--app-brand-700)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--app-brand-900)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-brand-500)]"
                onClick={() => setTab('library')}
              >
                {scope.length ? `Область: ${scope.length}` : 'Вся библиотека'}
              </button>
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
            <div className="flex-1 space-y-4 overflow-auto">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded p-3 text-sm ${message.role === 'user' ? 'ml-12 bg-[var(--app-brand-50)]' : 'mr-12 bg-slate-50'}`}
                >
                  <p className="whitespace-pre-wrap">
                    {message.content || (loading ? 'Готовлю ответ…' : '')}
                  </p>
                  {message.usage && (
                    <p className="mt-2 text-xs text-slate-500">
                      {message.usage.model}
                      {message.usage.cost_rub != null ? ` · ${message.usage.cost_rub} ₽` : ''}
                    </p>
                  )}
                  {message.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.citations.map((citation, index) => (
                        <button
                          key={`${citation.document_id}-${index}`}
                          type="button"
                          disabled={opening.has(citation.document_id)}
                          onClick={() => void openDocument(citation.document_id, citation.location)}
                          title="Открыть источник"
                          className="cursor-pointer rounded bg-emerald-50 px-2 py-1 text-left text-xs text-emerald-800 underline decoration-emerald-400 underline-offset-2 transition-all hover:bg-emerald-200 hover:text-emerald-950 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:no-underline"
                        >
                          {opening.has(citation.document_id)
                            ? 'Открываю источник…'
                            : `[${index + 1}] ${documentLabel(citation.classification)} · ${citation.filename}, ${formatAiCitationLocation(citation.location)}`}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
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
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="self-start rounded border border-[var(--app-border)] bg-white p-3 xl:sticky xl:top-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Область поиска</h2>
              <button
                type="button"
                className="cursor-pointer text-xs text-[var(--app-brand-700)] underline decoration-dotted underline-offset-2 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={!selected || savingScope}
                onClick={() => void saveScope([])}
              >
                Сбросить
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {selected
                ? 'Выберите одну или несколько веток для этого чата.'
                : 'Сначала создайте или выберите чат.'}
            </p>
            <div className="mt-3 max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pr-1 text-sm">
              <ScopeOption
                label={`Вся библиотека (${catalog.total})`}
                checked={!scope.length}
                onChange={() => void saveScope([])}
                disabled={!selected || savingScope}
              />
              <ScopeOption
                label={`Нераспределено (${catalog.unclassified})`}
                checked={selectedScope({ unclassified: true })}
                onChange={() => toggleScope({ unclassified: true })}
                disabled={!selected || savingScope}
              />
              {catalog.insurers.map((insurer) => (
                <div key={insurer.name} className="border-l border-slate-200 pl-2">
                  <ScopeOption
                    label={`${insurer.name} (${insurer.count})`}
                    checked={selectedScope({ insurer: insurer.name })}
                    onChange={() => toggleScope({ insurer: insurer.name })}
                    disabled={!selected || savingScope}
                    bold
                  />
                  {insurer.kinds.map((kind) => (
                    <div key={kind.name} className="pl-3">
                      <ScopeOption
                        label={`${kind.name} (${kind.count})`}
                        checked={selectedScope({
                          insurer: insurer.name,
                          insurance_kind: kind.name,
                        })}
                        onChange={() =>
                          toggleScope({ insurer: insurer.name, insurance_kind: kind.name })
                        }
                        disabled={!selected || savingScope}
                      />
                      {kind.products.map((product) => (
                        <div key={product.name} className="pl-3">
                          <ScopeOption
                            label={`${product.name} (${product.count})`}
                            checked={selectedScope({
                              insurer: insurer.name,
                              insurance_kind: kind.name,
                              product: product.name,
                            })}
                            onChange={() =>
                              toggleScope({
                                insurer: insurer.name,
                                insurance_kind: kind.name,
                                product: product.name,
                              })
                            }
                            disabled={!selected || savingScope}
                            small
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </aside>
          <section className="rounded border border-[var(--app-border)] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Источники</h2>
                <p className="text-sm text-slate-500">
                  Показано {visibleDocuments.length} из {catalog.total} документов.
                </p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="rounded border border-[var(--app-border)] px-3 py-2 text-sm"
                placeholder="Поиск по названию…"
              />
            </div>
            {canManage && (
              <>
                <div
                  className={`mt-4 rounded border-2 border-dashed p-5 text-center text-sm ${dragging ? 'border-[var(--app-brand-500)] bg-[var(--app-brand-50)]' : 'border-[var(--app-border)]'}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    void upload(Array.from(event.dataTransfer.files));
                  }}
                >
                  <label className="cursor-pointer text-[var(--app-brand-700)] hover:underline">
                    <input
                      className="hidden"
                      type="file"
                      multiple
                      onChange={(event) => void upload(Array.from(event.target.files ?? []))}
                    />
                    Перетащите документы сюда или выберите файлы
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    Без ветки документ попадёт в «Нераспределено».
                  </p>
                </div>
                <ClassificationFields
                  value={classification}
                  catalog={catalog}
                  onChange={changeClassification}
                />
                {selectedDocuments.size > 0 && (
                  <Button onClick={() => void move()} variant="secondary" className="mt-3">
                    Перенести выбранные ({selectedDocuments.size})
                  </Button>
                )}
              </>
            )}
            <div className="mt-4 max-h-[calc(100vh-19rem)] space-y-2 overflow-y-auto pr-2">
              {visibleDocuments.map((document) => (
                <div
                  key={document.id}
                  className="flex items-start gap-2 rounded bg-slate-50 p-3 text-sm"
                >
                  {canManage && (
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
                    <p className="mt-1 text-xs text-slate-500">
                      {documentLabel(document.classification)} · {document.status} ·{' '}
                      {document.chunks} фрагм.
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() =>
                        void deleteAiDocument(document.id)
                          .then(loadLibrary)
                          .catch((err) => setError(String(err)))
                      }
                    >
                      Удалить
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

function ScopeOption({
  label,
  checked,
  onChange,
  disabled = false,
  bold = false,
  small = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  bold?: boolean;
  small?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 ${bold ? 'font-medium' : ''} ${small ? 'text-xs' : ''} ${disabled ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer'}`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      {label}
    </label>
  );
}

function ClassificationFields({
  value,
  catalog,
  onChange,
}: {
  value: AiClassification;
  catalog: AiCatalog;
  onChange: (field: keyof AiClassification, value: string) => void;
}) {
  const fields: Array<[keyof AiClassification, string, string[], 'text' | 'date']> = [
    ['insurer', 'Страховщик', catalog.suggestions.insurers, 'text'],
    ['insurance_kind', 'Вид страхования', catalog.suggestions.insurance_kinds, 'text'],
    ['product', 'Продукт', catalog.suggestions.products, 'text'],
    [
      'document_type',
      'Тип документа',
      ['Правила', 'Тарифы', 'Инструкция', 'Бланк', 'Прочее'],
      'text',
    ],
    ['effective_from', 'Действует с', [], 'date'],
    ['effective_to', 'Действует до', [], 'date'],
  ];
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {fields.map(([field, label, options, type]) => (
        <label key={field} className="text-xs text-slate-600">
          {label}
          <input
            type={type}
            list={`ai-${field}`}
            value={value[field] ?? ''}
            onChange={(event) => onChange(field, event.target.value)}
            className="mt-1 w-full rounded border border-[var(--app-border)] px-2 py-1.5 text-sm text-slate-900"
          />
          <datalist id={`ai-${field}`}>
            {options.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
      ))}
    </div>
  );
}
