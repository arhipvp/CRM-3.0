import { afterEach, describe, expect, it, vi } from 'vitest';

import { askKnowledgeBase } from '../knowledge';
import { request } from '../request';

vi.mock('../request', () => ({ request: vi.fn() }));

describe('knowledge background jobs', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('polls until the background answer succeeds', async () => {
    vi.useFakeTimers();
    vi.mocked(request)
      .mockResolvedValueOnce({ id: 'job-1', status: 'pending' })
      .mockResolvedValueOnce({ id: 'job-1', status: 'running' })
      .mockResolvedValueOnce({
        id: 'job-1',
        status: 'succeeded',
        result: { answer: 'Ответ', citations: [] },
      });

    const answerPromise = askKnowledgeBase('notebook-1', 'Вопрос');
    await vi.advanceTimersByTimeAsync(1000);

    await expect(answerPromise).resolves.toEqual({
      question: 'Вопрос',
      answer: 'Ответ',
      citations: [],
    });
    expect(request).toHaveBeenNthCalledWith(1, '/knowledge/ask/', {
      method: 'POST',
      body: JSON.stringify({
        notebook_id: 'notebook-1',
        question: 'Вопрос',
        session_id: undefined,
      }),
    });
    expect(request).toHaveBeenNthCalledWith(3, '/external-jobs/job-1/');
  });

  it('surfaces a failed background job', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({ id: 'job-2', status: 'pending' })
      .mockResolvedValueOnce({ id: 'job-2', status: 'failed', error: 'OpenNotebook недоступен' });

    await expect(askKnowledgeBase('notebook-1', 'Вопрос')).rejects.toThrow(
      'OpenNotebook недоступен',
    );
  });
});
