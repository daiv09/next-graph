'use client';
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import type { TourStep } from '../types';

export interface SlideData {
  screenshot: string; // base64 PNG data URL or URL
  title: string;
  description: string;
  targetNodeId: string;
}

interface TourContextType {
  isActive: boolean;
  tourSteps: TourStep[];
  currentStepIndex: number;
  startTour: (steps: TourStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  exitTour: () => void;
  slides: Record<number, SlideData>;
  setSlide: (index: number, data: SlideData) => void;
  clearSlides: () => void;
  snapshots: Record<number, string>;
  snapshotsRef: React.RefObject<Record<number, string>>;
  setSnapshot: (index: number, base64: string) => void;
  clearSnapshots: () => void;
  onStepComplete?: (index: number) => void;
  setOnStepComplete: (cb: ((index: number) => void) | undefined) => void;
  onStepChange?: (index: number) => void;
  setOnStepChange: (cb: ((index: number) => void) | undefined) => void;
  setCurrentStepIndex: (index: number) => void;
  setIsActive: (active: boolean) => void;
  setTourSteps: (steps: TourStep[]) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [tourSteps, setTourSteps] = useState<TourStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [slides, setSlides] = useState<Record<number, SlideData>>({});
  const [snapshots, setSnapshots] = useState<Record<number, string>>({});
  const snapshotsRef = useRef<Record<number, string>>({});
  const [onStepComplete, setOnStepCompleteState] = useState<((index: number) => void) | undefined>(undefined);
  const [onStepChange, setOnStepChangeState] = useState<((index: number) => void) | undefined>(undefined);

  useEffect(() => {
    if (isActive && onStepChange && tourSteps.length > 0) {
      onStepChange(currentStepIndex);
    }
  }, [currentStepIndex, isActive, onStepChange, tourSteps]);

  const startTour = useCallback((steps: TourStep[]) => {
    if (!steps || steps.length === 0) return;
    setSlides({});
    setSnapshots({});
    snapshotsRef.current = {};
    setTourSteps(steps);
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (onStepComplete) {
      onStepComplete(currentStepIndex);
    }
    if (currentStepIndex < tourSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [onStepComplete, currentStepIndex, tourSteps.length]);

  const prevStep = useCallback(() => {
    if (onStepComplete) {
      onStepComplete(currentStepIndex);
    }
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [onStepComplete, currentStepIndex]);

  const exitTour = useCallback(() => {
    if (onStepComplete) {
      onStepComplete(currentStepIndex);
    }
    setIsActive(false);
    setTimeout(() => {
      setTourSteps([]);
      setCurrentStepIndex(0);
      setSlides({});
      setSnapshots({});
      snapshotsRef.current = {};
    }, 300); // Wait for exit animation
  }, [onStepComplete]);

  const setSlide = useCallback((index: number, data: SlideData) => {
    setSlides(prev => ({
      ...prev,
      [index]: data
    }));
  }, []);

  const clearSlides = useCallback(() => {
    setSlides({});
  }, []);

  const setSnapshot = useCallback((index: number, base64: string) => {
    snapshotsRef.current[index] = base64;
    setSnapshots(prev => ({
      ...prev,
      [index]: base64
    }));
  }, []);

  const clearSnapshots = useCallback(() => {
    snapshotsRef.current = {};
    setSnapshots({});
  }, []);

  const setOnStepComplete = useCallback((cb: ((index: number) => void) | undefined) => {
    setOnStepCompleteState(() => cb);
  }, []);

  const setOnStepChange = useCallback((cb: ((index: number) => void) | undefined) => {
    setOnStepChangeState(() => cb);
  }, []);

  const contextValue = useMemo(() => ({
    isActive,
    tourSteps,
    currentStepIndex,
    startTour,
    nextStep,
    prevStep,
    exitTour,
    slides,
    setSlide,
    clearSlides,
    snapshots,
    snapshotsRef,
    setSnapshot,
    clearSnapshots,
    onStepComplete,
    setOnStepComplete,
    onStepChange,
    setOnStepChange,
    setCurrentStepIndex,
    setIsActive,
    setTourSteps
  }), [
    isActive,
    tourSteps,
    currentStepIndex,
    startTour,
    nextStep,
    prevStep,
    exitTour,
    slides,
    setSlide,
    clearSlides,
    snapshots,
    snapshotsRef,
    setSnapshot,
    clearSnapshots,
    onStepComplete,
    setOnStepComplete,
    onStepChange,
    setOnStepChange,
    setCurrentStepIndex,
    setIsActive,
    setTourSteps
  ]);

  return (
    <TourContext.Provider value={contextValue}>
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

