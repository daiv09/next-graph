'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

export type AnalyticsFilterType = 'typology' | 'sizeBucket' | 'scatter' | 'treemap' | 'radar';

export interface AnalyticsFilter {
  type: AnalyticsFilterType;
  value: string; // The specific value clicked (e.g., 'Tests', '<1KB', or a file path for scatter)
}

interface AnalyticsContextType {
  activeFilter: AnalyticsFilter | null;
  setActiveFilter: (filter: AnalyticsFilter | null) => void;
  isAnalyticsPanelOpen: boolean;
  setIsAnalyticsPanelOpen: (isOpen: boolean) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [activeFilter, setActiveFilter] = useState<AnalyticsFilter | null>(null);
  const [isAnalyticsPanelOpen, setIsAnalyticsPanelOpen] = useState(false);

  return (
    <AnalyticsContext.Provider
      value={{
        activeFilter,
        setActiveFilter,
        isAnalyticsPanelOpen,
        setIsAnalyticsPanelOpen,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalyticsContext() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalyticsContext must be used within an AnalyticsProvider');
  }
  return context;
}
