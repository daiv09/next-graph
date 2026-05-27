'use client';
import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { exportToPng, exportToSvg, exportToJson } from '../utils/exportGraph';

export function useExportShortcuts(projectName: string = 'RepoGraph') {
  // It's safe to call useReactFlow here as long as the component calling this hook
  // is nested within a ReactFlowProvider.
  const reactFlowInstance = useReactFlow();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Listen for Cmd/Ctrl + Shift
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          exportToPng(projectName);
        } else if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          exportToSvg(projectName);
        } else if (e.key.toLowerCase() === 'j') {
          e.preventDefault();
          exportToJson(reactFlowInstance, projectName);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reactFlowInstance, projectName]);
}
