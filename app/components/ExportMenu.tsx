'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactFlow } from '@xyflow/react';
import { exportToPng, exportToSvg, exportToJson } from '../utils/exportGraph';
import { toPng } from 'html-to-image';
import { useTour } from '../context/TourContext';
import { generatePresentation } from '../utils/presentationGenerator';
import { API_BASE } from '../utils/constants';

export function ExportMenu({ projectName = 'RepoGraph', repoUrl }: { projectName?: string; repoUrl?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  const { 
    tourSteps, 
    isActive, 
    setIsActive, 
    currentStepIndex, 
    setCurrentStepIndex, 
    setTourSteps,
    snapshotsRef 
  } = useTour();

  // PPTX Generation states
  const [pptGenStatus, setPptGenStatus] = useState<'idle' | 'fetching' | 'capturing' | 'synthesizing' | 'done' | 'error'>('idle');
  const [captureStepIndex, setCaptureStepIndex] = useState(0);
  const [captureTotalSteps, setCaptureTotalSteps] = useState(0);
  const [currentStepName, setCurrentStepName] = useState('');

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleExportPPTX = async () => {
    setIsOpen(false);
    setPptGenStatus('fetching');

    // Save original states
    const wasTourActive = isActive;
    const originalStepIndex = currentStepIndex;
    const originalSteps = tourSteps;
    const originalViewport = reactFlowInstance.getViewport();

    try {
      // 1. Get tour steps (either from TourContext or generate them)
      let steps = tourSteps;
      if (!steps || steps.length === 0) {
        const res = await fetch(`${API_BASE}/generate-tour`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodes: reactFlowInstance.getNodes(),
            edges: reactFlowInstance.getEdges()
          }),
        });
        if (!res.ok) throw new Error('Failed to generate tour steps');
        const data = await res.json();
        steps = data.steps;
        setTourSteps(steps);
      }

      if (!steps || steps.length === 0) {
        throw new Error('No tour steps available for export');
      }

      // Activate tour mode programmatically for highlights and capture listener
      setIsActive(true);

      // Wait 500ms for TourPanel to mount and register onStepChange callback
      await new Promise(resolve => setTimeout(resolve, 500));

      setCaptureTotalSteps(steps.length);
      setPptGenStatus('capturing');

      // 2. Programmatically traverse steps, triggering automated onStepChange snapshots
      for (let i = 0; i < steps.length; i++) {
        setCaptureStepIndex(i);
        const step = steps[i];
        setCurrentStepName(step.title);

        // Update step index to trigger zoom and automated html2canvas capture in TourPanel
        setCurrentStepIndex(i);

        // Poll snapshotsRef.current[i] until it is populated (up to 2500ms max safety timeout)
        const startTime = Date.now();
        while (!snapshotsRef.current?.[i] && Date.now() - startTime < 2500) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Minor buffer to ensure UI and state updates fully settle
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 3. Trigger PPTX compilation by constructing slides from the stored snapshots object in order
      setPptGenStatus('synthesizing');
      const nodes = reactFlowInstance.getNodes();
      const edges = reactFlowInstance.getEdges();

      const tempSlides: Record<number, any> = {};
      const latestSnapshots = snapshotsRef.current || {};
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        tempSlides[i] = {
          screenshot: latestSnapshots[i] || '',
          title: step.title,
          description: step.narration,
          targetNodeId: step.targetNodeId
        };
      }

      await generatePresentation(projectName, nodes, edges, steps, tempSlides, repoUrl || '');
      setPptGenStatus('done');

      // Reset back to idle
      setTimeout(() => {
        setPptGenStatus('idle');
      }, 500);

    } catch (err) {
      console.error('PPTX Export failed:', err);
      setPptGenStatus('error');
      setTimeout(() => {
        setPptGenStatus('idle');
      }, 3000);
    } finally {
      // 4. Restore original states
      setIsActive(wasTourActive);
      setCurrentStepIndex(originalStepIndex);
      setTourSteps(originalSteps);
      reactFlowInstance.setViewport(originalViewport);
    }
  };

  const handleExport = (type: 'png' | 'svg' | 'json' | 'pptx') => {
    if (type === 'png') exportToPng(projectName);
    if (type === 'svg') exportToSvg(projectName);
    if (type === 'json') exportToJson(reactFlowInstance, projectName);
    if (type === 'pptx') handleExportPPTX();
    setIsOpen(false);
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -5 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.05, duration: 0.2 },
    }),
  };

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
          borderRadius: 12,
          border: '1.5px solid rgba(255, 255, 255, 0.2)',
          background: isOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.9)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          transition: 'background 0.2s, color 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        whileHover={{ background: 'rgba(255,255,255,0.15)' }}
        whileTap={{ scale: 0.95 }}
        title="Export Graph"
      >
        Export
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              padding: '6px',
              background: 'rgba(20, 20, 25, 0.85)',
              backdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              minWidth: '180px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 50,
            }}
          >
            {[
              { id: 'png', label: 'PNG Image', shortcut: '⇧⌘P' },
              { id: 'svg', label: 'SVG Vector', shortcut: '⇧⌘V' },
              { id: 'json', label: 'JSON Data', shortcut: '⇧⌘J' },
              { id: 'pptx', label: 'PowerPoint (.pptx)', shortcut: '⇧⌘T' },
            ].map((item, i) => (
              <motion.button
                key={item.id}
                custom={i}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                onClick={() => handleExport(item.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                  {item.shortcut}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pptGenStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              background: 'rgba(10, 10, 15, 0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                width: '90%',
                maxWidth: '450px',
                padding: '32px',
                borderRadius: '24px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <div style={{ position: 'relative', width: '64px', height: '64px' }}>
                <svg className="w-16 h-16 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.05)" />
                  <path strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <div style={{
                  position: 'absolute',
                  inset: '8px',
                  borderRadius: '50%',
                  background: 'rgba(14, 165, 233, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}>
                  📊
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0', color: 'rgba(255, 255, 255, 0.95)' }}>
                  {pptGenStatus === 'fetching' && 'Initializing Presentation...'}
                  {pptGenStatus === 'capturing' && 'Capturing Slide Deck...'}
                  {pptGenStatus === 'synthesizing' && 'Synthesizing PPTX File...'}
                  {pptGenStatus === 'error' && 'Synthesis Failed'}
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', margin: 0, minHeight: '18px' }}>
                  {pptGenStatus === 'fetching' && 'Generating codebase walkthrough structure...'}
                  {pptGenStatus === 'capturing' && `Processing step ${captureStepIndex + 1} of ${captureTotalSteps}: ${currentStepName}`}
                  {pptGenStatus === 'synthesizing' && 'Running AI Architecture Inference & compiling deck...'}
                  {pptGenStatus === 'error' && 'An error occurred during PPTX creation.'}
                </p>
              </div>

              {pptGenStatus === 'capturing' && captureTotalSteps > 0 && (
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${((captureStepIndex + 1) / captureTotalSteps) * 100}%` }}
                    transition={{ duration: 0.3 }}
                    style={{ height: '100%', background: '#0ea5e9', borderRadius: '3px' }}
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
