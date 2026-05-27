'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactFlow } from '@xyflow/react';
import { exportToPng, exportToSvg, exportToJson } from '../utils/exportGraph';

export function ExportMenu({ projectName = 'RepoGraph' }: { projectName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleExport = (type: 'png' | 'svg' | 'json') => {
    if (type === 'png') exportToPng(projectName);
    if (type === 'svg') exportToSvg(projectName);
    if (type === 'json') exportToJson(reactFlowInstance, projectName);
    setIsOpen(false);
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -5 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.05, duration: 0.2 },
    }),
  };

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
          borderRadius: 12,
          border: '1.5px solid rgba(255, 255, 255, 0.2)',
          background: isOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.9)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          transition: 'background 0.2s, color 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        whileHover={{ background: 'rgba(255,255,255,0.15)' }}
        whileTap={{ scale: 0.95 }}
        title="Export Graph"
      >
        Export
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              padding: '6px',
              background: 'rgba(20, 20, 25, 0.85)',
              backdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              minWidth: '160px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 50,
            }}
          >
            {[
              { id: 'png', label: 'PNG Image', shortcut: '⇧⌘P' },
              { id: 'svg', label: 'SVG Vector', shortcut: '⇧⌘V' },
              { id: 'json', label: 'JSON Data', shortcut: '⇧⌘J' },
            ].map((item, i) => (
              <motion.button
                key={item.id}
                custom={i}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                onClick={() => handleExport(item.id as 'png' | 'svg' | 'json')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                  {item.shortcut}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
