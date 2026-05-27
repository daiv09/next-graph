'use client';
// app/components/CommitTimeline.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCommitContext } from '../context/CommitContext';
import { useTimelineAnimation } from '../hooks/useTimelineAnimation';
import { useCommitHistory } from '../hooks/useCommitHistory';

export function CommitTimeline({ repoUrl }: { repoUrl: string }) {
  const { commits, selectedIndex, setSelectedIndex, isPlaying, speed, setSpeed } = useCommitContext();
  const { togglePlay } = useTimelineAnimation();
  const { loading, error } = useCommitHistory(repoUrl);
  const [tooltip, setTooltip] = useState<string | null>(null);

  if (!repoUrl) return null;
  if (loading) return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-black/50 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-white/70 text-sm">
      ⏳ Loading commit history…
    </div>
  );
  if (error) return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-red-950/80 backdrop-blur-md px-6 py-3 rounded-full border border-red-500/30 text-red-400 text-sm">
      ⚠ {error}
    </div>
  );
  if (commits.length === 0) return null;

  const currentCommit = commits[selectedIndex];
  if (!currentCommit) return null;

  const total = commits.length - 1;
  const addedCount = currentCommit.added?.length || 0;
  const modifiedCount = currentCommit.modified?.length || 0;
  const deletedCount = currentCommit.deleted?.length || 0;

  const formattedDate = new Date(currentCommit.date).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <motion.div 
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-4xl"
    >
      <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col gap-4 relative overflow-visible ring-1 ring-white/5">
        {/* Subtle top glare */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Top Info Bar */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-5">
            <button 
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all focus:outline-none shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95 border border-white/10"
            >
              {isPlaying ? (
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
              ) : (
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <div className="flex flex-col gap-0.5">
              <span className="text-white/95 text-[15px] font-medium truncate max-w-[350px]" title={currentCommit.message}>
                {currentCommit.message}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-white/40 font-mono">
                <span className="text-white/60">{currentCommit.sha.substring(0, 7)}</span>
                <span>•</span>
                <span>{formattedDate}</span>
                <span>•</span>
                <span className="text-purple-400/80">{selectedIndex + 1}/{commits.length}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <AnimatePresence mode="popLayout">
              {addedCount > 0 && (
                <motion.div key="added" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(74,222,128,0.1)]">
                  <span className="text-green-400 text-xs font-bold">+{addedCount}</span>
                  <span className="text-green-500/60 text-[10px] uppercase tracking-wider font-semibold">Added</span>
                </motion.div>
              )}
              {modifiedCount > 0 && (
                <motion.div key="modified" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.1)]">
                  <span className="text-amber-400 text-xs font-bold">~{modifiedCount}</span>
                  <span className="text-amber-500/60 text-[10px] uppercase tracking-wider font-semibold">Modified</span>
                </motion.div>
              )}
              {deletedCount > 0 && (
                <motion.div key="deleted" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(248,113,113,0.1)]">
                  <span className="text-red-400 text-xs font-bold">-{deletedCount}</span>
                  <span className="text-red-500/60 text-[10px] uppercase tracking-wider font-semibold">Deleted</span>
                </motion.div>
              )}
            </AnimatePresence>
            <select
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="ml-2 bg-white/5 border border-white/10 rounded-lg text-white/70 text-[11px] py-1.5 px-2 outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
            >
              <option value={1600}>0.5×</option>
              <option value={800}>1×</option>
              <option value={400}>2×</option>
              <option value={200}>4×</option>
            </select>
          </div>
        </div>

        {/* Range Slider */}
        <div className="px-2 pb-1 relative flex items-center group">
          <input 
            type="range"
            min={0}
            max={total}
            value={selectedIndex}
            onChange={(e) => {
              if (isPlaying) togglePlay(); 
              setSelectedIndex(Number(e.target.value));
            }}
            onMouseMove={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              const idx = Math.max(0, Math.min(total, Math.round(pct * total)));
              const c = commits[idx];
              if (c) {
                 const d = new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                 setTooltip(`${d}: ${c.message.slice(0, 30)}${c.message.length > 30 ? '...' : ''}`);
              }
            }}
            onMouseLeave={() => setTooltip(null)}
            className="w-full h-1.5 appearance-none bg-white/10 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,1)] hover:[&::-webkit-slider-thumb]:scale-125 [&::-webkit-slider-thumb]:transition-transform"
          />
          {/* Progress fill overlay */}
          <div 
            className="absolute left-2 h-1.5 bg-white rounded-full pointer-events-none transition-all duration-300 ease-linear shadow-[0_0_12px_rgba(255,255,255,0.7)]"
            style={{ width: `calc(${total > 0 ? (selectedIndex / total) * 100 : 0}% - 8px)` }}
          />
          
          {/* Tooltip */}
          <AnimatePresence>
            {tooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/90 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white shadow-xl pointer-events-none whitespace-nowrap z-50 backdrop-blur-md"
              >
                {tooltip}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
