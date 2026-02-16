import { useCallback, useEffect, useRef, useState } from 'react';

import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'primary';
}

interface ConfirmState extends ConfirmOptions {
  id: number;
}

export const useConfirm = () => {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const requestIdRef = useRef(0);

  const close = useCallback((confirmed: boolean) => {
    if (resolverRef.current) {
      resolverRef.current(confirmed);
      resolverRef.current = null;
    }
    setState(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    requestIdRef.current += 1;
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({
        ...options,
        id: requestIdRef.current,
      });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false);
      }
    };
  }, []);

  const ConfirmDialogRenderer = () => (
    <ConfirmDialog
      isOpen={Boolean(state)}
      title={state?.title}
      message={state?.message ?? ''}
      confirmText={state?.confirmText}
      cancelText={state?.cancelText}
      tone={state?.tone}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, ConfirmDialogRenderer };
};
