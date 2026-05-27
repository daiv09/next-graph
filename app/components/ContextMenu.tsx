'use client';
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  onFocus: () => void;
  onAnnotate: () => void;
  onViewDetails: () => void;
}

export function ContextMenu({ x, y, isOpen, onClose, onFocus, onAnnotate, onViewDetails }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // Adjust position if it flows out of the screen
  const menuWidth = 160;
  const menuHeight = 120;
  
  // Use a heuristic for window size since we're in SSR environment sometimes
  const safeX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - menuWidth - 20) : x;
  const safeY = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - menuHeight - 20) : y;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.9, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -5 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: safeY,
            left: safeX,
            zIndex: 100,
            width: menuWidth,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '6px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
          }}
        >
          <MenuButton label="Focus Node" onClick={() => { onFocus(); onClose(); }} />
          <MenuButton label="Add Annotation" onClick={() => { onAnnotate(); onClose(); }} />
          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '2px 6px' }} />
          <MenuButton label="View Details" onClick={() => { onViewDetails(); onClose(); }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '8px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: '8px',
        color: 'rgba(255,255,255,0.85)',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {label}
    </button>
  );
}
