import dagre from 'dagre';
import { type Node, type Edge } from '@xyflow/react';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, ranksep: 80, nodesep: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const childrenMap: Record<string, string[]> = {};
  edges.forEach((edge) => {
    if (!childrenMap[edge.source]) {
      childrenMap[edge.source] = [];
    }
    childrenMap[edge.source].push(edge.target);
  });

  const depthMap: Record<string, number> = {};
  function dfs(nodeId: string, currentDepth: number) {
    depthMap[nodeId] = currentDepth;
    const children = childrenMap[nodeId] || [];
    children.forEach((childId) => {
      dfs(childId, currentDepth + 1);
    });
  }

  const incoming = new Set(edges.map((e) => e.target));
  const rootNode = nodes.find((n) => !incoming.has(n.id)) || nodes[0];
  if (rootNode) {
    dfs(rootNode.id, 0);
  }

  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      data: {
        ...node.data,
        depth: depthMap[node.id] ?? 0,
      },
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });
}

export const defaultEdgeOptions = {
  type: 'default',
  style: {
    stroke: 'rgba(255, 255, 255, 0.2)',
    strokeWidth: 1.5,
  },
};
