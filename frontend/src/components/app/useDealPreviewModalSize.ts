import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export const DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY = 'crm:deal-preview-modal:size:v1';
export const MIN_DEAL_PREVIEW_MODAL_WIDTH_PX = 720;
export const MIN_DEAL_PREVIEW_MODAL_HEIGHT_PX = 560;

const VIEWPORT_GAP_PX = 32;
const DEFAULT_VIEWPORT_RATIO = 0.8;
const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

export type DealPreviewModalSize = {
  width: number;
  height: number;
};

type DealPreviewModalSizeBounds = {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getBounds = (): DealPreviewModalSizeBounds => {
  const maxWidth = Math.max(1, window.innerWidth - VIEWPORT_GAP_PX);
  const maxHeight = Math.max(1, window.innerHeight - VIEWPORT_GAP_PX);
  return {
    minWidth: Math.min(MIN_DEAL_PREVIEW_MODAL_WIDTH_PX, maxWidth),
    maxWidth,
    minHeight: Math.min(MIN_DEAL_PREVIEW_MODAL_HEIGHT_PX, maxHeight),
    maxHeight,
  };
};

export const normalizeDealPreviewModalSize = (size: DealPreviewModalSize): DealPreviewModalSize => {
  const bounds = getBounds();
  return {
    width: Math.round(clamp(size.width, bounds.minWidth, bounds.maxWidth)),
    height: Math.round(clamp(size.height, bounds.minHeight, bounds.maxHeight)),
  };
};

export const getDefaultDealPreviewModalSize = (): DealPreviewModalSize =>
  normalizeDealPreviewModalSize({
    width: window.innerWidth * DEFAULT_VIEWPORT_RATIO,
    height: window.innerHeight * DEFAULT_VIEWPORT_RATIO,
  });

export const parseStoredDealPreviewModalSize = (
  raw: string | null,
): DealPreviewModalSize | null => {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== 'object' ||
      value === null ||
      !('width' in value) ||
      !('height' in value)
    ) {
      return null;
    }
    const { width, height } = value;
    if (
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      return null;
    }
    return normalizeDealPreviewModalSize({ width, height });
  } catch {
    return null;
  }
};

const getInitialDesktopState = () =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia(DESKTOP_MEDIA_QUERY).matches;

export function useDealPreviewModalSize() {
  const [isDesktop, setIsDesktop] = useState(getInitialDesktopState);
  const [size, setSize] = useState<DealPreviewModalSize>(() =>
    typeof window === 'undefined'
      ? { width: MIN_DEAL_PREVIEW_MODAL_WIDTH_PX, height: MIN_DEAL_PREVIEW_MODAL_HEIGHT_PX }
      : getDefaultDealPreviewModalSize(),
  );

  const saveSize = useCallback((nextSize: DealPreviewModalSize) => {
    const normalizedSize = normalizeDealPreviewModalSize(nextSize);
    setSize(normalizedSize);
    window.localStorage.setItem(
      DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY,
      JSON.stringify(normalizedSize),
    );
  }, []);

  const resetSize = useCallback(() => {
    saveSize(getDefaultDealPreviewModalSize());
  }, [saveSize]);

  useEffect(() => {
    const storedSize = parseStoredDealPreviewModalSize(
      window.localStorage.getItem(DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY),
    );
    if (storedSize) setSize(storedSize);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const updateDesktopState = () => setIsDesktop(media.matches);
    updateDesktopState();
    media.addEventListener('change', updateDesktopState);
    return () => media.removeEventListener('change', updateDesktopState);
  }, []);

  useEffect(() => {
    const handleWindowResize = () => {
      if (!isDesktop) return;
      setSize((currentSize) => {
        const normalizedSize = normalizeDealPreviewModalSize(currentSize);
        window.localStorage.setItem(
          DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY,
          JSON.stringify(normalizedSize),
        );
        return normalizedSize;
      });
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [isDesktop]);

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isDesktop) return;
      const panel = event.currentTarget.closest<HTMLElement>('[role="dialog"]');
      if (!panel) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const startX = event.clientX;
      const startY = event.clientY;
      const { width, height } = panel.getBoundingClientRect();
      const handlePointerMove = (moveEvent: PointerEvent) =>
        saveSize({
          width: width + moveEvent.clientX - startX,
          height: height + moveEvent.clientY - startY,
        });
      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp, { once: true });
    },
    [isDesktop, saveSize],
  );

  const handleResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (!isDesktop || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const step = event.shiftKey ? 48 : 16;
      saveSize({
        width:
          size.width + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
        height:
          size.height + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0),
      });
    },
    [isDesktop, saveSize, size],
  );

  return {
    isDesktop,
    size,
    resetSize,
    handleResizePointerDown,
    handleResizeKeyDown,
  };
}
