import { toPng, toSvg } from 'html-to-image';
import type { ReactFlowInstance } from '@xyflow/react';

const VIEWPORT_SELECTOR = '.react-flow__viewport';

export const downloadFile = (dataUrl: string, filename: string) => {
  const a = document.createElement('a');
  a.setAttribute('download', filename);
  a.setAttribute('href', dataUrl);
  a.click();
};

export const exportToPng = async (projectName: string = 'RepoGraph') => {
  const el = document.querySelector<HTMLElement>(VIEWPORT_SELECTOR);
  if (!el) {
    console.error("Could not find React Flow viewport to export.");
    return;
  }
  
  try {
    const dataUrl = await toPng(el, {
      pixelRatio: 2, // Ensures crisp text on high-DPI displays
      backgroundColor: '#121212',
      filter: (node) => {
        // Guarantee no UI elements are captured if they happen to nest inside
        if (node.classList && (node.classList.contains('react-flow__minimap') || node.classList.contains('react-flow__controls') || node.classList.contains('react-flow__panel'))) {
          return false;
        }
        return true;
      }
    });
    downloadFile(dataUrl, `${projectName}-export.png`);
  } catch (err) {
    console.error('Failed to export PNG', err);
  }
};

export const exportToSvg = async (projectName: string = 'RepoGraph') => {
  const el = document.querySelector<HTMLElement>(VIEWPORT_SELECTOR);
  if (!el) {
    console.error("Could not find React Flow viewport to export.");
    return;
  }
  
  try {
    const dataUrl = await toSvg(el, {
      backgroundColor: '#121212',
      filter: (node) => {
        if (node.classList && (node.classList.contains('react-flow__minimap') || node.classList.contains('react-flow__controls') || node.classList.contains('react-flow__panel'))) {
          return false;
        }
        return true;
      }
    });
    downloadFile(dataUrl, `${projectName}-export.svg`);
  } catch (err) {
    console.error('Failed to export SVG', err);
  }
};

export const exportToJson = (reactFlowInstance: ReactFlowInstance, projectName: string = 'RepoGraph') => {
  const nodes = reactFlowInstance.getNodes();
  const edges = reactFlowInstance.getEdges();
  
  const manifest = {
    projectName,
    exportedAt: new Date().toISOString(),
    nodes,
    edges,
  };
  
  const jsonStr = JSON.stringify(manifest, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  downloadFile(url, `${projectName}-manifest.json`);
  URL.revokeObjectURL(url);
};
