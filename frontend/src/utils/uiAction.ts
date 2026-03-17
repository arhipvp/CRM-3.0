import { formatErrorMessage } from './formatErrorMessage';

const UI_DEBUG = import.meta.env.DEV && import.meta.env.VITE_UI_DEBUG === 'true';

export interface AsyncUiActionState {
  error: string | null;
  isPending: boolean;
}

interface RunAsyncUiActionOptions<T> {
  action: () => Promise<T>;
  debugLabel: string;
  fallbackMessage: string;
  setPending?: (value: boolean) => void;
  setError?: (value: string | null) => void;
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (message: string, error: unknown) => void | Promise<void>;
  onFinally?: () => void | Promise<void>;
  rethrow?: boolean;
}

export const debugUiError = (label: string, error: unknown) => {
  if (UI_DEBUG) {
    console.error(label, error);
  }
};

export const resolveUiErrorMessage = (error: unknown, fallbackMessage: string) =>
  formatErrorMessage(error, fallbackMessage);

export async function runAsyncUiAction<T>({
  action,
  debugLabel,
  fallbackMessage,
  setPending,
  setError,
  onSuccess,
  onError,
  onFinally,
  rethrow = false,
}: RunAsyncUiActionOptions<T>): Promise<T | undefined> {
  setError?.(null);
  setPending?.(true);

  try {
    const result = await action();
    await onSuccess?.(result);
    return result;
  } catch (error) {
    const message = resolveUiErrorMessage(error, fallbackMessage);
    debugUiError(debugLabel, error);
    setError?.(message);
    await onError?.(message, error);
    if (rethrow) {
      throw error;
    }
    return undefined;
  } finally {
    setPending?.(false);
    await onFinally?.();
  }
}
