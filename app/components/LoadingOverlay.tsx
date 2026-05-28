// LoadingOverlay.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';

export function LoadingOverlay() {
  return (
    <AnimatePresence>
      <motion.div
        key="loading-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 z-30 flex flex-col items-center justify-center backdrop-blur-sm bg-[#080810]/60"
        aria-live="polite"
        aria-label="Fetching repository graph"
      >
        {/* Pulsing rings */}
        <div className="relative flex items-center justify-center mb-6">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-blue-400/40"
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, delay: i * 0.5, repeat: Infinity, ease: 'easeOut' }}
              style={{ width: 48, height: 48 }}
            />
          ))}
          <div className="w-12 h-12 rounded-full bg-blue-500/20 backdrop-blur-xl border border-blue-400/30 flex items-center justify-center">
            <svg className="w-5 h-5 animate-spin text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" className="opacity-30" />
              <path strokeLinecap="round" d="M12 3a9 9 0 0 1 9 9" />
            </svg>
          </div>
        </div>
        <p className="text-sm text-white/60">Parsing repository structure…</p>
        <p className="text-[11px] text-white/30 mt-1">Calling GitHub API</p>
      </motion.div>
    </AnimatePresence>
  );
}
