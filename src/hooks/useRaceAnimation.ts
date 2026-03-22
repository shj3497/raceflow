'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseRaceAnimationOptions {
  totalDuration: number;
}

export function useRaceAnimation({ totalDuration }: UseRaceAnimationOptions) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(50);

  const animFrameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(1);

  // Keep refs in sync
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = playbackSpeed; }, [playbackSpeed]);

  const tick = useCallback(
    (timestamp: number) => {
      if (!isPlayingRef.current) return;

      if (lastTimestampRef.current === 0) {
        lastTimestampRef.current = timestamp;
      }

      const delta = (timestamp - lastTimestampRef.current) / 1000; // seconds
      lastTimestampRef.current = timestamp;

      const newTime = currentTimeRef.current + delta * speedRef.current;

      if (newTime >= totalDuration) {
        currentTimeRef.current = totalDuration;
        setCurrentTime(totalDuration);
        setIsPlaying(false);
        return;
      }

      currentTimeRef.current = newTime;
      setCurrentTime(newTime);

      animFrameRef.current = requestAnimationFrame(tick);
    },
    [totalDuration],
  );

  const play = useCallback(() => {
    if (currentTimeRef.current >= totalDuration) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }
    lastTimestampRef.current = 0;
    setIsPlaying(true);
    animFrameRef.current = requestAnimationFrame(tick);
  }, [tick, totalDuration]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  const seek = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, time));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    lastTimestampRef.current = 0;
  }, [totalDuration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isPlayingRef.current) pause();
          else play();
          break;
        case 'ArrowLeft':
          seek(currentTimeRef.current - 10);
          break;
        case 'ArrowRight':
          seek(currentTimeRef.current + 10);
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [play, pause, seek]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return {
    currentTime,
    isPlaying,
    playbackSpeed,
    play,
    pause,
    seek,
    setPlaybackSpeed,
  };
}
