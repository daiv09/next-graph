'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function HeatmapLegend() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col gap-2 pointer-events-none"
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">File Size</span>
      </div>
      
      {/* Gradient Bar */}
      <div 
        className="w-64 h-2 rounded-full border border-white/10"
        style={{
          background: 'linear-gradient(90deg, hsl(220, 85%, 60%) 0%, hsl(120, 85%, 60%) 50%, hsl(0, 85%, 60%) 100%)',
        }}
      />
      
      {/* Labels */}
      <div className="flex justify-between items-center w-full">
        <span className="text-[10px] text-white/70 font-mono">{'<'} 1KB</span>
        <span className="text-[10px] text-white/70 font-mono">10KB</span>
        <span className="text-[10px] text-white/70 font-mono">100KB</span>
        <span className="text-[10px] text-white/70 font-mono">1MB+</span>
      </div>
    </motion.div>
  );
}
