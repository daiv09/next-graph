'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Annotation } from '../types';

export function useAnnotations() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('repo_annotations');
      if (stored) {
        setAnnotations(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load annotations from localStorage', e);
    }
  }, []);

  // Save to localStorage whenever annotations change
  useEffect(() => {
    try {
      localStorage.setItem('repo_annotations', JSON.stringify(annotations));
    } catch (e) {
      console.error('Failed to save annotations to localStorage', e);
    }
  }, [annotations]);

  const addAnnotation = useCallback((nodeId: string, x: number, y: number) => {
    setAnnotations(prev => [
      ...prev,
      {
        id: `anno_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        nodeId,
        text: '',
        x,
        y
      }
    ]);
  }, []);

  const updateAnnotation = useCallback((id: string, text: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
  }, []);

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  return {
    annotations,
    addAnnotation,
    updateAnnotation,
    removeAnnotation
  };
}
