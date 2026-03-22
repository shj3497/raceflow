'use client';

import { useState, useMemo } from 'react';
import type { RunnerResult } from '@/lib/types';
import { formatTime } from '@/lib/utils';

interface SearchPanelProps {
  runners: RunnerResult[];
  onSelectRunner: (runnerId: string | null) => void;
  selectedRunnerId: string | null;
}

export default function SearchPanel({ runners, onSelectRunner, selectedRunnerId }: SearchPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return runners
      .filter((r) => r.name.toLowerCase().includes(q) || r.bib.includes(q))
      .slice(0, 10);
  }, [query, runners]);

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    onSelectRunner(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute right-4 bottom-24 z-30 w-12 h-12 flex items-center justify-center rounded-full bg-gray-900/85 backdrop-blur-lg border border-white/[0.06] text-white hover:bg-gray-800/90 transition-colors"
        aria-label="선수 검색"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13L17 17" strokeLinecap="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute right-4 bottom-24 z-30 w-[280px] bg-gray-900/90 backdrop-blur-lg rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Search input */}
      <div className="flex items-center px-3 py-2 border-b border-white/10">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 mr-2 shrink-0">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13L17 17" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="선수 이름 검색..."
          className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none"
          autoFocus
        />
        <button onClick={handleClose} className="text-gray-400 hover:text-white ml-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4L12 12M12 4L4 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="max-h-[240px] overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelectRunner(r.id === selectedRunnerId ? null : r.id)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-white/5 transition-colors ${
                r.id === selectedRunnerId ? 'bg-white/10' : ''
              }`}
            >
              <span className="text-white">
                {r.id === selectedRunnerId && (
                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-2" />
                )}
                <span className="text-gray-500 mr-1.5">#{r.bib}</span>
                {r.name}
              </span>
              <span className="text-gray-400 font-mono text-xs">
                {r.finish_time_seconds ? formatTime(r.finish_time_seconds) : 'DNF'}
              </span>
            </button>
          ))}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && (
        <div className="px-3 py-4 text-center text-sm text-gray-500">
          검색 결과가 없습니다
        </div>
      )}
    </div>
  );
}
