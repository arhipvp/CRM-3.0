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

  it('keeps friendly API errors for non-html messages', () => {
    const error = new APIError('Сервис временно недоступен', 500, '/mailboxes/');

    expect(formatErrorMessage(error, 'Не удалось загрузить почтовые ящики.')).toBe(
      'Сервис временно недоступен',
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
});
