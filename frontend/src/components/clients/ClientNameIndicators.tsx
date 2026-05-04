import type { Client, ClientDuplicateHint } from '../../types';

interface ClientNameIndicatorsProps {
  client?: Client | null;
  hint?: ClientDuplicateHint;
  onFindSimilar?: (client: Client) => void;
  onNormalizeName?: (client: Client, normalizedName: string) => Promise<void>;
}

const iconButtonClass =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1';

export function ClientNameIndicators({
  client,
  hint,
  onFindSimilar,
  onNormalizeName,
}: ClientNameIndicatorsProps) {
  if (!client || !hint) {
    return null;
  }
  const showDuplicateHint = hint.candidateCount > 0 && Boolean(onFindSimilar);
  const showNormalizeHint =
    hint.needsNameNormalization &&
    hint.normalizedName &&
    hint.normalizedName !== client.name &&
    Boolean(onNormalizeName);

  if (!showDuplicateHint && !showNormalizeHint) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {showDuplicateHint && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onFindSimilar?.(client);
          }}
          className={`${iconButtonClass} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}
          aria-label={`Показать возможные дубли клиента ${client.name}`}
          title={`Возможные дубли: ${hint.candidateCount}`}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M7 7a4 4 0 1 1 7.5 2 4 4 0 0 1 2.5 3.7V14h-2v-1.3A2.7 2.7 0 0 0 12.3 10h-2.6A2.7 2.7 0 0 0 7 12.7V14H5v-1.3A4.7 4.7 0 0 1 7.5 9 4 4 0 0 1 7 7Zm4 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm7.5 1.5h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z" />
          </svg>
        </button>
      )}
      {showNormalizeHint && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void onNormalizeName?.(client, hint.normalizedName);
          }}
          className={`${iconButtonClass} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`}
          aria-label={`Нормализовать ФИО клиента ${client.name}`}
          title={`Нормализовать: ${hint.normalizedName}`}
        >
          Aa
        </button>
      )}
    </span>
  );
}
