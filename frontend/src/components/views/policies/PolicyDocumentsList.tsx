import type { PolicyDocumentsState } from './usePolicyDocuments';

interface PolicyDocumentsListProps {
  state: PolicyDocumentsState;
  onLoad?: () => void;
}

export const PolicyDocumentsList: React.FC<PolicyDocumentsListProps> = ({ state, onLoad }) => (
  <div className="mt-2 min-w-0 text-xs leading-5">
    <div className="font-medium text-slate-500">Документы</div>
    {state.status === 'idle' ? (
      <button type="button" className="font-medium text-blue-700 hover:underline" onClick={onLoad}>
        Показать документы
      </button>
    ) : null}
    {state.status === 'loading' ? <div className="text-slate-400">Загрузка документов…</div> : null}
    {state.status === 'error' ? (
      <div className="text-amber-600">Не удалось загрузить документы</div>
    ) : null}
    {state.status === 'ready' && state.files.length === 0 ? (
      <div className="text-slate-400">Нет документов</div>
    ) : null}
    {state.status === 'ready' && state.files.length > 0 ? (
      <div className="space-y-0.5">
        {state.files.map((file) =>
          file.webViewLink ? (
            <a
              key={file.id}
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              title={file.name}
              className="flex min-w-0 items-center gap-1 text-blue-700 hover:underline"
            >
              {file.isFolder ? <span aria-hidden="true">📁</span> : null}
              <span className="truncate">{file.name}</span>
            </a>
          ) : (
            <div key={file.id} title={file.name} className="truncate text-slate-500">
              {file.isFolder ? <span aria-hidden="true">📁 </span> : null}
              {file.name}
            </div>
          ),
        )}
      </div>
    ) : null}
  </div>
);
