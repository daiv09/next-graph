// SearchBar.tsx
'use client';

import {AnimatePresence} from 'framer-motion';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { FetchStatus } from '../types';

export interface SearchBarProps {
  status: FetchStatus;
  errorMessage: string;
  onSubmit: (url: string) => void;
  isFilterOpen: boolean;
  onToggleFilter: () => void;
}

export function SearchBar({ status, errorMessage, onSubmit, isFilterOpen, onToggleFilter }: SearchBarProps) {
  const [url, setUrl] = useState('');
  const [focused, setFocused] = useState(false);
  const loading = status === 'loading';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;
    onSubmit(url.trim());
  };

  return (
    <motion.div
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 140, damping: 18 }}
      className="w-full relative z-20"
      role="search"
    >
      <form
        onSubmit={handleSubmit}
        className={[
          'flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-2xl border transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
          status === 'error'
            ? 'border-red-400/50 shadow-[0_0_20px_rgba(248,113,113,0.2)]'
            : focused
              ? 'border-blue-400/50 shadow-[0_0_24px_rgba(96,165,250,0.25)]'
              : 'border-white/20',
        ].join(' ')}
      >
        {/* GitHub mark */}
        <svg className="w-5 h-5 text-white/50 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
        </svg>

        <input
          id="github-url-input"
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="https://github.com/owner/repository"
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-white placeholder-white/35 outline-none"
          aria-label="GitHub repository URL"
        />

        <button
          id="search-submit-btn"
          type="submit"
          disabled={loading || !url.trim()}
          aria-label={loading ? 'Loading…' : 'Visualize'}
          className={[
            'flex items-center justify-center w-8 h-8 rounded-xl shrink-0 transition-all duration-200 mr-1',
            loading || !url.trim()
              ? 'bg-white/10 text-white/30 cursor-not-allowed'
              : 'bg-violet-500/70 text-white hover:bg-violet-500/90 active:scale-95',
          ].join(' ')}
        >
          {loading
            ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" className="opacity-30" /><path strokeLinecap="round" d="M12 3a9 9 0 0 1 9 9" /></svg>
            : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
          }
        </button>

        <button
          type="button"
          onClick={onToggleFilter}
          className={[
            'flex items-center gap-1.5 px-3 h-8 rounded-xl shrink-0 transition-all duration-200 text-xs font-semibold select-none border cursor-pointer',
            isFilterOpen
              ? 'bg-violet-500/20 text-violet-200 border-violet-500/40 shadow-sm'
              : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white',
          ].join(' ')}
          aria-label="Toggle filters"
        >
          <span>⚙</span>
          <span>Filters</span>
        </button>
      </form>

      <AnimatePresence mode="wait">
        {status === 'error' && (
          <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 text-center text-[11px] text-red-400/90"
          >
            {errorMessage}
          </motion.p>
        )}
        {status === 'idle' && !url && (
          <motion.p key="hint" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 text-center text-[11px] text-white/35"
          >
            Enter a GitHub repository URL to visualize its structure
          </motion.p>
        )}
        {status === 'success' && (
          <motion.p key="ok" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 text-center text-[11px] text-emerald-400/80"
          >
            ✓ Graph loaded successfully
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
