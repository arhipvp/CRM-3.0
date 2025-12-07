import { APIError } from '../api';

const STATUS_FRIENDLY_MESSAGES: Record<number, string> = {
  401: 'Требуется авторизация. Пожалуйста, войдите в систему.',
  403: 'У вас нет прав для этого действия.',
};

export function formatErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof APIError) {
    const override = STATUS_FRIENDLY_MESSAGES[error.status];
    const detail =
      error.message && error.message !== override ? ` — ${error.message}` : '';
    if (override) {
      return `${override}${detail}`.trim();
    }
    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback ?? 'Произошла ошибка';
}
