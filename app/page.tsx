'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, Controls,
  ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
  type Edge, type Node, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassNode, type GlassNodeData, type GlassNodeType } from './GlassNode';

// ── Types ──────────────────────────────────────────────────────────────────

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
type NodeKind = 'root' | 'folder' | 'file' | 'dependency';

interface RepoNode { id: string; label: string; type: NodeKind; language?: string; size?: number; description?: string; }
interface RepoEdge  { id: string; source: string; target: string; }
interface RepoGraphPayload { nodes: RepoNode[]; edges: RepoEdge[]; }

/** Shape returned by POST /parse-repo */
interface ApiNode { id: string; type: NodeKind; data: { label: string; path?: string; size?: number; description?: string; owner?: string; repo?: string; sha?: string; }; position: { x: number; y: number }; }
interface ApiEdge { id: string; source: string; target: string; }
interface ApiMeta { owner: string; repo: string; default_branch: string; description: string; stars: number; language: string; total_nodes: number; total_edges: number; truncated: boolean; }
interface ApiResponse { nodes: ApiNode[]; edges: ApiEdge[]; meta: ApiMeta; }

type GlassNodeData = { label: string; nodeType: NodeKind; language?: string; size?: number; description?: string; };
type GlassNodeType = Node<GlassNodeData, 'glass'>;

// ── Placeholder payload ────────────────────────────────────────────────────

const PLACEHOLDER: RepoGraphPayload = {
  nodes: [
    { id: 'root', label: 'next-graph', type: 'root', description: 'GitHub Repository Root' },
    { id: 'app',  label: 'app/',       type: 'folder' },
    { id: 'components', label: 'components/', type: 'folder' },
    { id: 'lib',  label: 'lib/',       type: 'folder' },
    { id: 'public', label: 'public/', type: 'folder' },
    { id: 'page', label: 'page.tsx',  type: 'file', language: 'TypeScript', size: 8200 },
    { id: 'layout', label: 'layout.tsx', type: 'file', language: 'TypeScript', size: 720 },
    { id: 'globals', label: 'globals.css', type: 'file', language: 'CSS', size: 490 },
    { id: 'graph', label: 'GraphCanvas.tsx', type: 'file', language: 'TypeScript', size: 3400 },
    { id: 'search', label: 'SearchBar.tsx', type: 'file', language: 'TypeScript', size: 1200 },
    { id: 'utils', label: 'utils.ts', type: 'file', language: 'TypeScript', size: 900 },
    { id: 'logo', label: 'logo.svg', type: 'file', size: 220 },
    { id: 'favicon', label: 'favicon.ico', type: 'file', size: 25900 },
    { id: 'pkg', label: 'package.json', type: 'dependency', size: 535 },
    { id: 'tsconfig', label: 'tsconfig.json', type: 'file', size: 670 },
    { id: 'nextcfg', label: 'next.config.ts', type: 'file', language: 'TypeScript', size: 135 },
  ],
  edges: [
    { id: 'e1', source: 'root', target: 'app' },
    { id: 'e2', source: 'root', target: 'components' },
    { id: 'e3', source: 'root', target: 'lib' },
    { id: 'e4', source: 'root', target: 'public' },
    { id: 'e5', source: 'root', target: 'pkg' },
    { id: 'e6', source: 'root', target: 'tsconfig' },
    { id: 'e7', source: 'root', target: 'nextcfg' },
    { id: 'e8', source: 'app', target: 'page' },
    { id: 'e9', source: 'app', target: 'layout' },
    { id: 'e10', source: 'app', target: 'globals' },
    { id: 'e11', source: 'components', target: 'graph' },
    { id: 'e12', source: 'components', target: 'search' },
    { id: 'e13', source: 'lib', target: 'utils' },
    { id: 'e14', source: 'public', target: 'logo' },
    { id: 'e15', source: 'public', target: 'favicon' },
  ],
};

// ── Dagre layout ───────────────────────────────────────────────────────────

