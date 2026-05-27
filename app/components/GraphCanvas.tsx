// GraphCanvas.tsx
'use client';

import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  type Node,
  type Edge,
  type NodeTypes,
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
} from '@xyflow/react';
import { useNodesState, useEdgesState } from '@xyflow/react';

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onSelectedNodeChange: (node: Node | null) => void;
  onNodeDoubleClick?: (event: React.MouseEvent, node: Node) => void;
}

export function GraphCanvas({ nodes: initNodes, edges: initEdges, nodeTypes, onSelectedNodeChange, onNodeDoubleClick }: GraphCanvasProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    setNodes(initNodes);
  }, [initNodes, setNodes]);

  useEffect(() => {
    setEdges(initEdges);
  }, [initEdges, setEdges]);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.18, duration: 600 }), 120);
    return () => clearTimeout(t);
  }, [fitView, initNodes]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    onSelectedNodeChange(selectedNodes[0] || null);
  }, [onSelectedNodeChange]);

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
      defaultEdgeOptions={{ type: 'default', style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1.5 } }}
      proOptions={{ hideAttribution: true }}
      className="!bg-transparent"
    >
      <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.08)" />
      <Controls className="!bg-white/10 !backdrop-blur-xl !border !border-white/20 !rounded-xl !shadow-lg" showInteractive={false} />
    </ReactFlow>
  );
}
