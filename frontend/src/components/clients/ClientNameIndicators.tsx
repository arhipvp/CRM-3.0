import type { Client, ClientDuplicateHint } from '../../types';
import { IconButton } from '../common/Button';

interface ClientNameIndicatorsProps {
  client?: Client | null;
  hint?: ClientDuplicateHint;
  onFindSimilar?: (client: Client) => void;
  onNormalizeName?: (client: Client, normalizedName: string) => Promise<void>;
}

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
        <IconButton
          type="button"
          icon="duplicate"
          label={`Показать возможные дубли клиента ${client.name}`}
          tone="warning"
          size="md"
          onClick={(event) => {
            event.stopPropagation();
            onFindSimilar?.(client);
          }}
          className="h-7 w-7 shrink-0 rounded-full"
          title={`Возможные дубли: ${hint.candidateCount}`}
        />
      )}
      {showNormalizeHint && (
        <IconButton
          type="button"
          icon="normalize"
          label={`Нормализовать ФИО клиента ${client.name}`}
          tone="primary"
          size="md"
          onClick={(event) => {
            event.stopPropagation();
            void onNormalizeName?.(client, hint.normalizedName);
          }}
          className="h-7 w-7 shrink-0 rounded-full"
          title={`Нормализовать: ${hint.normalizedName}`}
        />
      )}
    </span>
  );
}
