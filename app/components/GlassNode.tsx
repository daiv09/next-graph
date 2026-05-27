import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { type GlassNodeData } from '../types';

export const GlassNode = memo(({ data }: { data: GlassNodeData }) => {
  // We check for both 'dir' and 'folder' just in case the backend payload varies
  const isDirectory = data.nodeType === 'dir' || data.nodeType === 'folder';
  const name = data.label;

  // Your Icon logic
  const Icon = isDirectory
    ? (name === '..' ? '📂' : name.startsWith('node_modules') ? '📦' : '📁')
    : (name.endsWith('.ts') || name.endsWith('.tsx') ? '📘' :
      name.endsWith('.js') || name.endsWith('.jsx') ? '📙' :
        name.endsWith('.css') ? '📕' : '📄'); // Added generic document fallback

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      className="px-3 py-2 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-2 min-w-[140px]"
    >
      {/* Invisible Target Handle (Incoming) */}
      <Handle
        type="target"
        position={Position.Top}
        className="opacity-0 pointer-events-none"
      />

      {/* Render the calculated Icon */}
      <span className="text-base shrink-0">{Icon}</span>

      {/* Node Label and optional Size */}
      <div className="flex flex-col min-w-0">
        <h3 className="text-sm font-medium text-white/90 truncate">{name}</h3>
        {data.size !== undefined && !isDirectory && (
          <span className="text-[9px] text-white/40 font-mono">
            {(data.size / 1024).toFixed(1)} KB
          </span>
        )}
      </div>

      {/* Invisible Source Handle (Outgoing) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="opacity-0 pointer-events-none"
      />
    </motion.div>
  );
});

// Adding a display name is good practice when using memo
GlassNode.displayName = 'GlassNode';