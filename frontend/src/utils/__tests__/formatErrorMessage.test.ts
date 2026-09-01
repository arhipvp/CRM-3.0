import { describe, expect, it } from 'vitest';

import { APIError } from '../../api';
import { formatErrorMessage } from '../formatErrorMessage';

describe('formatErrorMessage', () => {
  it('returns fallback for html error payloads', () => {
    const error = new Error('<!doctype html><html><body><h1>Server Error (500)</h1></body></html>');

    expect(formatErrorMessage(error, 'Не удалось загрузить почтовые ящики.')).toBe(
      'Не удалось загрузить почтовые ящики.',
    );
  });

  it('adds action context and status for unexpected server errors', () => {
    const error = new APIError('Сервис временно недоступен', 500, '/mailboxes/');

    expect(formatErrorMessage(error, 'Не удалось загрузить почтовые ящики.')).toBe(
      'Не удалось загрузить почтовые ящики. Сервер временно не смог выполнить запрос (HTTP 500).',
    );
  });

  it('uses friendly Google Drive temporary upload message', () => {
    const error = new APIError(
      'Google Drive временно не принял файл. Попробуйте ещё раз.',
      503,
      '/deals/deal-1/drive-files/',
      'drive_temporary_error',
    );

    expect(formatErrorMessage(error, 'Не удалось загрузить файл')).toBe(
      'Google Drive временно не принял файл. Попробуйте ещё раз через минуту.',
    );
  });

  it('keeps detailed AI diagnostics returned by the backend', () => {
    const error = new APIError(
      'На балансе Polza.ai недостаточно средств. Ответ Polza.ai: balance is empty.',
      402,
      '/policies/recognize/',
      'ai_insufficient_funds',
    );

    expect(formatErrorMessage(error, 'Не удалось распознать документы')).toBe(
      'На балансе Polza.ai недостаточно средств. Ответ Polza.ai: balance is empty.',
    );
  });

  it('uses a friendly AI message when the server supplied no useful detail', () => {
    const error = new APIError(
      'Request /policies/recognize/ failed with status 429',
      429,
      '/policies/recognize/',
      'ai_rate_limited',
    );

    expect(formatErrorMessage(error)).toBe(
      'Слишком много запросов к Polza.ai. Попробуйте ещё раз немного позже.',
    );
  });
});
