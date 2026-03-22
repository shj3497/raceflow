'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import type { RaceDetail, RunnerResult } from '@/lib/types';
import { buildRunnersGeoJSON, calculateStats } from '@/lib/animation';
import { useRaceAnimation } from '@/hooks/useRaceAnimation';
import MapView from '@/components/replay/MapView';
import TopBar from '@/components/replay/TopBar';
import Timeline from '@/components/replay/Timeline';
import StatsPanel from '@/components/replay/StatsPanel';
import SearchPanel from '@/components/replay/SearchPanel';

interface ReplayClientProps {
  race: RaceDetail;
  runners: RunnerResult[];
  totalDuration: number;
}

export default function ReplayClient({ race, runners, totalDuration }: ReplayClientProps) {
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [selectedRunner, setSelectedRunner] = useState<string | null>(null);

  const { currentTime, isPlaying, playbackSpeed, play, pause, seek, setPlaybackSpeed } =
    useRaceAnimation({ totalDuration });

  const stats = calculateStats(runners, currentTime);

  const courseCoords = race.course_geojson.coordinates as [number, number][];

  // Update runner positions on the map each frame
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Throttle updates to ~30fps for performance
    const now = performance.now();
    if (now - lastUpdateRef.current < 33 && isPlaying) return;
    lastUpdateRef.current = now;

    const source = map.getSource('runners') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const geojson = buildRunnersGeoJSON(
      runners,
      currentTime,
      race.split_points,
      courseCoords,
      selectedRunner,
    );
    source.setData(geojson);
  }, [currentTime, runners, race.split_points, courseCoords, selectedRunner, isPlaying]);

  const handleMapReady = useCallback((map: maplibregl.Map) => {
    mapInstanceRef.current = map;
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      <MapView race={race} onMapReady={handleMapReady} />
      <TopBar raceName={race.name} />
      <StatsPanel stats={stats} />
      <SearchPanel
        runners={runners}
        onSelectRunner={setSelectedRunner}
        selectedRunnerId={selectedRunner}
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
