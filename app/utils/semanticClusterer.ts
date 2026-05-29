import type { Node } from '@xyflow/react';
import type { GlassNodeData } from '../types';

export interface ClusterResult {
  [nodeId: string]: {
    clusterId: number;
    clusterLabel: string;
    x: number;
    y: number;
  };
}

export function computeSemanticLayout(nodes: Node[]): ClusterResult {
  // 1. Filter out file/dependency nodes
  const fileNodes = nodes.filter(n => {
    const type = (n.data as GlassNodeData)?.nodeType || n.type;
    return type === 'file' || type === 'dependency';
  });

  if (fileNodes.length === 0) return {};

  // 2. Preprocess document texts
  const stopWords = new Set([
    'the', 'a', 'of', 'and', 'in', 'to', 'is', 'for', 'with', 'on', 'at', 'by', 'an', 'this', 'that', 
    'from', 'it', 'as', 'are', 'be', 'or', 'your', 'our', 'my', 'her', 'his', 'their', 'xml', 'json',
    'const', 'let', 'var', 'function', 'class', 'import', 'export', 'from', 'default', 'return'
  ]);

  const docs = fileNodes.map(n => {
    const d = n.data as GlassNodeData;
    const label = d?.label || '';
    const desc = d?.description || '';
    const path = d?.path || '';
    // Combine fields for semantic context
    const text = `${desc} ${label} ${path}`.toLowerCase();
    
    // Tokenize
    const tokens = text
      .replace(/[^a-zA-Z0-9_\-\/]/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length > 2 && !stopWords.has(t));

    return { id: n.id, tokens };
  });

  // 3. Build vocabulary
  const vocabSet = new Set<string>();
  docs.forEach(d => d.tokens.forEach(t => vocabSet.add(t)));
  const vocab = Array.from(vocabSet);

  if (vocab.length === 0) {
    // Fallback if no words found: assign circular coords
    const res: ClusterResult = {};
    fileNodes.forEach((n, idx) => {
      const angle = (idx / fileNodes.length) * 2 * Math.PI;
      res[n.id] = {
        clusterId: 0,
        clusterLabel: 'General Files',
        x: 500 + 200 * Math.cos(angle),
        y: 500 + 200 * Math.sin(angle),
      };
    });
    return res;
  }

  // Map vocab to index
  const vocabIndex: { [word: string]: number } = {};
  vocab.forEach((w, idx) => { vocabIndex[w] = idx; });

  // 4. Calculate DF (Document Frequency)
  const df: { [word: string]: number } = {};
  vocab.forEach(w => { df[w] = 0; });
  docs.forEach(d => {
    const uniqueTokens = new Set(d.tokens);
    uniqueTokens.forEach(t => {
      if (t in df) df[t]++;
    });
  });

  const numDocs = docs.length;
  const idf: number[] = vocab.map(w => Math.log(numDocs / (1 + df[w])));

  // 5. Generate TF-IDF Vectors
  const vectors: number[][] = docs.map(d => {
    const vector = new Array(vocab.length).fill(0);
    // Count TFs
    const tfMap: { [word: string]: number } = {};
    d.tokens.forEach(t => {
      tfMap[t] = (tfMap[t] || 0) + 1;
    });

    // Compute TF-IDF
    d.tokens.forEach(t => {
      const idx = vocabIndex[t];
      if (idx !== undefined) {
        vector[idx] = (tfMap[t] / d.tokens.length) * idf[idx];
      }
    });

    // L2 Normalize
    const length = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (length > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= length;
      }
    }

    return vector;
  });

  // 6. K-Means Clustering
  // Choose K: square root of numDocs / 2, capped between 2 and 6
  const K = Math.max(2, Math.min(6, Math.floor(Math.sqrt(numDocs / 2)) || 2));
  
  // Initialize centroids randomly from vectors
  let centroids: number[][] = [];
  const selectedIndices = new Set<number>();
  while (centroids.length < K) {
    const idx = Math.floor(Math.random() * numDocs);
    if (!selectedIndices.has(idx)) {
      selectedIndices.add(idx);
      centroids.push([...vectors[idx]]);
    }
  }

  // Iterate K-Means
  let assignments = new Array(numDocs).fill(-1);
  const maxIterations = 30;
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // Assignment step
    for (let i = 0; i < numDocs; i++) {
      let minDist = Infinity;
      let closestCentroid = 0;
      for (let j = 0; j < K; j++) {
        let dist = 0;
        for (let d = 0; d < vocab.length; d++) {
          const diff = vectors[i][d] - centroids[j][d];
          dist += diff * diff;
        }
        if (dist < minDist) {
          minDist = dist;
          closestCentroid = j;
        }
      }
      if (assignments[i] !== closestCentroid) {
        assignments[i] = closestCentroid;
        changed = true;
      }
    }

    if (!changed) break;

    // Centroids update step
    const newCentroids = Array.from({ length: K }, () => new Array(vocab.length).fill(0));
    const counts = new Array(K).fill(0);

    for (let i = 0; i < numDocs; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let d = 0; d < vocab.length; d++) {
        newCentroids[c][d] += vectors[i][d];
      }
    }

    for (let j = 0; j < K; j++) {
      if (counts[j] > 0) {
        for (let d = 0; d < vocab.length; d++) {
          newCentroids[j][d] /= counts[j];
        }
        // Normalize new centroid
        const len = Math.sqrt(newCentroids[j].reduce((sum, val) => sum + val * val, 0));
        if (len > 0) {
          for (let d = 0; d < vocab.length; d++) {
            newCentroids[j][d] /= len;
          }
        }
        centroids[j] = newCentroids[j];
      } else {
        // Re-initialize empty centroid
        const idx = Math.floor(Math.random() * numDocs);
        centroids[j] = [...vectors[idx]];
      }
    }
  }

  // 7. Cluster Labeling
  const clusterLabels: string[] = [];
  for (let j = 0; j < K; j++) {
    // Find documents in this cluster
    const clusterDocIndices = assignments.map((val, idx) => val === j ? idx : -1).filter(idx => idx !== -1);
    if (clusterDocIndices.length === 0) {
      clusterLabels.push('Miscellaneous');
      continue;
    }

    // Sum TF-IDF weights for all docs in cluster
    const sumWeights = new Array(vocab.length).fill(0);
    clusterDocIndices.forEach(idx => {
      for (let d = 0; d < vocab.length; d++) {
        sumWeights[d] += vectors[idx][d];
      }
    });

    // Sort terms by sumWeights
    const termsWithWeights = vocab.map((word, idx) => ({ word, weight: sumWeights[idx] }));
    termsWithWeights.sort((a, b) => b.weight - a.weight);

    // Get top 3 terms
    const topTerms = termsWithWeights.slice(0, 3).map(tw => {
      const w = tw.word;
      return w.charAt(0).toUpperCase() + w.slice(1);
    });

    clusterLabels.push(topTerms.join(' / ') || 'General Files');
  }

  // 8. 2D Island Layout
  // Space cluster centroids nicely in a circular formation
  const centerX = 500;
  const centerY = 500;
  const clusterCenters: { x: number; y: number }[] = [];
  for (let j = 0; j < K; j++) {
    const angle = (j / K) * 2 * Math.PI;
    // Push the centroids further out to form clear islands
    clusterCenters.push({
      x: centerX + 380 * Math.cos(angle),
      y: centerY + 380 * Math.sin(angle),
    });
  }

  // Assign spiral layout points to nodes within clusters
  const clusterCounts = new Array(K).fill(0);
  const result: ClusterResult = {};

  fileNodes.forEach((n, index) => {
    const cId = assignments[index];
    const center = clusterCenters[cId];
    const nodeIdxInCluster = clusterCounts[cId]++;
    
    const countInCluster = assignments.filter(id => id === cId).length;
    const angle = countInCluster > 1 ? (nodeIdxInCluster / countInCluster) * 2 * Math.PI + (nodeIdxInCluster * 0.15) : 0;
    const r = countInCluster > 1 ? 55 + 38 * Math.sqrt(nodeIdxInCluster) : 0;

    result[n.id] = {
      clusterId: cId,
      clusterLabel: clusterLabels[cId],
      x: center.x + r * Math.cos(angle),
      y: center.y + r * Math.sin(angle),
    };
  });

  return result;
}
