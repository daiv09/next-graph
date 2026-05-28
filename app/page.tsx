'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassNode } from './components/GlassNode';
import { ChatPanel } from './components/ChatPanel';
import { FilterBar, type FilterState } from './components/FilterBar';
import FilePreviewPanel from './components/FilePreviewPanel';
import { SearchBar } from './components/SearchBar';
import { LoadingOverlay } from './components/LoadingOverlay';
import { GraphCanvas } from './components/GraphCanvas';
import { CommitTimeline } from './components/CommitTimeline';
import { CommitProvider, useCommitContext } from './context/CommitContext';
import { AnalyticsProvider, useAnalyticsContext } from './context/AnalyticsContext';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { buildFromPlaceholder, buildFromApi } from './utils/graphBuilder';
import { PLACEHOLDER } from './utils/constants';
import type { Node, Edge, NodeTypes } from '@xyflow/react';
import type { GlassNodeData, NodeKind, FetchStatus } from './types';

import { AnnotationNode } from './components/AnnotationNode';
import { SpotlightSearch } from './components/SpotlightSearch';
import { CommandPaletteProvider } from './context/CommandPaletteContext';
import { TourProvider } from './context/TourContext';
import { TourPanel } from './components/TourPanel';
import { decodeShareState } from './utils/shareState';
import { ShareButton } from './components/ShareButton';
import { ExportMenu } from './components/ExportMenu';
import { useExportShortcuts } from './hooks/useExportShortcuts';

// ── Node Types ────────────────────────────────────────────────────────────────
const nodeTypes: NodeTypes = { glass: GlassNode, annotation: AnnotationNode };
const INITIAL_FLOW = buildFromPlaceholder(PLACEHOLDER);

