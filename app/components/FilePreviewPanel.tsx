'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface FilePreviewPanelProps {
  repoUrl: string;
  path: string;
  label: string;
  size?: number;
  nodeType: string;
  onClose: () => void;
}

export default function FilePreviewPanel({
  repoUrl,
  path,
  label,
  size,
  nodeType,
  onClose,
}: FilePreviewPanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      setContent(null);
      try {
        const response = await fetch('http://localhost:8000/file-content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repo_url: repoUrl,
            path: path,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        if (active) {
          setContent(data.content);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Failed to load file contents.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchContent();

    return () => {
      active = false;
    };
  }, [repoUrl, path]);

  // Format file size
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // Generate line numbers helper
  const renderLines = () => {
    if (!content) return null;
    const lines = content.split('\n');
    return (
      <div className="flex w-full text-left font-mono text-[11px] leading-6 select-text overflow-x-auto">
        {/* Line numbers gutter */}
        <div className="pr-4 border-r border-white/5 text-white/20 text-right select-none w-10 shrink-0 font-light">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Code Content */}
        <pre className="pl-4 text-white/80 flex-1 whitespace-pre tab-size-2 select-text font-normal font-mono">
          <code>
            {lines.map((line, i) => (
              <span key={i} className="block min-h-[1.5rem]">
                {line || ' '}
              </span>
            ))}
          </code>
        </pre>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0.8 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.8 }}
      transition={{ type: 'spring', damping: 24, stiffness: 120 }}
      className="fixed top-0 right-0 h-full w-[450px] md:w-[650px] z-40 bg-[#0b0b14]/85 backdrop-blur-3xl border-l border-white/10 flex flex-col shadow-[-10px_0_35px_rgba(0,0,0,0.6)]"
      role="dialog"
      aria-label={`File preview for ${label}`}
    >
      {/* Top Header Section */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all duration-200 active:scale-95 cursor-pointer mr-1"
            aria-label="Close preview"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white/95 truncate" title={label}>
              {label}
            </h2>
            <p className="text-[10px] text-white/40 truncate font-mono mt-0.5" title={path}>
              {path}
            </p>
          </div>
        </div>

        {size !== undefined && (
          <span className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/5 text-white/60 font-mono">
            {formatBytes(size)}
          </span>
        )}
      </div>

      {/* Code / Content Area */}
      <div className="flex-1 overflow-y-auto p-6 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b0b14]/20">
            <svg className="w-8 h-8 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" className="opacity-30"/>
              <path strokeLinecap="round" d="M12 3a9 9 0 0 1 9 9"/>
            </svg>
            <p className="text-xs text-white/40 mt-3 font-mono">Retrieving raw code contents...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-[#0b0b14]/20">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-lg mb-3">
              ⚠
            </div>
            <p className="text-xs font-semibold text-white/90">Could not load preview</p>
            <p className="text-[11px] text-white/40 mt-1 max-w-xs">{error}</p>
          </div>
        )}

        {!loading && !error && content !== null && (
          <div className="h-full">
            {content.trim() === '' ? (
              <div className="h-full flex items-center justify-center text-xs text-white/30 font-mono">
                Empty File
              </div>
            ) : (
              renderLines()
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
