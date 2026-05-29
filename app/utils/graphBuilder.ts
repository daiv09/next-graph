// graphBuilder.ts
import type { Node, Edge } from '@xyflow/react';
import dagre from 'dagre';
import type { GlassNodeData } from '../types';
import type { RepoNode, RepoEdge, RepoGraphPayload, ApiResponse } from '../types';
import { computeSemanticLayout } from './semanticClusterer';

const NODE_W = 180;
const NODE_H = 72;

export function applyDagreLayout(nodes: Node[], edges: Edge[], dir: 'TB' | 'LR' = 'TB'): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ 
    rankdir: dir, 
    // ranksep: The vertical distance between ranks. 100px is usually better than 80px.
    ranksep: 100, 
    // nodesep: The horizontal distance between nodes in the same rank. 
    // Tightening this to 40px keeps the graph compact.
    nodesep: 40,
    // Add these for a more balanced "tree" look:
    edgesep: 10,
    ranker: 'tight-tree' // This is the secret sauce for preventing "flat" layouts
  });
  
  g.setDefaultEdgeLabel(() => ({}));
  
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  
  dagre.layout(g);
  
  return nodes.map(n => {
    const p = g.node(n.id);
    // Ensure we handle nodes that dagre might not have positioned
    if (!p) return n; 
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

/** Build React Flow data from placeholder */
export function buildFromPlaceholder(pl: RepoGraphPayload): { nodes: Node[]; edges: Edge[] } {
  const rfEdges: Edge[] = pl.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'default',
    style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 },
  }));
  
  const sizes = pl.nodes.map(n => n.size || 0).filter(s => s > 0);
  const maxSize = sizes.length > 0 ? Math.max(...sizes) : 1;

  const rfNodes: Node[] = pl.nodes.map(n => {
    const size = n.size || 0;
    const sizeFactor = size > 0 && maxSize > 1 ? Math.log(size) / Math.log(maxSize) : 0;
    return {
      id: n.id,
      type: 'glass', // enforce glass node for all placeholder nodes
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        nodeType: n.type,
        path: n.path,
        language: n.language,
        size: n.size,
        description: n.description,
        sizeFactor,
      } satisfies GlassNodeData,
    };
  });
  assignSemanticPositions(rfNodes);
  return { nodes: applyDagreLayout(rfNodes, rfEdges), edges: rfEdges };
}

export function assignSemanticPositions(nodes: Node[]) {
  const semanticLayout = computeSemanticLayout(nodes);
  
  // Update files/dependencies first
  nodes.forEach(n => {
    const layout = semanticLayout[n.id];
    if (layout) {
      n.data = {
        ...n.data,
        clusterId: layout.clusterId,
        clusterLabel: layout.clusterLabel,
        semanticPosition: { x: layout.x, y: layout.y }
      };
    }
  });

  // Helper to find descendent files of a folder node
  const getDescendentFiles = (folderId: string): Node[] => {
    const folderNode = nodes.find(n => n.id === folderId);
    const folderPath = (folderNode?.data as GlassNodeData)?.path || '';
    if (!folderPath) return [];

    return nodes.filter(n => {
      const type = (n.data as GlassNodeData)?.nodeType || n.type;
      const isFile = type === 'file' || type === 'dependency';
      const path = (n.data as GlassNodeData)?.path || '';
      return isFile && path.startsWith(folderPath) && path !== folderPath;
    });
  };

  // Update folder and root nodes with average descendent coordinates
  nodes.forEach(n => {
    const type = (n.data as GlassNodeData)?.nodeType || n.type;
    if (type === 'folder' || type === 'root' || type === 'dir') {
      const descFiles = getDescendentFiles(n.id);
      if (descFiles.length > 0) {
        let sumX = 0;
        let sumY = 0;
        let validCount = 0;
        descFiles.forEach(file => {
          const semPos = (file.data as GlassNodeData)?.semanticPosition;
          if (semPos) {
            sumX += semPos.x;
            sumY += semPos.y;
            validCount++;
          }
        });

        if (validCount > 0) {
          n.data = {
            ...n.data,
            semanticPosition: { x: sumX / validCount, y: sumY / validCount }
          };
        } else {
          n.data = {
            ...n.data,
            semanticPosition: { x: 500, y: 500 }
          };
        }
      } else {
        n.data = {
          ...n.data,
          semanticPosition: { x: 500, y: 500 }
        };
      }
    }
  });
}

/** Convert API response → dagre-positioned React Flow data */
export function buildFromApi(api: ApiResponse): { nodes: Node[]; edges: Edge[] } {
  const rfEdges: Edge[] = api.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'default',
    style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 },
  }));

  const sizes = api.nodes.map(n => n.data.size || 0).filter(s => s > 0);
  const maxSize = sizes.length > 0 ? Math.max(...sizes) : 1;

  const rfNodes: Node[] = api.nodes.map(n => {
    const size = n.data.size || 0;
    const sizeFactor = size > 0 && maxSize > 1 ? Math.log(size) / Math.log(maxSize) : 0;
    return {
      id: n.id,
      type: 'glass',
      position: { x: 0, y: 0 },
      data: {
        label: n.data.label,
        nodeType: n.type,
        path: n.data.path,
        size: n.data.size,
        description: n.data.description,
        created_at: n.data.created_at,
        sizeFactor,
      } satisfies GlassNodeData,
    };
  });
  assignSemanticPositions(rfNodes);
  return { nodes: applyDagreLayout(rfNodes, rfEdges), edges: rfEdges };
}
