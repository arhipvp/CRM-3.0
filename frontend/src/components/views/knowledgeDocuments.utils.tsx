import React from 'react';

import type { KnowledgeCitation } from '../../types';

export const formatKnowledgeDate = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString('ru-RU');
};

export const formatKnowledgeDateTime = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString('ru-RU');
};

export const collectKnowledgeReferenceItems = (
  text: string,
  sourceCitations: KnowledgeCitation[],
) => {
  const regex = /\[source:([^\]]+)\]/g;
  const orderedIds: string[] = [];
  let match = regex.exec(text);
  while (match) {
    const sourceId = match[1];
    if (!orderedIds.includes(sourceId)) {
      orderedIds.push(sourceId);
    }
    match = regex.exec(text);
  }
  return orderedIds.map((sourceId) => {
    const citation = sourceCitations.find((item) => item.sourceId === sourceId);
    return {
      sourceId,
      title: citation?.title || 'Источник',
      fileUrl: citation?.fileUrl || null,
    };
  });
};

export const renderKnowledgeAnswerWithCitations = (
  text: string,
  sourceCitations: KnowledgeCitation[],
  onOpenSource: (sourceId: string) => void,
) => {
  const references = collectKnowledgeReferenceItems(text, sourceCitations);
  if (!references.length) {
    return text;
  }

  const indexBySource = new Map(references.map((item, index) => [item.sourceId, index + 1]));
  const parts: Array<string | React.ReactNode> = [];
  const regex = /\[source:([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  let key = 0;
  while (match) {
    const start = match.index;
    const end = regex.lastIndex;
    const sourceId = match[1];
    const number = indexBySource.get(sourceId);
    parts.push(text.slice(lastIndex, start));
    if (number) {
      parts.push(
        <sup key={`cite-${key}`}>
          <button
            type="button"
            className="text-blue-600 hover:text-blue-700"
            onClick={() => onOpenSource(sourceId)}
          >
            [{number}]
          </button>
        </sup>,
      );
      key += 1;
    }
    lastIndex = end;
    match = regex.exec(text);
  }
  parts.push(text.slice(lastIndex));
  return parts;
};
