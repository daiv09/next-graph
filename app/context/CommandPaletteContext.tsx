'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface CommandPaletteContextType {
  isOpen: boolean;
  activeItemId: string | null;
  toggle: () => void;
  close: () => void;
  open: () => void;
  setActiveItemId: (id: string | null) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
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

  return (
    <CommandPaletteContext.Provider value={{ isOpen, activeItemId, toggle, close, open, setActiveItemId }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPaletteContext() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPaletteContext must be used within a CommandPaletteProvider');
  }
  return context;
}
