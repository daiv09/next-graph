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
  const filteredNodes = useMemo(() => {
    const directMatches = new Set<string>();
    flowData.nodes.forEach(node => {
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
        const size = (d?.size ?? 0) / 1024;
        sizeMatch = size >= filters.minSizeKb;
      }
      if (type === 'root' || (searchMatch && typeMatch && sizeMatch)) {
        directMatches.add(node.id);
      }
    });
    const keptIds = new Set<string>(directMatches);
    const parentMap: Record<string, string> = {};
    flowData.edges.forEach(edge => { parentMap[edge.target] = edge.source; });
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
      <title>next-graph — GitHub Structure Visualizer</title>
      <meta name="description" content="Visualize any GitHub repository as a beautiful hierarchical node graph." />
      <main className="relative flex flex-col w-full h-screen overflow-hidden bg-[#121212]">

        {/* Subtle Dot Pattern Overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

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

        {/* Top Right Action Buttons (Export & Share & Timeline & Analytics) */}
        {fetchStatus === 'success' && (
          <div className="absolute top-20 right-4 z-30 flex items-center gap-3">
            <ExportMenu projectName={displayLabel} />
            <ShareButton repoUrl={currentRepoUrl} filters={filters} />
            <motion.button
              id="toggle-timeline-btn"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setShowTimeline(v => !v)}
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                border: '1.5px solid rgba(167,139,250,0.5)',
                background: showTimeline ? 'rgba(109,40,217,0.45)' : 'rgba(255,255,255,0.08)',
                color: showTimeline ? '#e9d5ff' : 'rgba(255,255,255,0.7)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                transition: 'background 0.2s, color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Show / hide commit timeline"
            >
              🎬 Timeline
            </motion.button>

            {meta?.analytics && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setIsAnalyticsPanelOpen(!isAnalyticsPanelOpen)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 12,
                  border: '1.5px solid rgba(14,165,233,0.5)',
                  background: isAnalyticsPanelOpen ? 'rgba(14,165,233,0.45)' : 'rgba(255,255,255,0.08)',
                  color: isAnalyticsPanelOpen ? '#bae6fd' : 'rgba(255,255,255,0.7)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backdropFilter: 'blur(12px)',
                  transition: 'background 0.2s, color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Show / hide analytics"
              >
                📊 Analytics
              </motion.button>
            )}
          </div>
        )}

        {/* Canvas */}
        <motion.div
          key={graphKey}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.15 }}
          className="relative z-10 flex-1 w-full h-full"
          style={{ paddingBottom: showTimeline ? 90 : 0, transition: 'padding-bottom 0.3s' }}
        >
          <AnimatePresence>
            {fetchStatus === 'loading' && <LoadingOverlay />}
          </AnimatePresence>
          <GraphCanvas
            key={graphKey}
            nodes={filteredNodes}
            edges={filteredEdges}
            nodeTypes={nodeTypes}
            onSelectedNodeChange={setSelectedNode}
            onNodeDoubleClick={handleNodeDoubleClick}
          />
          <SpotlightSearch />
          <TourPanel />
        </motion.div>

        {/* Commit Timeline — pinned to bottom above footer */}
        <AnimatePresence>
          {showTimeline && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                bottom: 56,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 25,
                width: 'calc(100% - 48px)',
                maxWidth: 900,
              }}
            >
              <CommitTimeline repoUrl={currentRepoUrl} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics Panel */}
        <AnimatePresence>
          {isAnalyticsPanelOpen && meta?.analytics && (
            <AnalyticsPanel analytics={meta.analytics} onClose={() => setIsAnalyticsPanelOpen(false)} />
          )}
        </AnimatePresence>

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
