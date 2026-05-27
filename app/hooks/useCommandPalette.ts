'use client';
import { useState, useCallback, useEffect } from 'react';

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const toggle = useCallback(() => setIsOpen(v => !v), []);
  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => setIsOpen(true), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Listen for Ctrl+Alt+Space
      if (e.key === ' ' && e.ctrlKey && e.altKey) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [toggle]);

  return {
    isOpen,
    toggle,
    close,
    open,
    activeItemId,
    setActiveItemId,
  };
}
