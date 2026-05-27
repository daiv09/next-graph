'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface FilterState {
  search: string;
  showFolders: boolean;
  showFiles: boolean;
  showDependencies: boolean;
  minSizeKb: number; // 0 for All, or thresholds
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (updater: (prev: FilterState) => FilterState) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const toggleFolders = () => {
    onChange((prev) => ({ ...prev, showFolders: !prev.showFolders }));
  };

  const toggleFiles = () => {
    onChange((prev) => ({ ...prev, showFiles: !prev.showFiles }));
  };

  const toggleDependencies = () => {
    onChange((prev) => ({ ...prev, showDependencies: !prev.showDependencies }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange((prev) => ({ ...prev, search: e.target.value }));
  };

  const selectMinSize = (kb: number) => {
    onChange((prev) => ({ ...prev, minSizeKb: kb }));
  };

  const clearFilters = () => {
    onChange(() => ({
      search: '',
      showFolders: true,
      showFiles: true,
      showDependencies: true,
      minSizeKb: 0,
    }));
  };

  const isFiltered =
    filters.search !== '' ||
    !filters.showFolders ||
    !filters.showFiles ||
    !filters.showDependencies ||
    filters.minSizeKb !== 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={[
        'w-full max-w-4xl mx-auto mt-4 px-4 py-3 z-20 relative flex flex-wrap gap-4 items-center justify-between',
        'bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-glass-depth',
      ].join(' ')}
    >
      {/* Search files */}
      <div className="flex-1 min-w-[200px] relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">🔍</span>
        <input
          type="text"
          value={filters.search}
          onChange={handleSearchChange}
          placeholder="Filter nodes by name..."
          className={[
            'w-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-white/30',
            'bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-violet-500/50 transition-colors',
          ].join(' ')}
        />
      </div>

      {/* Toggles for Node types */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleFolders}
          className={[
            'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer select-none',
            filters.showFolders
              ? 'bg-sky-500/20 text-sky-200 border-sky-500/30'
              : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10',
          ].join(' ')}
        >
          📂 Folders
        </button>

        <button
          onClick={toggleFiles}
          className={[
            'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer select-none',
            filters.showFiles
              ? 'bg-violet-500/20 text-violet-200 border-violet-500/30'
              : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10',
          ].join(' ')}
        >
          📄 Files
        </button>

        <button
          onClick={toggleDependencies}
          className={[
            'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer select-none',
            filters.showDependencies
              ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
              : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10',
          ].join(' ')}
        >
          📦 Deps
        </button>
      </div>

      {/* Size Thresholds */}
      <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-xl p-0.5">
        {[
          { label: 'All size', value: 0 },
          { label: '>1 KB', value: 1 },
          { label: '>10 KB', value: 10 },
          { label: '>50 KB', value: 50 },
        ].map((th) => (
          <button
            key={th.value}
            onClick={() => selectMinSize(th.value)}
            className={[
              'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer select-none',
              filters.minSizeKb === th.value
                ? 'bg-white/10 text-white border border-white/10 shadow-sm'
                : 'text-white/40 hover:text-white/70 border border-transparent',
            ].join(' ')}
          >
            {th.label}
          </button>
        ))}
      </div>

      {/* Reset filters button */}
      {isFiltered && (
        <button
          onClick={clearFilters}
          className={[
            'px-3 py-1.5 rounded-xl text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors',
            'bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 cursor-pointer',
          ].join(' ')}
        >
          Reset
        </button>
      )}
    </motion.div>
  );
}
