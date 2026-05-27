'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { TourStep } from '../types';

interface TourContextType {
  isActive: boolean;
  tourSteps: TourStep[];
  currentStepIndex: number;
  startTour: (steps: TourStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  exitTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [tourSteps, setTourSteps] = useState<TourStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const startTour = (steps: TourStep[]) => {
    if (!steps || steps.length === 0) return;
    setTourSteps(steps);
    setCurrentStepIndex(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStepIndex < tourSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const exitTour = () => {
    setIsActive(false);
    setTimeout(() => {
      setTourSteps([]);
      setCurrentStepIndex(0);
    }, 300); // Wait for exit animation
  };

  return (
    <TourContext.Provider value={{
      isActive,
      tourSteps,
      currentStepIndex,
      startTour,
      nextStep,
      prevStep,
      exitTour
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
