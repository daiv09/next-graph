// GlassNode.tsx — Supports cinematic timeline animation states
'use client';
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import {
  FolderFill, FileCodeFill, FiletypeJson, FileEarmarkTextFill,
  BoxSeam, PaletteFill, Globe, LayersFill, FileEarmarkCodeFill
} from 'react-bootstrap-icons';
import type { GlassNodeData, AnimState, NodeKind } from '../types';

// Wrapper for a consistent, premium icon badge
const GlassIcon = ({ children, colorClass }: { children: React.ReactNode, colorClass: string }) => (
  <div className={`flex items-center justify-center w-6 h-6 rounded-lg ${colorClass}`}>
    {children}
  </div>
);

const getIcon = (kind: NodeKind, lang?: string) => {
  const iconClass = "w-4 h-4";

  if (kind === 'root') return { icon: <LayersFill className={iconClass} />, color: "border-violet-500/30 text-violet-300" };
  if (kind === 'folder' || kind === 'dir') return { icon: <FolderFill className={iconClass} />, color: "border-sky-500/30 text-sky-300" };
  if (kind === 'dependency') return { icon: <BoxSeam className={iconClass} />, color: "border-amber-500/30 text-amber-300" };

  const mapping: Record<string, string> = {
    TypeScript: "border-blue-500/30 text-blue-300",
    JavaScript: "border-yellow-500/30 text-yellow-300",
    CSS: "border-pink-500/30 text-pink-300",
    JSON: "border-emerald-500/30 text-emerald-300",
    HTML: "border-orange-500/30 text-orange-300",
  };

  const color = lang ? (mapping[lang] ?? "border-white/20 text-white/50") : "border-white/20 text-white/50";

  let icon = <FileEarmarkTextFill className={iconClass} />;
  if (lang === 'TypeScript' || lang === 'JavaScript') icon = <FileCodeFill className={iconClass} />;
  else if (lang === 'JSON') icon = <FiletypeJson className={iconClass} />;
  else if (lang === 'CSS') icon = <PaletteFill className={iconClass} />;
  else if (lang === 'HTML') icon = <Globe className={iconClass} />;
  else if (lang) icon = <FileEarmarkCodeFill className={iconClass} />;

  return { icon, color };
};

// ── Visual config per animation state ──────────────────────────────────────
const STATE_STYLES: Record<
  AnimState,
  { border: string; glow: string; badge?: string; badgeColor?: string }
> = {
  entering: {
    border: 'rgba(74,222,128,0.8)',
    glow: '0 0 18px 4px rgba(74,222,128,0.45), 0 8px 32px rgba(0,0,0,0.5)',
    badge: '✦ NEW',
    badgeColor: '#4ade80',
  },
  modified: {
    border: 'rgba(251,191,36,0.8)',
    glow: '0 0 18px 4px rgba(251,191,36,0.38), 0 8px 32px rgba(0,0,0,0.5)',
    badge: '✎ MOD',
    badgeColor: '#fbbf24',
  },
  visible: {
    border: 'rgba(255,255,255,0.20)',
    glow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  hidden: {
    border: 'rgba(255,255,255,0.05)',
    glow: 'none',
  },
};

// ── Framer Motion variants ──────────────────────────────────────────────────
const nodeVariants = {
  entering: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 220, damping: 16 },
  },
  modified: {
    opacity: 1,
    scale: [1, 1.06, 1],
    transition: { duration: 0.55, ease: 'easeInOut' },
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35 },
  },
  hidden: {
    opacity: 0,
    scale: 0.75,
    transition: { duration: 0.4 },
  },
  initial_entering: { opacity: 0, scale: 0.5 },
  initial_modified: { opacity: 0.8, scale: 0.95 },
  initial_visible: { opacity: 0, scale: 0.9 },
  initial_hidden: { opacity: 0, scale: 0.75 },
};

export const GlassNode = memo(({ data, style }: { data: GlassNodeData; style?: React.CSSProperties }) => {
  const isDirectory = data.nodeType === 'dir' || data.nodeType === 'folder' || data.nodeType === 'root';
  const name = data.label;
  const animState: AnimState = data.animState ?? 'visible';
  const stateStyle = STATE_STYLES[animState];

  const { icon, color } = getIcon(data.nodeType, data.language);

  return (
    <motion.div
      key={`${animState}-${data.isHighlighted ? 'highlight' : ''}-${data.isDimmed ? 'dim' : ''}`}
      initial={
        animState === 'entering'
          ? { opacity: 0, scale: 0.4 }
          : animState === 'modified'
          ? { opacity: 0.7, scale: 0.95 }
          : { opacity: data.isDimmed ? 0.2 : 0, scale: 0.9 }
      }
      animate={{
        ...nodeVariants[animState],
        opacity: data.isDimmed ? 0.2 : nodeVariants[animState].opacity,
        scale: data.isHighlighted ? 1.05 : nodeVariants[animState].scale,
      } as any}
      style={{
        padding: '8px 12px',
        background: style?.backgroundColor ||
          animState === 'entering'
            ? 'rgba(74,222,128,0.08)'
            : animState === 'modified'
            ? 'rgba(251,191,36,0.08)'
            : 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: data.isHighlighted 
          ? '2px solid rgba(14,165,233,1)' 
          : style?.borderColor ? `1.5px solid ${style.borderColor}` : `1.5px solid ${data.isDimmed ? 'rgba(255,255,255,0.02)' : stateStyle.border}`,
        borderRadius: 14,
        boxShadow: data.isHighlighted 
          ? '0 0 20px 5px rgba(14,165,233,0.6), 0 8px 32px rgba(0,0,0,0.5)'
          : style?.borderColor ? `0 0 15px 2px ${style.borderColor}, 0 8px 32px rgba(0,0,0,0.5)` : (data.isDimmed ? 'none' : stateStyle.glow),
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 140,
        position: 'relative',
        transition: 'border-color 0.4s ease, box-shadow 0.4s ease, background 0.4s ease',
        pointerEvents: animState === 'hidden' ? 'none' : 'auto',
      }}
    >
      {/* Badge for new / modified */}
      {stateStyle.badge && (
        <motion.span
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            position: 'absolute',
            top: -10,
            right: 6,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: stateStyle.badgeColor,
            background: 'rgba(0,0,0,0.7)',
            border: `1px solid ${stateStyle.badgeColor}`,
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          {stateStyle.badge}
        </motion.span>
      )}

      {/* Hidden Count Badge for Collapsed Folders */}
      {data.isCollapsed && data.hiddenCount !== undefined && data.hiddenCount > 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          style={{
            position: 'absolute',
            bottom: -8,
            right: -8,
            fontSize: 9,
            fontWeight: 600,
            color: '#fff',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 10,
            padding: '2px 6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          +{data.hiddenCount} items
        </motion.span>
      )}

      {/* Handles */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />

      {/* Icon */}
      <GlassIcon colorClass={color}>{icon}</GlassIcon>

      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: animState === 'entering'
              ? '#bbf7d0'
              : animState === 'modified'
              ? '#fef9c3'
              : 'rgba(255,255,255,0.90)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 120,
            transition: 'color 0.4s ease',
          }}
        >
          {name}
        </h3>
        {data.size !== undefined && !isDirectory && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
            {(data.size / 1024).toFixed(1)} KB
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </motion.div>
  );
});

GlassNode.displayName = 'GlassNode';