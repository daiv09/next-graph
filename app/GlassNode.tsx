'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { motion } from 'framer-motion';

type NodeKind = 'root' | 'folder' | 'file' | 'dependency';

export type GlassNodeData = {
  label: string;
  nodeType: NodeKind;
  language?: string;
  size?: number;
  description?: string;
};

export type GlassNodeType = Node<GlassNodeData, 'glass'>;

const getIcon = (kind: NodeKind, lang?: string): string => {
  if (kind === 'root') return '🏠';
  if (kind === 'folder') return '📂';
  if (kind === 'dependency') return '📦';
  const mapping: Record<string, string> = {
    TypeScript: '🔷',
    JavaScript: '🟡',
    CSS: '🎨',
    JSON: '📋',
    HTML: '🌐',
  };
  return lang ? (mapping[lang] ?? '📄') : '📄';
};

const getAccent = (kind: NodeKind): string => {
  if (kind === 'root') return 'from-violet-500/40 to-fuchsia-500/40 border-violet-400/40';
  if (kind === 'folder') return 'from-sky-500/30 to-cyan-500/30 border-sky-400/30';
  if (kind === 'dependency') return 'from-amber-500/30 to-orange-500/30 border-amber-400/30';
  return 'from-white/10 to-white/5 border-white/20';
};

const GlassNodeComponent = ({ data, selected }: NodeProps<GlassNodeType>) => {
  const { label, nodeType, language, size, description } = data;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 120,
        damping: 14,
      }}
      className={[
        'relative flex flex-col justify-center gap-1 px-4 py-3 rounded-2xl cursor-default select-none',
        'bg-white/10 backdrop-blur-2xl border transition-all duration-300',
        'shadow-glass-depth',
        getAccent(nodeType),
        selected
          ? 'ring-2 ring-white/50 shadow-glass-glow'
          : 'hover:shadow-glass-depth-hover hover:border-white/30',
      ].join(' ')}
      style={{ width: 180, minHeight: 72 }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-white/40 !border-white/60 !rounded-full"
      />
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0" aria-hidden="true">
          {getIcon(nodeType, language)}
        </span>
        <span className="text-sm font-medium text-white/90 truncate">{label}</span>
      </div>
      {(language ?? description ?? size !== undefined) && (
        <div className="flex items-center gap-2">
          {language && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 uppercase tracking-widest">
              {language}
            </span>
          )}
          {size !== undefined && (
            <span className="text-[10px] text-white/40">
              {size >= 1024 ? `${(size / 1024).toFixed(1)} kB` : `${size} B`}
            </span>
          )}
          {description && !language && (
            <span className="text-[10px] text-white/50 truncate">{description}</span>
          )}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-white/40 !border-white/60 !rounded-full"
      />
    </motion.div>
  );
};

export const GlassNode = memo(GlassNodeComponent);
GlassNode.displayName = 'GlassNode';
