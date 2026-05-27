// GraphCanvas.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useAnalyticsContext } from '../context/AnalyticsContext';
import { ContextMenu } from './ContextMenu';
import { useAnnotations } from '../hooks/useAnnotations';
import type { ContextMenuState } from '../types';

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onSelectedNodeChange: (node: Node | null) => void;
  onNodeDoubleClick?: (event: React.MouseEvent, node: Node) => void;
}

// ── Change this value to adjust when the auto-collapsing kicks in ────────
const AUTO_COLLAPSE_THRESHOLD = 56;
// ─────────────────────────────────────────────────────────────────────────

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

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    toggled: false,
    x: 0,
    y: 0,
    nodeId: null,
  });

  // 1. Auto-collapse state for smart clustering
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => {
    if (initNodes.length > AUTO_COLLAPSE_THRESHOLD) return new Set(); 
    return new Set(initNodes.filter(n => {
      const type = n.data?.nodeType || n.type;
      return type === 'folder' || type === 'root' || type === 'dir';
    }).map(n => n.id));
  });

  useEffect(() => {
    if (initNodes.length > AUTO_COLLAPSE_THRESHOLD) {
      setExpandedFolderIds(new Set());
    } else {
      setExpandedFolderIds(new Set(initNodes.filter(n => {
        const type = n.data?.nodeType || n.type;
        return type === 'folder' || type === 'root' || type === 'dir';
      }).map(n => n.id)));
    }
  }, [initNodes]);

  // Handle double-clicking a node
  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    const type = node.data?.nodeType || node.type;
    // 1. Toggle folder expansion
    if (type === 'folder' || type === 'root' || type === 'dir') {
      setExpandedFolderIds(prev => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    }
    // 2. Call the parent's double click handler (if provided)
    if (onNodeDoubleClick) {
      onNodeDoubleClick(event, node);
    }
  }, [onNodeDoubleClick]);

  // Handle right-click on a node
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault(); // Prevent default browser menu
    
    // Calculate position relative to the container if needed, or just use page coordinates
    setContextMenu({
      toggled: true,
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    });
  }, []);

  // Close context menu on canvas click
  const onPaneClick = useCallback(() => {
    if (contextMenu.toggled) {
      setContextMenu(prev => ({ ...prev, toggled: false }));
    }
  }, [contextMenu.toggled]);

  // Compute dynamic graph structure and layout for the current commit
  const { nodeStates } = useTimelineAnimation();
  const { activeFilter } = useAnalyticsContext();
  const { annotations, addAnnotation, updateAnnotation, removeAnnotation } = useAnnotations();

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
        const folderPath = n.data?.path as string || (n.id === 'root' ? '' : '');
        if (folderPath === '' && n.id !== 'root') {
          visiblePaths.add(n.id);
          return;
        }
        let hasVisibleChild = false;
        for (const vp of visiblePaths) {
          if (vp.startsWith(folderPath ? folderPath + '/' : '') || vp === folderPath) {
            hasVisibleChild = true;
            break;
          }
        }
        if (hasVisibleChild) visiblePaths.add(folderPath);
      }
    });

    // 2. Identify which folders are manually collapsed
    const collapsedFolderPaths = new Set<string>();
    initNodes.forEach(n => {
      const type = n.data?.nodeType || n.type;
      if (type === 'folder' || type === 'root') {
        if (!expandedFolderIds.has(n.id)) {
          collapsedFolderPaths.add(n.data?.path as string || (n.id === 'root' ? '' : ''));
        }
      }
    });

    // Helper to find the top-most collapsed ancestor
    const getTopCollapsedAncestor = (path: string): string | null => {
      let topAncestor: string | null = null;
      for (const cfp of collapsedFolderPaths) {
        if (cfp === '') { 
          if (path !== '') return '';
        } else if (path.startsWith(cfp + '/')) {
          if (topAncestor === null || cfp.length < topAncestor.length) {
            topAncestor = cfp;
          }
        }
      }
      return topAncestor;
    };

    const hiddenCounts: Record<string, number> = {};

    // 3. Filter nodes based on timeline AND cluster state
    const visibleNodesRaw = initNodes.filter(n => {
      const path = n.data?.path as string || (n.id === 'root' ? '' : '');
      const type = n.data?.nodeType || n.type;
      const isFolder = type === 'folder' || type === 'root';
      
      const timelineVisible = isFolder ? visiblePaths.has(path) : visiblePaths.has(path);
      if (!timelineVisible) return false;

      // If it's hidden by an ancestor, increment the ancestor's count and hide it
      const topAncestor = getTopCollapsedAncestor(path);
      if (topAncestor !== null) {
        hiddenCounts[topAncestor] = (hiddenCounts[topAncestor] || 0) + 1;
        return false;
      }
      
      return true;
    });

    // Filter edges
    const visibleEdgesRaw = initEdges.filter(e => {
       const sourceVisible = visibleNodesRaw.some(n => n.id === e.source);
       const targetVisible = visibleNodesRaw.some(n => n.id === e.target);
       return sourceVisible && targetVisible;
    });

    // Apply Dagre layout to dynamically reposition nodes
    const layoutedNodes = applyDagreLayout(visibleNodesRaw, visibleEdgesRaw);

    // Helper to evaluate if a node matches the active filter
    const matchesFilter = (n: Node, filter: any): boolean => {
       const path = n.data?.path as string || (n.id === 'root' ? '' : '');
       const size = (n.data?.size as number) || 0;
       
       if (filter.type === 'typology') {
         const filename = path.split('/').pop()?.toLowerCase() || '';
         let typology = 'Implementation';
         if (path.toLowerCase().includes('test') || filename.includes('spec') || filename.includes('mock')) typology = 'Tests';
         else if (filename.endsWith('.md') || filename.endsWith('.txt') || filename.endsWith('.rst')) typology = 'Documentation';
         else if (filename.endsWith('.json') || filename.endsWith('.yml') || filename.endsWith('.yaml') || filename.endsWith('.toml') || filename.endsWith('.ini') || filename.endsWith('.env') || filename.includes('config')) typology = 'Configuration';
         else if (filename.includes('docker') || filename.includes('makefile') || path.includes('.github')) typology = 'Infrastructure';
         
         return typology === filter.value;
       }
       if (filter.type === 'sizeBucket') {
         let bucket = '100KB+';
         if (size < 1024) bucket = '<1KB';
         else if (size < 10240) bucket = '1-10KB';
         else if (size < 51200) bucket = '10-50KB';
         else if (size < 102400) bucket = '50-100KB';
         return bucket === filter.value;
       }
       if (filter.type === 'scatter') {
         return path === filter.value;
       }
       if (filter.type === 'treemap') {
         const parent = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '/';
         return parent === filter.value;
       }
       if (filter.type === 'radar') {
         const rootFolder = path.split('/')[0];
         return rootFolder === filter.value;
       }
       return false;
    };

    const finalNodes = layoutedNodes.map(n => {
       const path = n.data?.path as string || (n.id === 'root' ? '' : '');
       const type = n.data?.nodeType || n.type;
       const isFolder = type === 'folder' || type === 'root' || type === 'dir';
       
       const animState = (!isFolder && path) 
          ? (nodeStates[path] || 'visible') 
          : 'visible';

       const isHighlighted = activeFilter ? matchesFilter(n, activeFilter) : false;
       const isDimmed = activeFilter ? !isHighlighted : false;

       return {
         ...n,
         data: { 
           ...n.data, 
           animState,
           hiddenCount: isFolder ? (hiddenCounts[path] || 0) : 0,
           isCollapsed: isFolder && !expandedFolderIds.has(n.id),
           isHighlighted,
           isDimmed
         },
         style: {
           ...n.style,
           transition: 'all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)', // Spring-like layout animation
           opacity: 1,
         }
       };
    });

    const annotationNodes: Node[] = annotations.map(a => ({
      id: a.id,
      type: 'annotation',
      parentId: a.nodeId,
      position: { x: 120, y: -40 }, // Positioned relative to parent
      data: {
        text: a.text,
        onUpdate: (text: string) => updateAnnotation(a.id, text),
        onDelete: () => removeAnnotation(a.id),
      },
      draggable: false, // Prevent ReactFlow from overriding positions without saving
    }));

    return { timelineNodes: [...finalNodes, ...annotationNodes], timelineEdges: visibleEdgesRaw };
  }, [initNodes, initEdges, nodeStates, expandedFolderIds, activeFilter, annotations, updateAnnotation, removeAnnotation]);

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
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onSelectionChange={onSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
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

      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isOpen={contextMenu.toggled}
        onClose={() => setContextMenu(prev => ({ ...prev, toggled: false }))}
        onFocus={() => {
          if (contextMenu.nodeId) {
            const target = nodes.find(n => n.id === contextMenu.nodeId);
            if (target) {
              fitView({ nodes: [target], duration: 800, padding: 0.5, maxZoom: 1.5 });
            }
          }
        }}
        onAnnotate={() => {
          if (contextMenu.nodeId) {
            addAnnotation(contextMenu.nodeId, contextMenu.x, contextMenu.y);
          }
        }}
        onViewDetails={() => {
          if (contextMenu.nodeId && onNodeDoubleClick) {
            const target = nodes.find(n => n.id === contextMenu.nodeId);
            if (target) {
              onNodeDoubleClick({} as React.MouseEvent, target);
            }
          }
        }}
      />
    </>
  );
}
