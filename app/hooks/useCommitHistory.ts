// app/hooks/useCommitHistory.ts
// Fetches commit history from the backend and populates CommitContext.

import { useEffect, useState } from 'react';
import { useCommitContext, type Commit } from '../context/CommitContext';
import { API_BASE } from '../utils/constants';

interface UseCommitHistoryReturn {
  loading: boolean;
  error: string | null;
}


export function useCommitHistory(repoUrl: string): UseCommitHistoryReturn {
  const { setCommits, setSelectedIndex } = useCommitContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setCommits([]);
    setSelectedIndex(0);

    const encoded = encodeURIComponent(repoUrl);
    fetch(`${API_BASE}/commit-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: repoUrl, limit: 100 })
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { commits: Commit[] }) => {
        if (cancelled) return;
        // Sort oldest → newest so index 0 = repo birth
        const sorted = [...(data.commits || [])].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        setCommits(sorted);
        setSelectedIndex(sorted.length - 1); // default to latest
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [repoUrl, setCommits, setSelectedIndex]);

  return { loading, error };
}
