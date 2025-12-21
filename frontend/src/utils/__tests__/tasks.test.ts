import { describe, expect, it } from 'vitest';

import type { Task } from '../../types';
import { markTaskAsDeleted } from '../tasks';

describe('markTaskAsDeleted', () => {
  it('sets deletedAt for the specified task', () => {
    const tasks: Task[] = [
      {
        id: 't-1',
        title: 'A',
        description: '',
        priority: 'normal',
        status: 'todo',
        checklist: [],
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 't-2',
        title: 'B',
        description: '',
        priority: 'normal',
        status: 'todo',
        checklist: [],
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      },
    ];

    const result = markTaskAsDeleted(tasks, 't-2', '2025-02-01T00:00:00.000Z');
    expect(result).toHaveLength(2);
    expect(result.find((task) => task.id === 't-1')?.deletedAt).toBeNull();
    expect(result.find((task) => task.id === 't-2')?.deletedAt).toBe(
      '2025-02-01T00:00:00.000Z'
    );
  });

  it('does not override existing deletedAt', () => {
    const tasks: Task[] = [
      {
        id: 't-1',
        title: 'A',
        description: '',
        priority: 'normal',
        status: 'todo',
        checklist: [],
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: '2025-01-15T00:00:00.000Z',
      },
    ];

    const result = markTaskAsDeleted(tasks, 't-1', '2025-02-01T00:00:00.000Z');
    expect(result[0].deletedAt).toBe('2025-01-15T00:00:00.000Z');
  });
});
