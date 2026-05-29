// types.ts
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
export type NodeKind = 'root' | 'folder' | 'file' | 'dependency' | 'dir';

export interface RepoNode {
  id: string;
  label: string;
  type: NodeKind;
  path?: string;
  language?: string;
  size?: number;
  description?: string;
}
export interface RepoEdge {
  id: string;
  source: string;
  target: string;
}
export interface RepoGraphPayload {
  nodes: RepoNode[];
  edges: RepoEdge[];
}

/** Shape returned by POST /parse-repo */
export interface ApiNode {
  id: string;
  type: NodeKind;
  data: {
    label: string;
    path?: string;
    size?: number;
    description?: string;
    owner?: string;
    repo?: string;
    sha?: string;
    created_at?: string;
  };
  position: { x: number; y: number };
}
export interface ApiEdge {
  id: string;
  source: string;
  target: string;
}
export interface ApiMeta {
  owner: string;
  repo: string;
  default_branch: string;
  description: string;
  stars: number;
  language: string;
  total_nodes: number;
  total_edges: number;
  truncated: boolean;
  analytics?: {
    typology: { name: string; value: number }[];
    scatter: { path: string; size: number; depth: number }[];
    treemap: { name: string; size: number; fileCount: number }[];
    sizeDistribution: { name: string; value: number }[];
    radar: { name: string; avgSize: number; avgDepth: number; fileCount: number }[];
  };
}
export interface ApiResponse {
  nodes: ApiNode[];
  edges: ApiEdge[];
  meta: ApiMeta;
}

export type AnimState = 'entering' | 'modified' | 'visible' | 'hidden';

export type GlassNodeData = {
  label: string;
  nodeType: NodeKind;
  path?: string;
  language?: string;
  size?: number;
  description?: string;
  created_at?: string;
  animState?: AnimState;
  hiddenCount?: number;
  isCollapsed?: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  isHeatmapMode?: boolean;
  heatmapColor?: string;
  heatmapScale?: number;
  sizeFactor?: number;
  semanticPosition?: { x: number; y: number };
  clusterId?: number;
  clusterLabel?: string;
};

export interface Annotation {
  id: string;
  nodeId: string;
  text: string;
  x: number;
  y: number;
}

export interface ContextMenuState {
  toggled: boolean;
  x: number;
  y: number;
  nodeId: string | null;
}

export interface TourStep {
  stepId: string;
  targetNodeId: string;
  title: string;
  narration: string;
  zoomLevel: number;
}
