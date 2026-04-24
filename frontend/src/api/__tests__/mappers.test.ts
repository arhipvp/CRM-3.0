import { describe, expect, it } from 'vitest';

import { mapTask } from '../mappers';

describe('mapTask', () => {
  it('maps completion comment from API payload', () => {
    const task = mapTask({
      id: 'task-1',
      title: 'Проверить договор',
      status: 'done',
      priority: 'normal',
      checklist: [],
      created_at: '2026-04-24T10:00:00Z',
      completion_comment: 'Посчитано в Сбер.',
    });

    expect(task.completionComment).toBe('Посчитано в Сбер.');
  });
});
