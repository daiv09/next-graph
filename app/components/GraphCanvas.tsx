// GraphCanvas.tsx
'use client';

import { useEffect, useCallback, useMemo } from 'react';
import {
  type Node,
  type Edge,
  type NodeTypes,
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import { useCommitContext } from '../context/CommitContext';
import { useTimelineAnimation } from '../hooks/useTimelineAnimation';
import { applyDagreLayout } from '../utils/graphBuilder';

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onSelectedNodeChange: (node: Node | null) => void;
  onNodeDoubleClick?: (event: React.MouseEvent, node: Node) => void;
}

export function GraphCanvas({
  nodes: initNodes,
  edges: initEdges,
  nodeTypes,
  onSelectedNodeChange,
  onNodeDoubleClick,
}: GraphCanvasProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  // Compute dynamic graph structure and layout for the current commit
  const { nodeStates } = useTimelineAnimation();

  const { timelineNodes, timelineEdges } = useMemo(() => {
    if (!initNodes || initNodes.length === 0) return { timelineNodes: [], timelineEdges: [] };

    const visiblePaths = new Set<string>();

    // Pass 1: Files
    initNodes.forEach(n => {
      const path = n.data?.path as string | undefined;
      const type = n.data?.nodeType || n.type;
      if (path && type !== 'folder' && type !== 'root') {
        const state = nodeStates[path];
        if (state !== 'hidden') {
          visiblePaths.add(path);
        }
      }
    });

    // Pass 2: Folders
    initNodes.forEach(n => {
      const type = n.data?.nodeType || n.type;
      if (type === 'folder' || type === 'root') {
        const folderPath = n.data?.path as string | undefined;
        if (!folderPath) {
          visiblePaths.add(n.id);
          return;
        }
        let hasVisibleChild = false;
        for (const vp of visiblePaths) {
          if (vp.startsWith(folderPath + '/') || vp === folderPath) {
            hasVisibleChild = true;
            break;
          }
        }
        if (hasVisibleChild) visiblePaths.add(folderPath);
      }
    });

    // Filter nodes
    const visibleNodesRaw = initNodes.filter(n => {
      const path = n.data?.path as string | undefined;
      const type = n.data?.nodeType || n.type;
      if (type === 'folder' || type === 'root') {
         return visiblePaths.has(path || n.id);
      }
      return path ? visiblePaths.has(path) : false;
    });

    // Filter edges
    const visibleEdgesRaw = initEdges.filter(e => {
       const sourceVisible = visibleNodesRaw.some(n => n.id === e.source);
       const targetVisible = visibleNodesRaw.some(n => n.id === e.target);
       return sourceVisible && targetVisible;
    });

    // Apply Dagre layout to dynamically reposition nodes
    const layoutedNodes = applyDagreLayout(visibleNodesRaw, visibleEdgesRaw);

    const finalNodes = layoutedNodes.map(n => {
       const path = n.data?.path as string | undefined;
       const type = n.data?.nodeType || n.type;
       const animState = (type !== 'folder' && type !== 'root' && path) 
          ? (nodeStates[path] || 'visible') 
          : 'visible';

       return {
         ...n,
         data: { ...n.data, animState },
         style: {
           ...n.style,
           transition: 'all 0.5s ease-in-out',
           opacity: 1,
         }
       };
    });

    return { timelineNodes: finalNodes, timelineEdges: visibleEdgesRaw };
  }, [initNodes, initEdges, nodeStates]);

  useEffect(() => {
    setNodes(timelineNodes);
  }, [timelineNodes, setNodes]);

  useEffect(() => {
    setEdges(timelineEdges);
  }, [timelineEdges, setEdges]);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.18, duration: 600 }), 120);
    return () => clearTimeout(t);
  }, [fitView, initNodes]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      onSelectedNodeChange(selectedNodes[0] || null);
    },
    [onSelectedNodeChange],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onSelectionChange={onSelectionChange}
      onNodeDoubleClick={onNodeDoubleClick}
      onInit={() => fitView({ padding: 0.18, duration: 500 })}
      fitView
      minZoom={0.25}
      maxZoom={2.5}
      defaultEdgeOptions={{
        type: 'default',
        style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1.5 },
      }}
      proOptions={{ hideAttribution: true }}
      className="!bg-transparent"
    >
      <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.08)" />
      <Controls
        className="!bg-white/10 !backdrop-blur-xl !border !border-white/20 !rounded-xl !shadow-lg"
        showInteractive={false}
      />
    </ReactFlow>
  );
}
