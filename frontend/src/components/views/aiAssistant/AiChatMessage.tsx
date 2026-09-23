import {
  formatAiCitationLocation,
  type AiClassification,
  type AiMessage,
} from '../../../api/aiAssistant';

const documentLabel = (value?: AiClassification | null) => {
  const parts = [value?.insurer, value?.insurance_kind, value?.product].filter(Boolean);
  return parts.length ? parts.join(' → ') : 'Нераспределено';
};

export function AiChatMessage({
  message,
  now,
  opening,
  onOpenDocument,
  onStop,
  onRetry,
}: {
  message: AiMessage;
  now: number;
  opening: Set<string>;
  onOpenDocument: (
    id: string,
    location?: AiMessage['citations'][number]['location'],
  ) => Promise<void>;
  onStop: (runId: string) => void;
  onRetry: (message: AiMessage) => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <article className="max-w-[82%] rounded-2xl rounded-br-md bg-[var(--app-brand-600)] px-4 py-3 text-sm text-white shadow-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-100">Вы</p>
          <p className="whitespace-pre-wrap leading-6">{message.content}</p>
        </article>
      </div>
    );
  }

  const run = message.run;
  const active = run && ['queued', 'searching', 'generating'].includes(run.status);
  const elapsed = run
    ? Math.max(
        0,
        Math.floor(
          ((run.finished_at ? Date.parse(run.finished_at) : now) - Date.parse(run.created_at)) /
            1000,
        ),
      )
    : 0;
  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const statusLabel =
    run?.stop_requested && active
      ? 'Останавливаю ответ'
      : run?.status === 'queued'
        ? 'В очереди'
        : run?.status === 'searching'
          ? 'Ищу подтверждения в документах'
          : run?.status === 'generating'
            ? elapsed > 30
              ? 'Модель продолжает формировать ответ'
              : 'Модель формирует ответ'
            : run?.status === 'failed'
              ? 'Ошибка ответа'
              : run?.status === 'stopped'
                ? 'Остановлено'
                : run?.status === 'interrupted'
                  ? 'Прервано после перезапуска'
                  : '';

  return (
    <div className="flex items-start gap-2.5">
      <div
        aria-hidden="true"
        className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200"
      >
        ИИ
      </div>
      <article className="max-w-[88%] overflow-hidden rounded-2xl rounded-tl-md border border-slate-200 bg-white text-sm shadow-sm">
        <div className="px-4 pb-3 pt-3">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-semibold text-slate-700">Страховой помощник</span>
            {message.usage && (
              <span className="text-slate-500">
                {message.usage.model}
                {message.usage.cost_rub != null ? ` · ${message.usage.cost_rub} ₽` : ''}
              </span>
            )}
          </div>
          {run && run.status !== 'completed' && (
            <div
              role="status"
              className={`mb-2 flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${active ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-900'}`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="size-2 animate-pulse rounded-full bg-blue-500"
                />
              )}
              <span>{statusLabel}</span>
              <span>· {elapsedLabel}</span>
              {run.status !== 'queued' && <span>· найдено фрагментов: {run.found_chunks}</span>}
              {active && (
                <button
                  type="button"
                  onClick={() => onStop(run.id)}
                  disabled={run.stop_requested}
                  className="cursor-pointer font-medium underline hover:text-blue-950 disabled:cursor-wait disabled:opacity-60"
                >
                  {run.stop_requested ? 'Останавливаю…' : 'Остановить'}
                </button>
              )}
              {!active && (
                <button
                  type="button"
                  onClick={() => onRetry(message)}
                  className="cursor-pointer font-medium underline hover:text-amber-950"
                >
                  Повторить
                </button>
              )}
            </div>
          )}
          <p className="whitespace-pre-wrap leading-6 text-slate-800">
            {message.content || (active ? 'Ответ появится здесь по мере готовности…' : '')}
          </p>
          {run?.error && !active && <p className="mt-2 text-xs text-red-700">{run.error}</p>}
          {run && ['failed', 'stopped', 'interrupted'].includes(run.status) && (
            <p className="mt-2 text-xs text-amber-800">
              Повторный запрос может тарифицироваться Polza ещё раз.
            </p>
          )}
        </div>
        {message.citations.length > 0 && (
          <div className="border-t border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
              Источники
            </p>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((citation, index) => (
                <button
                  key={`${citation.document_id}-${index}`}
                  type="button"
                  disabled={opening.has(citation.document_id)}
                  onClick={() => void onOpenDocument(citation.document_id, citation.location)}
                  title="Открыть источник"
                  className="cursor-pointer rounded-md bg-white px-2 py-1 text-left text-xs text-emerald-800 underline decoration-emerald-400 underline-offset-2 shadow-sm ring-1 ring-emerald-100 transition-all hover:bg-emerald-200 hover:text-emerald-950 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:no-underline"
                >
                  {opening.has(citation.document_id)
                    ? 'Открываю источник…'
                    : `[${index + 1}] ${documentLabel(citation.classification)} · ${citation.filename}, ${formatAiCitationLocation(citation.location)}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
