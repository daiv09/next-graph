'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassNode } from './components/GlassNode';
import { ChatPanel } from './components/ChatPanel';
import { FilterBar, type FilterState } from './components/FilterBar';
import FilePreviewPanel from './components/FilePreviewPanel';
import {SearchBar} from './components/SearchBar';
import { LoadingOverlay } from './components/LoadingOverlay';
import { GraphCanvas } from './components/GraphCanvas';
import { applyDagreLayout, buildFromPlaceholder, buildFromApi } from './utils/graphBuilder';
import { PLACEHOLDER } from './utils/constants';
import type { Node, Edge, NodeTypes } from '@xyflow/react';
import type { GlassNodeData, NodeKind, FetchStatus } from './types';

// Node Types
const nodeTypes: NodeTypes = { glass: GlassNode };

const INITIAL_FLOW = buildFromPlaceholder(PLACEHOLDER);

export default function Page() {
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [flowData, setFlowData] = useState<{ nodes: Node[]; edges: Edge[] }>(INITIAL_FLOW);
  const [meta, setMeta] = useState<any>(null);
  const [graphKey, setGraphKey] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    showFolders: true,
    showFiles: true,
    showDependencies: true,
    minSizeKb: 0,
  });
  const abortRef = useRef<AbortController | null>(null);
  const [previewNode, setPreviewNode] = useState<Node | null>(null);

  const handleNodeDoubleClick = useCallback((_evt: React.MouseEvent, node: Node) => {
    const nodeType = node.data?.nodeType || node.type;
    if (nodeType === 'file' || nodeType === 'dependency') {
      setPreviewNode(node);
    }
  }, []);

  const handleSearch = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFetchStatus('loading');
    setSelectedNode(null);
    setPreviewNode(null);
    setIsFilterOpen(false);
    setFilters({
      search: '',
      showFolders: true,
      showFiles: true,
      showDependencies: true,
      minSizeKb: 0,
    });
    setErrorMessage('');

    try {
      const res = await fetch('http://localhost:8000/parse-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { detail?: string };
        const detail = body.detail ?? `Request failed with status ${res.status}`;
        if (res.status === 429) throw new Error(`Rate limit exceeded — ${detail}`);
        if (res.status === 403) throw new Error(`Access denied — ${detail}`);
        if (res.status === 404) throw new Error(`Not found — ${detail}`);
        if (res.status === 422) throw new Error(`Invalid URL — ${detail}`);
        throw new Error(detail);
      }

      const data = (await res.json()) as any;
      const computed = buildFromApi(data);
      setFlowData(computed);
      setMeta(data.meta);
      setFetchStatus('success');
      setGraphKey(k => k + 1);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setFetchStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  }, []);

  const filteredNodes = useMemo(() => {
    const directMatches = new Set<string>();
    flowData.nodes.forEach(node => {
      const label = node.data?.label?.toLowerCase() || '';
      const searchMatch = filters.search === '' || label.includes(filters.search.toLowerCase());
      const type = node.type || node.data?.nodeType;
      let typeMatch = true;
      if (type === 'folder') typeMatch = filters.showFolders;
      if (type === 'file') typeMatch = filters.showFiles;
      if (type === 'dependency') typeMatch = filters.showDependencies;
      let sizeMatch = true;
      if (filters.minSizeKb > 0 && (type === 'file' || type === 'dependency')) {
        const size = (node.data?.size || 0) / 1024;
        sizeMatch = size >= filters.minSizeKb;
      }
      if (type === 'root' || (searchMatch && typeMatch && sizeMatch)) {
        directMatches.add(node.id);
      }
    });
    const keptIds = new Set<string>(directMatches);
    const parentMap: Record<string, string> = {};
    flowData.edges.forEach(edge => {
      parentMap[edge.target] = edge.source;
    });
    directMatches.forEach(matchId => {
      let current = matchId;
      while (parentMap[current]) {
        const parentId = parentMap[current];
        if (keptIds.has(parentId)) break;
        keptIds.add(parentId);
        current = parentId;
      }
    });
    return flowData.nodes.filter(node => keptIds.has(node.id));
  }, [flowData.nodes, flowData.edges, filters]);

  const filteredEdges = useMemo(() => {
    const keptNodeIds = new Set(filteredNodes.map(n => n.id));
    return flowData.edges.filter(edge => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target));
  }, [flowData.edges, filteredNodes]);

  const displayNodes = filteredNodes.length;
  const displayEdges = filteredEdges.length;
  const displayLabel = meta?.repo ?? PLACEHOLDER.nodes[0]?.label ?? 'Repository';

  const handleChatSendMessage = useCallback(async (text: string) => {
    const res = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo_name: displayLabel,
        messages: [{ sender: 'user', text }],
        nodes: flowData.nodes,
        edges: flowData.edges,
        selected_node: selectedNode ? {
          id: selectedNode.id,
          type: selectedNode.type,
          data: selectedNode.data,
        } : null,
      }),
    });
    if (!res.ok) {
      throw new Error('Failed to communicate with the chat agent');
    }
    const data = await res.json() as { text: string };
    return data.text;
  }, [displayLabel, flowData.nodes, flowData.edges, selectedNode]);

  return (
    <>
      <title>next-graph — GitHub Structure Visualizer</title>
      <meta name="description" content="Visualize any GitHub repository as a beautiful hierarchical node graph." />
      <main className="relative flex flex-col w-full h-screen overflow-hidden bg-[#080810]">
        {/* Ambient gradient */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{
          background: [
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(109,40,217,0.28) 0%, transparent 70%)',
            'radial-gradient(ellipse 60% 40% at 80% 110%, rgba(14,165,233,0.18) 0%, transparent 60%)',
            'radial-gradient(ellipse 50% 50% at 10% 90%, rgba(16,185,129,0.10) 0%, transparent 60%)',
          ].join(', '),
        }} />
        {/* Top controls */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-4 flex flex-col items-center gap-3 pointer-events-none">
          <div className="w-full pointer-events-auto">
            <SearchBar
              status={fetchStatus}
              errorMessage={errorMessage}
              onSubmit={handleSearch}
              isFilterOpen={isFilterOpen}
              onToggleFilter={() => setIsFilterOpen(!isFilterOpen)}
            />
          </div>
          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="w-full pointer-events-auto"
              >
                <FilterBar filters={filters} onChange={setFilters} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Canvas */}
        <motion.div
          key={graphKey}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.15 }}
          className="relative z-10 flex-1 w-full h-full"
        >
          <AnimatePresence>
            {fetchStatus === 'loading' && <LoadingOverlay />}
          </AnimatePresence>
          <ReactFlowProvider>
            <GraphCanvas
              key={graphKey}
              nodes={filteredNodes}
              edges={filteredEdges}
              nodeTypes={nodeTypes}
              onSelectedNodeChange={setSelectedNode}
              onNodeDoubleClick={handleNodeDoubleClick}
            />
          </ReactFlowProvider>
        </motion.div>
        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-full bg-white/8 backdrop-blur-2xl border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
          aria-label="Graph statistics"
        >
          <span className="text-[11px] text-white/50"><span className="text-white/80 font-semibold">{displayNodes}</span> nodes</span>
          <span className="w-px h-3 bg-white/20" aria-hidden="true" />
          <span className="text-[11px] text-white/50"><span className="text-white/80 font-semibold">{displayEdges}</span> edges</span>
          <span className="w-px h-3 bg-white/20" aria-hidden="true" />
          <span className="text-[11px] text-white/40">{displayLabel}</span>
          {meta?.truncated && (
            <>
              <span className="w-px h-3 bg-white/20" aria-hidden="true" />
              <span className="text-[11px] text-amber-400/70">⚠ truncated</span>
            </>
          )}
          {meta?.stars !== undefined && meta.stars > 0 && (
            <>
              <span className="w-px h-3 bg-white/20" aria-hidden="true" />
              <span className="text-[11px] text-white/40">⭐ {meta.stars.toLocaleString()}</span>
            </>
          )}
        </motion.footer>
        <ChatPanel
          repoName={displayLabel}
          nodesCount={displayNodes}
          edgesCount={displayEdges}
          selectedNode={selectedNode}
          onSendMessage={handleChatSendMessage}
          onViewCode={node => setPreviewNode(node)}
        />
        <AnimatePresence>
          {previewNode && (
            <FilePreviewPanel
              repoUrl={meta?.owner ? `https://github.com/${meta.owner}/${meta.repo}` : 'owner/repository'}
              path={previewNode.data?.path || previewNode.data?.label || previewNode.id}
              label={previewNode.data?.label || previewNode.id}
              size={previewNode.data?.size}
              nodeType={previewNode.data?.nodeType || 'file'}
              onClose={() => setPreviewNode(null)}
            />
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