const NODE_W = 180;
const NODE_H = 72;

function applyDagreLayout(nodes: Node[], edges: Edge[], dir: 'TB' | 'LR' = 'TB'): Node[] {
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

// ── Build React Flow data from placeholder ─────────────────────────────────

function buildFromPlaceholder(pl: RepoGraphPayload): { nodes: Node[]; edges: Edge[] } {
  const rfEdges: Edge[] = pl.edges.map(e => ({
    id: e.id, source: e.source, target: e.target,
    type: 'default', style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 },
  }));
  const rfNodes: Node[] = pl.nodes.map(n => ({
    id: n.id, type: 'glass', position: { x: 0, y: 0 },
    data: { label: n.label, nodeType: n.type, language: n.language, size: n.size, description: n.description } satisfies GlassNodeData,
  }));
  return { nodes: applyDagreLayout(rfNodes, rfEdges), edges: rfEdges };
}

/** Convert API response → dagre-positioned React Flow data */
function buildFromApi(api: ApiResponse): { nodes: Node[]; edges: Edge[] } {
  const rfEdges: Edge[] = api.edges.map(e => ({
    id: e.id, source: e.source, target: e.target,
    type: 'default', style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 },
  }));
  const rfNodes: Node[] = api.nodes.map(n => ({
    id: n.id, type: 'glass', position: { x: 0, y: 0 },
    data: {
      label: n.data.label,
      nodeType: n.type,
      size: n.data.size,
      description: n.data.description,
    } satisfies GlassNodeData,
  }));
  return { nodes: applyDagreLayout(rfNodes, rfEdges), edges: rfEdges };
}

const nodeTypes: NodeTypes = { glass: GlassNode };

// ── SearchBar ──────────────────────────────────────────────────────────────

interface SearchBarProps {
  status: FetchStatus;
  errorMessage: string;
  onSubmit: (url: string) => void;
}

function SearchBar({ status, errorMessage, onSubmit }: SearchBarProps) {
  const [url, setUrl] = useState('');
  const [focused, setFocused] = useState(false);
  const loading = status === 'loading';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;
    onSubmit(url.trim());
  };

  return (
    <motion.div
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 140, damping: 18 }}
      className="absolute top-5 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4"
      role="search"
    >
      <form
        onSubmit={handleSubmit}
        className={[
          'flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-2xl border transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
          status === 'error' ? 'border-red-400/50 shadow-[0_0_20px_rgba(248,113,113,0.2)]'
            : focused       ? 'border-violet-400/50 shadow-[0_0_24px_rgba(139,92,246,0.25)]'
                            : 'border-white/20',
        ].join(' ')}
      >
        {/* GitHub mark */}
        <svg className="w-5 h-5 text-white/50 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>

        <input
          id="github-url-input"
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="https://github.com/owner/repository"
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-white placeholder-white/35 outline-none"
          aria-label="GitHub repository URL"
        />

        <button
          id="search-submit-btn"
          type="submit"
          disabled={loading || !url.trim()}
          aria-label={loading ? 'Loading…' : 'Visualize'}
          className={[
            'flex items-center justify-center w-8 h-8 rounded-xl shrink-0 transition-all duration-200',
            loading || !url.trim()
              ? 'bg-white/10 text-white/30 cursor-not-allowed'
              : 'bg-violet-500/70 text-white hover:bg-violet-500/90 active:scale-95',
          ].join(' ')}
        >
          {loading
            ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" className="opacity-30"/><path strokeLinecap="round" d="M12 3a9 9 0 0 1 9 9"/></svg>
            : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          }
        </button>
      </form>

      <AnimatePresence mode="wait">
        {status === 'error' && (
          <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 text-center text-[11px] text-red-400/90">
            {errorMessage}
          </motion.p>
        )}
        {status === 'idle' && !url && (
          <motion.p key="hint" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 text-center text-[11px] text-white/35">
            Enter a GitHub repository URL to visualize its structure
          </motion.p>
        )}
        {status === 'success' && (
          <motion.p key="ok" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 text-center text-[11px] text-emerald-400/80">
            ✓ Graph loaded successfully
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Loading overlay ────────────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <motion.div
      key="loading-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center backdrop-blur-sm bg-[#080810]/60"
      aria-live="polite"
      aria-label="Fetching repository graph"
    >
      {/* Pulsing rings */}
      <div className="relative flex items-center justify-center mb-6">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-violet-400/40"
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.6, delay: i * 0.5, repeat: Infinity, ease: 'easeOut' }}
            style={{ width: 48, height: 48 }}
          />
        ))}
        <div className="w-12 h-12 rounded-full bg-violet-500/20 backdrop-blur-xl border border-violet-400/30 flex items-center justify-center">
          <svg className="w-5 h-5 animate-spin text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" className="opacity-30"/>
            <path strokeLinecap="round" d="M12 3a9 9 0 0 1 9 9"/>
          </svg>
        </div>
      </div>
      <p className="text-sm text-white/60">Fetching repository structure…</p>
      <p className="text-[11px] text-white/30 mt-1">Calling GitHub Trees API</p>
    </motion.div>
  );
}

