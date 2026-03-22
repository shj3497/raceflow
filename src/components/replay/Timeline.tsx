'use client';

import { useState, useCallback } from 'react';
import { formatTime } from '@/lib/utils';

const SPEEDS = [1, 2, 5, 10, 30, 50, 100];

interface TimelineProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
}

export default function Timeline({
  currentTime,
  totalDuration,
  isPlaying,
  playbackSpeed,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
}: TimelineProps) {
  const [speedOpen, setSpeedOpen] = useState(false);

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      onSeek((val / 100) * totalDuration);
    },
    [onSeek, totalDuration],
  );

  const handleSkip = useCallback(
    (delta: number) => {
      onSeek(Math.max(0, Math.min(totalDuration, currentTime + delta)));
    },
    [onSeek, currentTime, totalDuration],
  );

  return (
    <div className="absolute bottom-4 left-4 right-4 z-40 bg-gray-900/90 backdrop-blur-lg rounded-2xl border border-white/[0.06] px-4 py-3 md:px-6">
      <div className="flex items-center gap-3 md:gap-4">
        {/* Rewind */}
        <button
          onClick={() => handleSkip(-10)}
          className="hidden md:flex items-center justify-center w-9 h-9 rounded-full text-white hover:bg-white/10 transition-colors"
          aria-label="10초 뒤로"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 2v12l5-6L3 2zM8 2v12l5-6L8 2z" transform="scale(-1,1) translate(-16,0)" />
          </svg>
        </button>

        {/* Play / Pause */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="flex items-center justify-center w-11 h-11 rounded-full text-white hover:bg-white/10 transition-colors"
          aria-label={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect x="4" y="3" width="4" height="14" rx="1" />
              <rect x="12" y="3" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 3L17 10L5 17V3Z" />
            </svg>
          )}
        </button>

        {/* Fast forward */}
        <button
          onClick={() => handleSkip(10)}
          className="hidden md:flex items-center justify-center w-9 h-9 rounded-full text-white hover:bg-white/10 transition-colors"
          aria-label="10초 앞으로"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 2v12l5-6L3 2zM8 2v12l5-6L8 2z" />
          </svg>
        </button>

        {/* Speed selector */}
        <div className="relative">
          <button
            onClick={() => setSpeedOpen(!speedOpen)}
            className="text-sm text-blue-300 font-medium px-2.5 py-1 rounded-full hover:bg-white/10 transition-colors"
          >
            {playbackSpeed}x
          </button>
          {speedOpen && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 rounded-lg border border-gray-700 py-1 min-w-[60px]">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onSpeedChange(s);
                    setSpeedOpen(false);
                  }}
                  className={`block w-full text-center text-sm px-3 py-1.5 hover:bg-white/10 transition-colors ${
                    s === playbackSpeed ? 'text-blue-400 font-semibold' : 'text-gray-300'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Slider */}
        <div className="flex-1 relative flex items-center">
          <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleSliderChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Time display */}
        <span className="text-sm font-mono text-gray-300 whitespace-nowrap">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}
