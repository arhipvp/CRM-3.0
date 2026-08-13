import type { PolicyDocumentsState } from './usePolicyDocuments';
import { Button } from '../../common/Button';

interface PolicyDocumentsListProps {
  state: PolicyDocumentsState;
  onLoad?: () => void;
}

export const PolicyDocumentsList: React.FC<PolicyDocumentsListProps> = ({ state, onLoad }) => (
  <div className="mt-2 min-w-0 text-[11px] leading-4">
    {state.status === 'idle' ? (
      <Button
        type="button"
        className="inline-flex max-w-full items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-blue-700 transition hover:bg-slate-200"
        onClick={onLoad}
      >
        <span aria-hidden="true">📎</span>
        Показать документы
      </Button>
    ) : null}
    {state.status === 'loading' ? <div className="text-slate-400">Документы: загрузка…</div> : null}
    {state.status === 'error' ? (
      <div className="text-amber-600">Не удалось загрузить документы</div>
    ) : null}
    {state.status === 'ready' && state.files.length === 0 ? (
      <div className="text-slate-400">Нет документов</div>
    ) : null}
    {state.status === 'ready' && state.files.length > 0 ? (
      <div className="flex flex-wrap gap-1" data-testid="policy-documents-list">
        {state.files.map((file) =>
          file.webViewLink ? (
            <a
              key={file.id}
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              title={file.name}
              className="inline-flex max-w-[8.5rem] items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-blue-700 transition hover:bg-sky-100 hover:underline"
            >
              <span aria-hidden="true">{file.isFolder ? '📁' : '📄'}</span>
              <span className="truncate">{file.name}</span>
            </a>
          ) : (
            <div
              key={file.id}
              title={file.name}
              className="inline-flex max-w-[8.5rem] items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-500"
            >
              <span aria-hidden="true">{file.isFolder ? '📁' : '📄'}</span>
              <span className="truncate">{file.name}</span>
            </div>
          ),
        )}
      </div>
    ) : null}
  </div>
);
