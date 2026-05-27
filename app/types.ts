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
};
