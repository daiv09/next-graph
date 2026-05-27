'use client';
import React, { useEffect, useMemo } from 'react';
import { Command } from 'cmdk';
import { useCommandPaletteContext } from '../context/CommandPaletteContext';
import { useTour } from '../context/TourContext';
import { useNodes, useReactFlow, useEdges } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';

export function SpotlightSearch() {
  const { isOpen, close, setActiveItemId } = useCommandPaletteContext();
  const { startTour } = useTour();
  const nodes = useNodes();
  const edges = useEdges();
  const { fitView } = useReactFlow();

  // Reset active item when closed
  useEffect(() => {
    if (!isOpen) setActiveItemId(null);
  }, [isOpen, setActiveItemId]);

  const { files, folders } = useMemo(() => {
    const fNodes = nodes.filter(n => n.type !== 'annotation');
    return {
      files: fNodes.filter(n => n.data?.nodeType !== 'folder' && n.data?.nodeType !== 'root'),
      folders: fNodes.filter(n => n.data?.nodeType === 'folder' || n.data?.nodeType === 'root'),
    };
  }, [nodes]);

  const handleSelectNode = (id: string) => {
    const target = nodes.find(n => n.id === id);
    if (target) {
      fitView({ nodes: [target], duration: 800, padding: 0.5, maxZoom: 1.5 });
    }
    close();
  };

  const handleStartTour = async () => {
    try {
      const res = await fetch('http://localhost:8000/generate-tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });
      if (res.ok) {
        const data = await res.json();
        startTour(data.steps);
      }
    } catch (e) {
      console.error("Failed to generate tour", e);
    }
    close();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
            paddingBottom: '15vh' // Pushed slightly higher up the screen
          }}
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '540px', // Reduced from 640px
              background: 'rgba(20, 20, 25, 0.65)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '20px', // Slightly tighter corners
              boxShadow: '0 32px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Command
              label="Global Command Menu"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  close();
                }
              }}
              onValueChange={(value) => setActiveItemId(value)}
              style={{ width: '100%', outline: 'none' }}
              className="cmdk-root"
            >
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', padding: '0 20px' }}>
                <Command.Input
                  placeholder="Search files, folders, or actions..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '16px 0', // Tighter vertical padding
                    fontSize: '16px',  // Smaller font
                    color: 'rgba(255, 255, 255, 0.9)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontWeight: 500,
                  }}
                />
              </div>

              {/* Reduced maxHeight to prevent the list from getting too tall */}
              <Command.List
                style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px' }}
                className="[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                <Command.Empty style={{ padding: '24px 16px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', fontSize: '14px' }}>
                  No results found.
                </Command.Empty>

                {folders.length > 0 && (
                  <Command.Group heading="Folders" className="cmdk-group">
                    {folders.map(n => (
                      <Command.Item
                        key={n.id}
                        value={`node-${n.id}`}
                        onSelect={() => handleSelectNode(n.id)}
                        className="cmdk-item"
                      >
                        <span style={{ marginRight: '10px', opacity: 0.7 }}>📁</span>
                        <span className="truncate">{n.data?.label as string || n.id}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {files.length > 0 && (
                  <Command.Group heading="Files" className="cmdk-group">
                    {files.map(n => (
                      <Command.Item
                        key={n.id}
                        value={`node-${n.id}`}
                        onSelect={() => handleSelectNode(n.id)}
                        className="cmdk-item"
                      >
                        <span style={{ marginRight: '10px', opacity: 0.7 }}>📄</span>
                        <span className="truncate">{n.data?.label as string || n.id}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group heading="Actions" className="cmdk-group">
                  <Command.Item
                    value="action-tour"
                    onSelect={handleStartTour}
                    className="cmdk-item"
                  >
                    <span style={{ marginRight: '10px', opacity: 0.7 }}>🎬</span>
                    Start Guided Tour
                  </Command.Item>
                  <Command.Item
                    value="action-reset"
                    onSelect={() => {
                      fitView({ padding: 0.18, duration: 800 });
                      close();
                    }}
                    className="cmdk-item"
                  >
                    <span style={{ marginRight: '10px', opacity: 0.7 }}>🎯</span>
                    Reset Layout
                  </Command.Item>
                </Command.Group>

              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}