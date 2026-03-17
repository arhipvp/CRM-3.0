import { describe, expect, it, vi } from 'vitest';

import { runAsyncUiAction } from '../uiAction';

describe('runAsyncUiAction', () => {
  it('tracks pending state and resolves success', async () => {
    const setPending = vi.fn();
    const setError = vi.fn();
    const onSuccess = vi.fn();

    const result = await runAsyncUiAction({
      action: async () => 'ok',
      debugLabel: 'test success',
      fallbackMessage: 'fallback',
      setPending,
      setError,
      onSuccess,
    });

    expect(result).toBe('ok');
    expect(setError).toHaveBeenCalledWith(null);
    expect(setPending).toHaveBeenNthCalledWith(1, true);
    expect(setPending).toHaveBeenLastCalledWith(false);
    expect(onSuccess).toHaveBeenCalledWith('ok');
  });

  it('formats error and calls fallback handlers', async () => {
    const setPending = vi.fn();
    const setError = vi.fn();
    const onError = vi.fn();

    const result = await runAsyncUiAction({
      action: async () => {
        throw new Error('boom');
      },
      debugLabel: 'test failure',
      fallbackMessage: 'fallback',
      setPending,
      setError,
      onError,
    });

    expect(result).toBeUndefined();
    expect(setError).toHaveBeenNthCalledWith(1, null);
    expect(setError).toHaveBeenNthCalledWith(2, 'boom');
    expect(setPending).toHaveBeenNthCalledWith(1, true);
    expect(setPending).toHaveBeenLastCalledWith(false);
    expect(onError).toHaveBeenCalledWith('boom', expect.any(Error));
  });
});
