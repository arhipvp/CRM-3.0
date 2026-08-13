import type { Client, ClientDuplicateHint } from '../../types';
import { Button } from '../common/Button';

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
        <Button
          type="button"
          variant="warning"
          size="sm"
          icon="duplicate"
          onClick={(event) => {
            event.stopPropagation();
            onFindSimilar?.(client);
          }}
          className={`${iconButtonClass} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}
          aria-label={`Показать возможные дубли клиента ${client.name}`}
          title={`Возможные дубли: ${hint.candidateCount}`}
        >
          <span className="sr-only">Возможные дубли: {hint.candidateCount}</span>
        </Button>
      )}
      {showNormalizeHint && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon="normalize"
          onClick={(event) => {
            event.stopPropagation();
            void onNormalizeName?.(client, hint.normalizedName);
          }}
          className={`${iconButtonClass} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`}
          aria-label={`Нормализовать ФИО клиента ${client.name}`}
          title={`Нормализовать: ${hint.normalizedName}`}
        >
          <span className="sr-only">Нормализовать ФИО</span>
        </Button>
      )}
    </span>
  );
}