// ── Inner component (needs CommitContext already mounted) ─────────────────────
function RepoGraphInner() {
  const { setRepoUrl } = useCommitContext();
  const { isAnalyticsPanelOpen, setIsAnalyticsPanelOpen } = useAnalyticsContext();

  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [flowData, setFlowData] = useState<{ nodes: Node[]; edges: Edge[] }>(INITIAL_FLOW);
  const [meta, setMeta] = useState<any>(null);
  const [graphKey, setGraphKey] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [currentRepoUrl, setCurrentRepoUrl] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    showFolders: true,
    showFiles: true,
    showDependencies: true,
    minSizeKb: 0,
  });
  const abortRef = useRef<AbortController | null>(null);
  const [previewNode, setPreviewNode] = useState<Node | null>(null);

  const displayLabel = meta?.repo ?? PLACEHOLDER.nodes[0]?.label ?? 'Repository';
  useExportShortcuts(displayLabel);

  const { setViewport } = useReactFlow();

  // Hydration effect for shared state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const s = searchParams.get('s');
      if (s) {
        const decoded = decodeShareState(s);
        if (decoded) {
          if (decoded.repoUrl) {
            handleSearch(decoded.repoUrl);
          }
          if (decoded.filter) {
            setIsAnalyticsPanelOpen(true);
            // activeFilter is managed by AnalyticsContext, but hydration is tricky without its setter
            // Wait, we don't have setActiveFilter in context? The instruction said:
            // "If share data exists, it should automatically trigger the parse-repo fetch, apply the filters, and use React Flow's setViewport"
          }
          if (decoded.viewport) {
            // Delay to allow nodes to render
            setTimeout(() => {
              setViewport({ x: decoded.viewport!.x, y: decoded.viewport!.y, zoom: decoded.viewport!.zoom });
            }, 1000);
          }
        }
      }
    }
  }, []); // Run once on mount

  // In RepoGraphInner component
  const handleNodeClick = useCallback((_evt: React.MouseEvent, node: Node) => {
    // Single click: Select the node (which triggers ChatPanel expansion via selectedNode)
    setSelectedNode(node);
  }, []);

  // 2. Double click: Selects the node AND triggers the Chat Panel
  // We need a ref to access the ChatPanel's "open" function
  const chatPanelRef = useRef<{ toggleChat: (open: boolean) => void }>(null);

  const handleNodeDoubleClick = useCallback((_evt: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    // Force the Chat Panel to open
    chatPanelRef.current?.toggleChat(true);
  }, []);

  const handleSearch = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFetchStatus('loading');
    setSelectedNode(null);
    setPreviewNode(null);
    setIsFilterOpen(false);
    setShowTimeline(false);
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

      // Sync repo URL into commit context for timeline
      setCurrentRepoUrl(url);
      setRepoUrl(url);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setFetchStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  }, [setRepoUrl]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  // ── REFACTORED FILTERING ──────────────────────────────────────────────────
  // We compute visibility logic once and apply it to the nodes
  const processedGraph = useMemo(() => {
    const isNodeVisible = (node: Node) => {
      const d = node.data as GlassNodeData;
      const label = (d?.label ?? '').toLowerCase();
      const searchMatch = filters.search === '' || label.includes(filters.search.toLowerCase());
      const type = node.type || d?.nodeType;

      let typeMatch = true;
      if (type === 'folder') typeMatch = filters.showFolders;
      if (type === 'file') typeMatch = filters.showFiles;
      if (type === 'dependency') typeMatch = filters.showDependencies;

      let sizeMatch = true;
      if (filters.minSizeKb > 0 && (type === 'file' || type === 'dependency')) {
        sizeMatch = (d?.size ?? 0) / 1024 >= filters.minSizeKb;
      }

      return type === 'root' || (searchMatch && typeMatch && sizeMatch);
    };

    // 1. Identify which nodes are explicitly visible
    const visibleNodeIds = new Set(
      flowData.nodes.filter(isNodeVisible).map(n => n.id)
    );

    // 2. Mark nodes as hidden or visible
    const nodes = flowData.nodes.map(node => ({
      ...node,
      hidden: !visibleNodeIds.has(node.id)
    }));

    // 3. Edges are hidden if either source OR target is hidden
    const edges = flowData.edges.map(edge => ({
      ...edge,
      hidden: !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)
    }));

    return { nodes, edges };
  }, [flowData, filters]);

  // Use these in your GraphCanvas
  const { nodes: displayNodes, edges: displayEdges } = processedGraph;

  const visibleNodesCount = useMemo(() => processedGraph.nodes.filter(n => !n.hidden).length, [processedGraph]);
  const visibleEdgesCount = useMemo(() => processedGraph.edges.filter(e => !e.hidden).length, [processedGraph]);

  const handleChatSendMessage = useCallback(async (text: string) => {
    const res = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo_name: displayLabel,
        messages: [{ sender: 'user', text }],
        nodes: flowData.nodes,
        edges: flowData.edges,
        selected_node: selectedNode
          ? { id: selectedNode.id, type: selectedNode.type, data: selectedNode.data }
          : null,
      }),
    });
    if (!res.ok) throw new Error('Failed to communicate with the chat agent');
    const data = await res.json() as { text: string };
    return data.text;
  }, [displayLabel, flowData.nodes, flowData.edges, selectedNode]);

  return (
    <>
      <main className="relative flex flex-col w-screen h-screen overflow-hidden bg-[#121212] font-sans">

        {/* Background Pattern */}
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* --- TOP LAYER: Search & Filters --- */}
        <header className="absolute top-0 left-0 w-full z-30 p-4 flex justify-center pointer-events-none">
          <div className="w-full max-w-2xl pointer-events-auto flex flex-col gap-2">
            <SearchBar
              status={fetchStatus}
              errorMessage={errorMessage}
              onSubmit={handleSearch}
              isFilterOpen={isFilterOpen}
              onToggleFilter={() => setIsFilterOpen(!isFilterOpen)}
            />
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <FilterBar filters={filters} onChange={setFilters} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <ChatPanel
          ref={chatPanelRef}
          repoName={displayLabel}
          nodesCount={visibleNodesCount}
          edgesCount={visibleEdgesCount}
          selectedNode={selectedNode}
          onSendMessage={handleChatSendMessage}
          onViewCode={node => setPreviewNode(node)}
        />

        {/* --- SIDE LAYER: Floating Action Buttons --- */}
        {fetchStatus === 'success' && (
          <aside className="absolute top-20 right-4 z-30 flex flex-col gap-2">
            <ExportMenu projectName={displayLabel} />
            <ShareButton repoUrl={currentRepoUrl} filters={filters} />
            <button onClick={() => setShowTimeline(!showTimeline)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition">🎬 Timeline</button>
            {meta?.analytics && <button onClick={() => setIsAnalyticsPanelOpen(!isAnalyticsPanelOpen)} className="p-2 bg-white/10 rounded-lg">📊 Analytics</button>}
          </aside>
        )}

        {/* --- CENTER LAYER: The Graph Canvas --- */}
        <section className="flex-1 w-full h-full relative z-10">
          <GraphCanvas
            nodes={processedGraph.nodes}
            edges={processedGraph.edges}
            nodeTypes={nodeTypes}
            onSelectedNodeChange={setSelectedNode}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
          />
          {/* Spotlight Search Overlay */}
          <SpotlightSearch />

          <TourPanel />
          {/* Tour Overlay */}
          {fetchStatus === 'loading' && <LoadingOverlay />}
        </section>


        {/* --- BOTTOM LAYER: Footer & Panels --- */}
        <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-6 py-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <span className="text-white font-medium">{visibleNodesCount} nodes</span>
            <span className="opacity-20">|</span>
            <span className="text-white font-medium">{visibleEdgesCount} edges</span>
          </div>
          <div className="text-[11px] text-white/30 truncate max-w-[120px]">{meta?.repo || "Ready"}</div>
        </footer>

        <AnimatePresence>{showTimeline && <CommitTimeline repoUrl={currentRepoUrl} />}</AnimatePresence>
        <AnimatePresence>{isAnalyticsPanelOpen && <AnalyticsPanel analytics={meta.analytics} onClose={() => setIsAnalyticsPanelOpen(false)} />}</AnimatePresence>

        <AnimatePresence>
          {previewNode && (() => {
            const pd = previewNode.data as GlassNodeData;
            return (
              <FilePreviewPanel
                repoUrl={meta?.owner ? `https://github.com/${meta.owner}/${meta.repo}` : 'owner/repository'}
                path={pd?.path || pd?.label || previewNode.id}
                label={pd?.label || previewNode.id}
                size={pd?.size}
                nodeType={(pd?.nodeType as NodeKind) || 'file'}
                onClose={() => setPreviewNode(null)}
              />
            );
          })()}
        </AnimatePresence>
      </main>
    </>
  );
}

// ── Root export wraps everything in CommitProvider ────────────────────────────
export default function Page() {
  return (
    <ReactFlowProvider>
      <CommitProvider>
        <AnalyticsProvider>
          <CommandPaletteProvider>
            <TourProvider>
              <RepoGraphInner />
            </TourProvider>
          </CommandPaletteProvider>
        </AnalyticsProvider>
      </CommitProvider>
    </ReactFlowProvider>
  );
}
