'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { API_BASE } from '../utils/constants';

interface FileMetrics {
  loc: number;
  functions: number;
  classes: number;
  complexity: number;
  rating: string;
  recommendation: string;
}

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
  // Extract extension to determine if it is previewable
  const ext = label.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const isPdf = ext === 'pdf';
  const isMarkdown = ext === 'md';
  const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
  const isPreviewable = isImage || isPdf || isMarkdown || isVideo;

  // If it's an image, PDF, or video, we might want to default to the preview tab instead of code
  const defaultTab = isImage || isPdf || isVideo ? 'preview' : 'code';

  const [content, setContent] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FileMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'metrics' | 'preview'>(defaultTab);

  // Construct the direct raw GitHub URL for binary rendering (bypassing backend)
  const getRawAssetUrl = () => {
    // Converts https://github.com/owner/repo -> https://raw.githubusercontent.com/owner/repo/main/path
    const baseUrl = repoUrl.replace('github.com', 'raw.githubusercontent.com');
    // Assuming 'main' branch. If you have branch state in the app, pass it as a prop.
    return `${baseUrl}/main/${path}`;
  };

  useEffect(() => {
    // Skip backend fetch entirely if we are just looking at an image, PDF, or video
    if (isImage || isPdf || isVideo) {
      setContent('Binary/Media file. View in Preview tab.');
      return;
    }

    let active = true;
    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      setContent(null);
      setMetrics(null);
      try {
        const response = await fetch(`${API_BASE}/file-content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo_url: repoUrl, path: path }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        if (active) {
          setContent(data.content);
          setMetrics(data.metrics || null);
        }
      } catch (err: any) {
        if (active) setError(err.message || 'Failed to load file contents.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchContent();
    return () => { active = false; };
  }, [repoUrl, path, isImage, isPdf, isVideo]);

  const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getLanguage = (filename: string) => {
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'py': return 'python';
      case 'json': return 'json';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'md': return 'markdown';
      case 'go': return 'go';
      case 'rs': return 'rust';
      default: return 'plaintext';
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'Low': return { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', stroke: '#10b981' };
      case 'Moderate': return { text: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/10', stroke: '#38bdf8' };
      case 'High': return { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', stroke: '#fbbf24' };
      case 'Critical': return { text: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', stroke: '#f43f5e' };
      default: return { text: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10', stroke: '#8b5cf6' };
    }
  };

  const ratingColors = metrics ? getRatingColor(metrics.rating) : getRatingColor('Low');
  const strokeDash = 251.2;
  const maxComplexity = 50;
  const complexityProgress = metrics ? Math.min(metrics.complexity / maxComplexity, 1) : 0.05;
  const strokeOffset = strokeDash * (1 - complexityProgress);

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0.8 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.8 }}
      transition={{ type: 'spring', damping: 24, stiffness: 120 }}
      className="fixed top-0 right-0 h-full w-[450px] md:w-[750px] z-40 bg-[#0b0b14]/95 backdrop-blur-3xl border-l border-white/10 flex flex-col shadow-[-10px_0_35px_rgba(0,0,0,0.6)]"
      role="dialog"
      aria-label={`File preview for ${label}`}
    >
      {/* Top Header Section */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all duration-200 active:scale-95 cursor-pointer mr-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white/95 truncate" title={label}>{label}</h2>
            <p className="text-[10px] text-white/40 truncate font-mono mt-0.5" title={path}>{path}</p>
          </div>
        </div>
        {size !== undefined && (
          <span className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/5 text-white/60 font-mono">
            {formatBytes(size)}
          </span>
        )}
      </div>

      {/* Tabs Selector */}
      <div className="px-6 py-3 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
        {/* --- TAB SELECTOR --- */}
        <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5 gap-1 self-start">
          {/* ONLY SHOW CODE TAB IF NOT BINARY/MEDIA */}
          {!isPreviewable && (
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${activeTab === 'code' ? 'bg-violet-600/70 text-white shadow-md' : 'text-white/60 hover:text-white/95'
                }`}
            >
              Code View
            </button>
          )}

          {/* Preview Tab */}
          {isPreviewable && (
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${activeTab === 'preview' ? 'bg-violet-600/70 text-white shadow-md' : 'text-white/60 hover:text-white/95'
                }`}
            >
              Preview
            </button>
          )}

          {/* Metrics Tab (Keep visible only if metrics exist) */}
          {!isPreviewable && (
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${activeTab === 'metrics' ? 'bg-violet-600/70 text-white shadow-md' : 'text-white/60 hover:text-white/95'
                }`}
            >
              Complexity Metrics
            </button>
          )}
        </div>

        {metrics && activeTab !== 'preview' && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ratingColors.border} ${ratingColors.bg} ${ratingColors.text} uppercase tracking-wider`}>
            {metrics.rating} Complexity
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {loading && activeTab !== 'preview' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b0b14]/20 z-10">
            <svg className="w-8 h-8 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" className="opacity-30" />
              <path strokeLinecap="round" d="M12 3a9 9 0 0 1 9 9" />
            </svg>
            <p className="text-xs text-white/40 mt-3 font-mono">Retrieving file data...</p>
          </div>
        )}

        {error && activeTab !== 'preview' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-[#0b0b14]/20 z-10">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-lg mb-3">⚠</div>
            <p className="text-xs font-semibold text-white/90">Could not load file</p>
            <p className="text-[11px] text-white/40 mt-1 max-w-xs">{error}</p>
          </div>
        )}

        {/* --- PREVIEW TAB --- */}
        {activeTab === 'preview' && (
          <div className="h-full w-full flex items-center justify-center p-6 bg-white/[0.01] overflow-auto">
            {isImage && (
              <img
                src={getRawAssetUrl()}
                alt={label}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
              />
            )}
            {isVideo && (
              <video
                src={getRawAssetUrl()}
                controls
                preload="metadata"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
              />
            )}
            {isPdf && (
              <iframe
                src={getRawAssetUrl()}
                className="w-full h-full rounded-xl border border-white/10 shadow-2xl bg-white"
                title="PDF Preview"
              />
            )}
            {isMarkdown && content && (
              <div className="prose prose-invert prose-violet max-w-none w-full h-full pb-12">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* --- CODE TAB --- */}
        {!isPreviewable && !loading && !error && activeTab === 'code' && (
          <div className="h-full w-full">
            <Editor
              height="100%"
              language={getLanguage(label)}
              theme="vs-dark"
              value={content || ''}
              options={{
                readOnly: true,
                minimap: { enabled: true },
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                folding: true,
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 16 }
              }}
            />
          </div>
        )}

        {/* --- METRICS TAB --- */}
        {!isPreviewable && activeTab === 'metrics' && (
          <div className="h-full overflow-y-auto p-6">
            {metrics ? (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                <div className="flex flex-col md:flex-row items-center gap-8 p-6 rounded-2xl bg-white/[0.02] border border-white/5 shadow-inner">
                  <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="56" cy="56" r="40" stroke="rgba(255,255,255,0.04)" strokeWidth="10" fill="transparent" />
                      <motion.circle
                        cx="56" cy="56" r="40" stroke={ratingColors.stroke} strokeWidth="10" fill="transparent"
                        strokeDasharray={strokeDash} initial={{ strokeDashoffset: strokeDash }}
                        animate={{ strokeDashoffset: strokeOffset }} transition={{ duration: 1, ease: 'easeOut' }} strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-xl font-bold text-white tracking-tight">{metrics.complexity}</span>
                      <span className="text-[9px] text-white/30 uppercase font-semibold mt-0.5">Score</span>
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left min-w-0">
                    <div className="text-xs text-white/40 uppercase tracking-widest font-bold font-mono">Structural Complexity Rating</div>
                    <h3 className={`text-2xl font-bold ${ratingColors.text} mt-1`}>{metrics.rating}</h3>
                    <p className="text-xs text-white/60 mt-2 font-light leading-relaxed">Estimated from control-flow branches, nesting depth, and conditional operators.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col">
                    <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider font-semibold">Lines of Code</span>
                    <span className="text-2xl font-bold text-white/90 mt-1 font-mono">{metrics.loc}</span>
                    <div className="h-1.5 w-full bg-white/5 rounded-full mt-3 overflow-hidden">
                      <div className="h-full bg-violet-500/70 rounded-full" style={{ width: `${Math.min((metrics.loc / 1000) * 100, 100)}%` }} />
                    </div>
                    <span className="text-[9px] text-white/20 mt-1.5 text-right font-mono">Max scale 1k LOC</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider font-semibold">Code Elements</span>
                      <div className="flex items-baseline gap-4 mt-2">
                        <div>
                          <span className="text-2xl font-bold text-white/90 font-mono">{metrics.functions}</span>
                          <span className="text-[9px] text-white/40 ml-1 font-mono">Funcs</span>
                        </div>
                        <div>
                          <span className="text-2xl font-bold text-white/90 font-mono">{metrics.classes}</span>
                          <span className="text-[9px] text-white/40 ml-1 font-mono">Classes</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] text-white/30 mt-3 font-mono">Definitions scanned</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 flex gap-4 items-start">
                  <div className={`w-8 h-8 rounded-lg ${ratingColors.bg} border ${ratingColors.border} flex items-center justify-center ${ratingColors.text} shrink-0 text-base`}>💡</div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Maintainability Advisory</h4>
                    <p className="text-xs text-white/60 leading-relaxed mt-1.5 font-light">{metrics.recommendation}</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-4 shadow-inner">📊</div>
                <h3 className="text-sm font-semibold text-white/90">Metrics Not Available</h3>
                <p className="text-xs text-white/40 mt-2 max-w-sm leading-relaxed">The backend did not return complexity data for this file type.</p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}