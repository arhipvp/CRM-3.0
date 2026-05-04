import { useEffect, useMemo, useRef, useState } from 'react';

import { fetchClientDuplicateHints } from '../api';
import type { Client, ClientDuplicateHint } from '../types';

const CLIENT_HINTS_CHUNK_SIZE = 450;

export function useClientDuplicateHints(clients: Client[]) {
  const [hints, setHints] = useState<Record<string, ClientDuplicateHint>>({});
  const requestRef = useRef(0);

  const clientIds = useMemo(
    () =>
      clients
        .map((client) => client.id)
        .filter(Boolean)
        .sort(),
    [clients],
  );
  const clientIdsKey = clientIds.join('|');

  useEffect(() => {
    if (!clientIds.length) {
      setHints({});
      return;
    }
    requestRef.current += 1;
    const requestId = requestRef.current;
    const chunks: string[][] = [];
    for (let index = 0; index < clientIds.length; index += CLIENT_HINTS_CHUNK_SIZE) {
      chunks.push(clientIds.slice(index, index + CLIENT_HINTS_CHUNK_SIZE));
    }

    void Promise.all(chunks.map((chunk) => fetchClientDuplicateHints(chunk)))
      .then((payloads) => {
        if (requestRef.current !== requestId) {
          return;
        }
        setHints(Object.assign({}, ...payloads));
      })
      .catch(() => {
        if (requestRef.current === requestId) {
          setHints({});
        }
      });
  }, [clientIds, clientIdsKey]);

  return hints;
}
