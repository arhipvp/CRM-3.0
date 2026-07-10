import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTasks } from '../tasks';
import { request } from '../request';

vi.mock('../request', () => ({
  request: vi.fn(),
}));

const rawTask = (id: string) => ({
  id,
  title: `Task ${id}`,
  status: 'todo',
  priority: 'normal',
  checklist_count: 0,
  created_at: '2026-07-10T10:00:00Z',
});

describe('task pagination', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('requests up to 500 active tasks in the first request', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [rawTask('1')],
    });

    await fetchTasks({ active_only: true, show_deleted: false }, { pageSize: 500 });

    expect(request).toHaveBeenCalledWith(
      '/tasks/?active_only=true&show_deleted=false&page=1&page_size=500',
    );
  });

  it('reports each accumulated page so the UI can render before pagination completes', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({
        count: 2,
        next: '/tasks/?page=2',
        previous: null,
        results: [rawTask('1')],
      })
      .mockResolvedValueOnce({
        count: 2,
        next: null,
        previous: '/tasks/?page=1',
        results: [rawTask('2')],
      });
    const onPage = vi.fn();

    const tasks = await fetchTasks({ active_only: true }, { pageSize: 500, onPage });

    expect(onPage).toHaveBeenNthCalledWith(1, [expect.objectContaining({ id: '1' })], 1);
    expect(onPage).toHaveBeenNthCalledWith(
      2,
      [expect.objectContaining({ id: '1' }), expect.objectContaining({ id: '2' })],
      2,
    );
    expect(tasks.map((task) => task.id)).toEqual(['1', '2']);
  });

  it('requests full checklist data for tasks shown in deal details', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [{ ...rawTask('deal-task'), checklist: [{ label: 'Позвонить', done: false }] }],
    });

    const { fetchTasksByDeal } = await import('../tasks');
    const tasks = await fetchTasksByDeal('deal-1');

    expect(request).toHaveBeenCalledWith(
      '/tasks/?deal=deal-1&show_deleted=false&include_checklist=true&page=1&page_size=200',
    );
    expect(tasks[0]?.checklist).toEqual([{ label: 'Позвонить', done: false }]);
  });
});
