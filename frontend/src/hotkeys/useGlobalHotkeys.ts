import { useEffect, useRef } from 'react';

import { isEditableTarget } from './hotkeyGuards';
import { matchHotkey } from './matchHotkey';
import type { HotkeyDefinition } from './types';

export const useGlobalHotkeys = (bindings: HotkeyDefinition[]): void => {
  const bindingsRef = useRef(bindings);

  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }

      const activeBindings = bindingsRef.current;
      for (const binding of activeBindings) {
        if (binding.enabled === false) {
          continue;
        }
        if (!binding.allowInInput && isEditableTarget(event.target)) {
          continue;
        }
        if (!matchHotkey(event, binding.combo)) {
          continue;
        }

        if (binding.preventDefault !== false) {
          event.preventDefault();
        }
        binding.handler(event);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
};