// ── GraphCanvas ────────────────────────────────────────────────────────────

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
}

function GraphCanvas({ nodes: initNodes, edges: initEdges }: GraphCanvasProps) {
  const { fitView } = useReactFlow();
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.18, duration: 600 }), 120);
    return () => clearTimeout(t);
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onInit={() => fitView({ padding: 0.18, duration: 500 })}
      fitView minZoom={0.25} maxZoom={2.5}
      defaultEdgeOptions={{ type: 'default', style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1.5 } }}
      proOptions={{ hideAttribution: true }}
      className="!bg-transparent"
    >
      <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.08)" />
      <Controls className="!bg-white/10 !backdrop-blur-xl !border !border-white/20 !rounded-xl !shadow-lg" showInteractive={false} />
    </ReactFlow>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

const INITIAL_FLOW = buildFromPlaceholder(PLACEHOLDER);

export default function Page() {
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [flowData, setFlowData] = useState<{ nodes: Node[]; edges: Edge[] }>(INITIAL_FLOW);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [graphKey, setGraphKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (url: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFetchStatus('loading');
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

      const data: ApiResponse = await res.json();

      // Pass API payload through Dagre for coordinate calculation
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

  const displayNodes = flowData.nodes.length;
  const displayEdges = flowData.edges.length;
  const displayLabel = meta?.repo ?? PLACEHOLDER.nodes[0]?.label ?? 'Repository';

  return (
    <>
      <title>RepoGraph — GitHub Structure Visualizer</title>
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

        <SearchBar status={fetchStatus} errorMessage={errorMessage} onSubmit={handleSearch} />

        {/* Canvas — spring entrance, keyed so it remounts on each successful fetch */}
        <motion.div
          key={graphKey}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.15 }}
          className="relative z-10 flex-1 w-full h-full"
        >
          {/* Loading overlay sits inside the canvas wrapper so it clips correctly */}
          <AnimatePresence>
            {fetchStatus === 'loading' && <LoadingOverlay />}
          </AnimatePresence>

          <ReactFlowProvider>
            <GraphCanvas key={graphKey} nodes={flowData.nodes} edges={flowData.edges} />
          </ReactFlowProvider>
        </motion.div>

        {/* Status bar */}
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
            <><span className="w-px h-3 bg-white/20" aria-hidden="true" />
            <span className="text-[11px] text-amber-400/70">⚠ truncated</span></>
          )}
          {meta?.stars !== undefined && meta.stars > 0 && (
            <><span className="w-px h-3 bg-white/20" aria-hidden="true" />
            <span className="text-[11px] text-white/40">⭐ {meta.stars.toLocaleString()}</span></>
          )}
        </motion.footer>
      </main>
    </>
  );
}
