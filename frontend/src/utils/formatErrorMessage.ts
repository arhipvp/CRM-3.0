import { APIError } from '../api';

const STATUS_FRIENDLY_MESSAGES: Record<number, string> = {
  401: 'Требуется авторизация. Пожалуйста, войдите в систему.',
  403: 'У вас нет прав для этого действия.',
};

const HTML_TAG_PATTERN = /<[^>]+>/;

const looksLikeHtml = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<html') ||
    normalized.startsWith('<body') ||
    HTML_TAG_PATTERN.test(normalized)
  );
};

const sanitizeMessage = (message: string, fallback?: string): string => {
  const trimmed = message.trim();
  if (!trimmed) {
    return fallback ?? 'Произошла ошибка';
  }
  if (looksLikeHtml(trimmed)) {
    return fallback ?? 'Ошибка сервера';
  }
  return trimmed;
};

export function formatErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof APIError) {
    const override = STATUS_FRIENDLY_MESSAGES[error.status];
    const detail = error.message && error.message !== override ? ` — ${error.message}` : '';
    if (override) {
      return sanitizeMessage(`${override}${detail}`.trim(), override);
    }
    if (error.message) {
      return sanitizeMessage(error.message, fallback);
    }
  }

  if (error instanceof Error) {
    return sanitizeMessage(error.message, fallback);
  }

  if (typeof error === 'string' && error.trim()) {
    return sanitizeMessage(error, fallback);
  }

  return fallback ?? 'Произошла ошибка';
}
