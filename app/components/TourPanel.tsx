'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTour } from '../context/TourContext';

export function TourPanel() {
  const { isActive, tourSteps, currentStepIndex, nextStep, prevStep, exitTour } = useTour();

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
