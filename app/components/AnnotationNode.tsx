import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';

export const AnnotationNode = memo(({ data }: NodeProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      style={{
        padding: '12px',
        borderRadius: '16px',
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(250, 204, 21, 0.3)',
        boxShadow: '0 8px 32px rgba(250, 204, 21, 0.15)',
        minWidth: '200px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(250, 204, 21, 0.8)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          📌 Note
        </span>
        <button 
          onClick={data.onDelete as () => void} 
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '2px',
          }}
          title="Delete Note"
        >
          ✕
        </button>
      </div>
      <textarea
        style={{
          width: '100%',
          backgroundColor: 'transparent',
          color: 'rgba(255,255,255,0.9)',
          fontSize: '13px',
          border: 'none',
          outline: 'none',
          resize: 'none',
          fontFamily: 'inherit',
        }}
        value={data.text as string}
        onChange={(e) => (data.onUpdate as (text: string) => void)(e.target.value)}
        placeholder="Type a note here..."
        rows={4}
        className="custom-scrollbar"
      />
    </motion.div>
  );
});

AnnotationNode.displayName = 'AnnotationNode';
