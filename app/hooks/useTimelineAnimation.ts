import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useCommitContext } from '../context/CommitContext';

export type AnimState = 'entering' | 'modified' | 'visible' | 'hidden';

export function useTimelineAnimation() {
  const { commits, selectedIndex, setSelectedIndex, isPlaying, setIsPlaying, speed } = useCommitContext();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Manage playback loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setSelectedIndex((prev) => {
          if (prev >= commits.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, commits.length, speed, setSelectedIndex, setIsPlaying]);

  // Compute node animation states heavily memoized to prevent React Flow choking
  const nodeStates = useMemo(() => {
    const states: Record<string, AnimState> = {};
    if (!commits || commits.length === 0) return states;

    // Pre-calculate which files were added during this window
    const addedInWindow = new Set<string>();
    commits.forEach(c => {
      c.added?.forEach(p => addedInWindow.add(p));
    });

    for (let i = 0; i <= selectedIndex; i++) {
      const commit = commits[i];
      const isCurrent = i === selectedIndex;

      // Handle explicitly added files
      commit.added?.forEach((path) => {
        states[path] = isCurrent ? 'entering' : 'visible';
      });

      // Handle modified files
      commit.modified?.forEach((path) => {
        if (states[path] && states[path] !== 'hidden') {
          states[path] = isCurrent ? 'modified' : 'visible';
        }
      });

      // Handle deleted files
      commit.deleted?.forEach((path) => {
        states[path] = 'hidden';
      });
    }

    // Hide files that are in the added window but haven't been added yet
    addedInWindow.forEach(path => {
      if (!states[path]) {
        states[path] = 'hidden';
      }
    });

    return states;
  }, [commits, selectedIndex]);

  const togglePlay = useCallback(() => {
    if (selectedIndex >= commits.length - 1 && !isPlaying) {
      // Restart if play is pressed at the end of the timeline
      setSelectedIndex(0);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, selectedIndex, commits.length, setSelectedIndex, setIsPlaying]);

  return {
    nodeStates,
    togglePlay,
  };
}
