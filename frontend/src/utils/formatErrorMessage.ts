import { APIError } from '../api';

const STATUS_FRIENDLY_MESSAGES: Record<number, string> = {
  401: 'Требуется авторизация. Пожалуйста, войдите в систему.',
  403: 'У вас нет прав для этого действия.',
};

const ERROR_CODE_FRIENDLY_MESSAGES: Record<string, string> = {
  drive_temporary_error: 'Google Drive временно не принял файл. Попробуйте ещё раз через минуту.',
  ai_insufficient_funds:
    'На балансе Polza.ai недостаточно средств. Пополните баланс и повторите распознавание.',
  ai_timeout: 'Polza.ai не успел обработать запрос. Попробуйте ещё раз.',
  ai_rate_limited: 'Слишком много запросов к Polza.ai. Попробуйте ещё раз немного позже.',
  ai_authentication_failed: 'Не удалось авторизоваться в Polza.ai. Обратитесь к администратору.',
  ai_provider_unavailable: 'Polza.ai временно недоступен. Попробуйте ещё раз позже.',
  ai_invalid_request: 'Polza.ai отклонил запрос на распознавание. Обратитесь к администратору.',
  ai_unknown_error: 'Не удалось выполнить распознавание в Polza.ai. Попробуйте ещё раз позже.',
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
    const errorCode = error.errorCode;
    const errorCodeMessage = errorCode ? ERROR_CODE_FRIENDLY_MESSAGES[errorCode] : undefined;
    if (errorCodeMessage) {
      if (!errorCode?.startsWith('ai_')) {
        return errorCodeMessage;
      }
      const detail = sanitizeMessage(error.message, '');
      const isGenericDetail =
        !detail ||
        detail.startsWith('Request ') ||
        /^Сервер временно не смог выполнить запрос/.test(detail);
      return isGenericDetail ? errorCodeMessage : detail;
    }

    if (error.status >= 500) {
      const action = (fallback ?? 'Не удалось выполнить действие').replace(/[.!?]\s*$/, '');
      return `${action}. Сервер временно не смог выполнить запрос (HTTP ${error.status}).`;
    }

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
