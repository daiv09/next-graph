// graphBuilder.ts
import type { Node, Edge, NodeTypes } from '@xyflow/react';
import dagre from 'dagre';
import type { GlassNodeData } from '../components/GlassNode';
import type { RepoNode, RepoEdge, RepoGraphPayload, ApiResponse } from '../types';

// ── Dagre layout ───────────────────────────────────────────────────────────

const NODE_W = 180;
const NODE_H = 72;

export function applyDagreLayout(nodes: Node[], edges: Edge[], dir: 'TB' | 'LR' = 'TB'): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: dir, ranksep: 80, nodesep: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => {
    const p = g.node(n.id);
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
  const rfNodes: Node[] = pl.nodes.map(n => ({
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
    } satisfies GlassNodeData,
  }));
  return { nodes: applyDagreLayout(rfNodes, rfEdges), edges: rfEdges };
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
  const rfNodes: Node[] = api.nodes.map(n => ({
    id: n.id,
    type: 'glass',
    position: { x: 0, y: 0 },
    data: {
      label: n.data.label,
      nodeType: n.type,
      path: n.data.path,
      size: n.data.size,
      description: n.data.description,
    } satisfies GlassNodeData,
  }));
  return { nodes: applyDagreLayout(rfNodes, rfEdges), edges: rfEdges };
}
