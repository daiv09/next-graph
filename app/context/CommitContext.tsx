'use client';
// app/context/CommitContext.tsx
// Provides commit timeline state (commits list, selected index, play state) across the app.

import React, { createContext, useContext, useState } from 'react';

export interface Commit {
  sha: string;
  date: string;          // ISO-8601
  message: string;
  added: string[];
  modified: string[];
  deleted: string[];
}

interface CommitContextValue {
  commits: Commit[];
  setCommits: React.Dispatch<React.SetStateAction<Commit[]>>;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  speed: number;
  setSpeed: React.Dispatch<React.SetStateAction<number>>;
  repoUrl: string;
  setRepoUrl: React.Dispatch<React.SetStateAction<string>>;
}

const CommitContext = createContext<CommitContextValue | null>(null);

export function CommitProvider({ children }: { children: React.ReactNode }) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  const [repoUrl, setRepoUrl] = useState('');

  return (
    <CommitContext.Provider
      value={{
        commits,
        setCommits,
        selectedIndex,
        setSelectedIndex,
        isPlaying,
        setIsPlaying,
        speed,
        setSpeed,
        repoUrl,
        setRepoUrl,
      }}
    >
      {children}
    </CommitContext.Provider>
  );
}

export function useCommitContext() {
  const ctx = useContext(CommitContext);
  if (!ctx) throw new Error('useCommitContext must be used within CommitProvider');
  return ctx;
}
