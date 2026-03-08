import { useState, useCallback, useRef, useEffect } from 'react';

interface UseResizableOptions {
  /** Initial width in pixels. */
  defaultWidth: number;
  /** Minimum width in pixels. */
  minWidth: number;
  /** Maximum width in pixels. */
  maxWidth: number;
  /** localStorage key to persist width. */
  storageKey?: string;
}

export function useResizable({ defaultWidth, minWidth, maxWidth, storageKey }: UseResizableOptions) {
  const [width, setWidth] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= minWidth && n <= maxWidth) return n;
      }
    }
    return defaultWidth;
  });

  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  /** 1 for left-to-right drag expanding, -1 for right-to-left. */
  const directionRef = useRef<1 | -1>(1);

  const startDrag = useCallback((e: React.MouseEvent, direction: 1 | -1 = 1) => {
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    directionRef.current = direction;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = (e.clientX - startXRef.current) * directionRef.current;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + dx));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [minWidth, maxWidth]);

  // Persist to localStorage on change.
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, String(width));
    }
  }, [width, storageKey]);

  return { width, startDrag };
}
