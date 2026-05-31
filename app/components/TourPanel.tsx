'use client';
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTour } from '../context/TourContext';

export function TourPanel() {
  const { 
    isActive, 
    tourSteps, 
    currentStepIndex, 
    nextStep, 
    prevStep, 
    exitTour,
    setOnStepChange,
    setSnapshot
  } = useTour();

  // Register the onStepChange listener to capture graph snapshots using html2canvas
  useEffect(() => {
    if (!isActive) return;

    const captureGraphSnapshot = async (stepIndex: number) => {
      const step = tourSteps[stepIndex];
      if (!step) return;

      // 1. Wait for 1300ms transition delay to allow camera fitView (1200ms) to settle
      await new Promise(resolve => setTimeout(resolve, 1300));

      const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
      if (viewportEl) {
        // Apply brightness/contrast CSS filter before capture
        const originalFilter = viewportEl.style.filter;
        const originalWebkitFilter = viewportEl.style.webkitFilter;
        viewportEl.style.filter = 'brightness(1.2) contrast(1.2)';
        viewportEl.style.webkitFilter = 'brightness(1.2) contrast(1.2)';

        try {
          // Dynamic import of html2canvas for SSR/Next.js compatibility
          const html2canvas = (await import('html2canvas')).default;
          
          // Inject style block to strip backdrop-filter temporarily (html2canvas compatibility)
          const styleEl = document.createElement('style');
          styleEl.innerHTML = `
            .react-flow__node * {
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
            .react-flow__node {
              background-color: rgba(30, 30, 45, 0.98) !important;
            }
          `;
          document.head.appendChild(styleEl);

          try {
            const canvas = await html2canvas(viewportEl, {
              backgroundColor: '#121212',
              logging: false,
              useCORS: true,
              allowTaint: true,
              scale: 2, // High resolution scale
            });
            const base64Image = canvas.toDataURL('image/png');
            
            // 2. Store the resulting Base64 string in snapshots mapping
            setSnapshot(stepIndex, base64Image);
          } finally {
            styleEl.remove();
          }
        } catch (err) {
          console.error('Failed to capture graph snapshot using html2canvas:', err);
        } finally {
          // Restore original filter styling immediately after rendering
          viewportEl.style.filter = originalFilter;
          viewportEl.style.webkitFilter = originalWebkitFilter;
        }
      }
    };

    setOnStepChange(captureGraphSnapshot);
    return () => {
      setOnStepChange(undefined);
    };
  }, [isActive, tourSteps, setOnStepChange, setSnapshot]);

  if (!isActive || tourSteps.length === 0) return null;

  const currentStep = tourSteps[currentStepIndex];

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="tour-panel"
          initial={{ opacity: 0, y: 40, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 40, x: '-50%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '50%',
            zIndex: 50,
            width: '90%',
            maxWidth: '500px',
            background: 'rgba(20, 20, 25, 0.75)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '24px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            color: 'white'
          }}
        >
          {/* Header & Dots */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'rgba(255, 255, 255, 0.9)' }}>
              {currentStep.title}
            </h3>
            
            <div style={{ display: 'flex', gap: '6px' }}>
              {tourSteps.map((_, idx) => (
                <div 
                  key={idx}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: idx === currentStepIndex ? 'rgba(14, 165, 233, 1)' : 'rgba(255, 255, 255, 0.2)',
                    transition: 'background-color 0.3s'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Narration */}
          <motion.p 
            key={currentStepIndex}
            initial={{ opacity: 0, filter: 'blur(4px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.4 }}
            style={{ 
              fontSize: '14px', 
              lineHeight: 1.6, 
              color: 'rgba(255, 255, 255, 0.7)',
              margin: 0,
              minHeight: '60px'
            }}
          >
            {currentStep.narration}
          </motion.p>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <button
              onClick={exitTour}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '8px',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'; e.currentTarget.style.background = 'transparent'; }}
            >
              End Tour
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: currentStepIndex === 0 ? 'rgba(255,255,255,0.3)' : 'white',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => { if (currentStepIndex !== 0) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={(e) => { if (currentStepIndex !== 0) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              >
                Prev
              </button>
              
              <button
                onClick={currentStepIndex === tourSteps.length - 1 ? exitTour : nextStep}
                style={{
                  background: 'rgba(14, 165, 233, 0.8)',
                  border: '1px solid rgba(14, 165, 233, 0.5)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '8px 20px',
                  borderRadius: '10px',
                  transition: 'background 0.2s, transform 0.1s',
                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(14, 165, 233, 1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(14, 165, 233, 0.8)'}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {currentStepIndex === tourSteps.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
