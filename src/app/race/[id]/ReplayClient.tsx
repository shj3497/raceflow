'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type maplibregl from 'maplibre-gl';
import type { RaceDetail, ResultRow } from '@/lib/types';
import type { AnimationPayload } from '@/lib/interpolate';
import { buildFrameGeoJSON, calculateStats } from '@/lib/animation';
import { useRaceAnimation } from '@/hooks/useRaceAnimation';
import MapView from '@/components/replay/MapView';
import TopBar from '@/components/replay/TopBar';
import Timeline from '@/components/replay/Timeline';
import StatsPanel from '@/components/replay/StatsPanel';
import SearchPanel from '@/components/replay/SearchPanel';

interface ReplayClientProps {
  race: RaceDetail;
  results: ResultRow[];
  animationData: AnimationPayload;
}

export default function ReplayClient({ race, results, animationData }: ReplayClientProps) {
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [selectedBib, setSelectedBib] = useState<string | null>(null);

  const totalDuration = animationData.total_duration_sec;

  const { currentTime, isPlaying, playbackSpeed, play, pause, seek, setPlaybackSpeed } =
    useRaceAnimation({ totalDuration });

  const frameIndex = useMemo(
    () => Math.min(
      Math.floor(currentTime / animationData.frame_interval),
      animationData.frames.length - 1,
    ),
    [currentTime, animationData.frame_interval, animationData.frames.length],
  );

  const stats = calculateStats(animationData, results, frameIndex);

  // Update runner positions on the map each frame
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const now = performance.now();
    if (now - lastUpdateRef.current < 33 && isPlaying) return;
    lastUpdateRef.current = now;

    const source = map.getSource('runners') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const geojson = buildFrameGeoJSON(animationData, results, frameIndex, selectedBib);
    source.setData(geojson);
  }, [frameIndex, results, animationData, selectedBib, isPlaying]);

  const handleMapReady = useCallback((map: maplibregl.Map) => {
    mapInstanceRef.current = map;
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      <MapView race={race} onMapReady={handleMapReady} />
      <TopBar raceName={race.name} />
      <StatsPanel stats={stats} />
      <SearchPanel
        runners={results}
        onSelectRunner={setSelectedBib}
        selectedBib={selectedBib}
      />
      <Timeline
        currentTime={currentTime}
        totalDuration={totalDuration}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        onPlay={play}
        onPause={pause}
        onSeek={seek}
        onSpeedChange={setPlaybackSpeed}
      />
    </div>
  );
}
