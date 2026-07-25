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
      setHints((currentHints) => (Object.keys(currentHints).length ? {} : currentHints));
      return;
    }
    requestRef.current += 1;
    const requestId = requestRef.current;
    const chunks: string[][] = [];
    for (let index = 0; index < clientIds.length; index += CLIENT_HINTS_CHUNK_SIZE) {
      chunks.push(clientIds.slice(index, index + CLIENT_HINTS_CHUNK_SIZE));
    }

    const controller = new AbortController();
    let nextChunkIndex = 0;
    const results: Array<Record<string, ClientDuplicateHint>> = [];
    const worker = async () => {
      while (!controller.signal.aborted) {
        const chunkIndex = nextChunkIndex++;
        if (chunkIndex >= chunks.length) {
          return;
        }
        results[chunkIndex] = await fetchClientDuplicateHints(chunks[chunkIndex], {
          signal: controller.signal,
        });
      }
    };
    const workerCount = Math.min(3, chunks.length);

    void Promise.all(Array.from({ length: workerCount }, () => worker()))
      .then(() => {
        if (controller.signal.aborted || requestRef.current !== requestId) {
          return;
        }
        setHints(Object.assign({}, ...results));
      })
      .catch(() => {
        if (!controller.signal.aborted && requestRef.current === requestId) {
          setHints({});
        }
      });

    return () => {
      controller.abort();
    };
  }, [clientIds, clientIdsKey]);

  return hints;
}
