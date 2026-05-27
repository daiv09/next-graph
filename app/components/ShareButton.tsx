'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactFlow } from '@xyflow/react';
import { encodeShareState } from '../utils/shareState';
import type { FilterState } from './FilterBar';

interface ShareButtonProps {
  repoUrl: string;
  filters: FilterState;
}

export function ShareButton({ repoUrl, filters }: ShareButtonProps) {
  const { getViewport } = useReactFlow();
  const [showTooltip, setShowTooltip] = useState(false);

  const handleShare = async () => {
    if (!repoUrl) return;

    const viewport = getViewport();
    
    // Construct filter object for serialization (simplified)
    const filterData = {
      type: 'custom',
      value: JSON.stringify(filters)
    };

    const state = {
      repoUrl,
      filter: filterData,
      viewport
    };

    const encoded = encodeShareState(state);
    
    // Update the URL without reloading the page
    const newUrl = `${window.location.pathname}?s=${encoded}`;
    window.history.replaceState(null, '', newUrl);

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(window.location.origin + newUrl);
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2000);
    } catch (e) {
      console.error('Failed to copy to clipboard', e);
    }
  };

  return (
    <div className="relative">
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={handleShare}
        style={{
          padding: '8px 16px',
          borderRadius: 12,
          border: '1.5px solid rgba(16, 185, 129, 0.5)', // Emerald/Green theme for share
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.8)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          transition: 'background 0.2s, color 0.2s, transform 0.1s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        whileHover={{ background: 'rgba(16, 185, 129, 0.25)', color: '#fff' }}
        whileTap={{ scale: 0.95 }}
        title="Share this exact view"
      >
        🔗 Share
      </motion.button>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '8px',
              padding: '6px 12px',
              background: 'rgba(16, 185, 129, 0.9)',
              color: 'white',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '8px',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              pointerEvents: 'none'
            }}
          >
            Copied!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
