'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type maplibregl from 'maplibre-gl';
import type { RaceDetail } from '@/lib/types';
import type { RunnerWaypoints, LineString } from '@/lib/interpolate';
import { computeFramePositions, buildCumulativeDistances, parseTime } from '@/lib/interpolate';
import { useRaceAnimation } from '@/hooks/useRaceAnimation';
import MapView from '@/components/replay/MapView';
import TopBar from '@/components/replay/TopBar';
import Timeline from '@/components/replay/Timeline';
import StatsPanel from '@/components/replay/StatsPanel';
import SearchPanel from '@/components/replay/SearchPanel';

interface ReplayClientProps {
  race: RaceDetail;
  runners: RunnerWaypoints[];
  maxTimeSec: number;
}

export default function ReplayClient({ race, runners, maxTimeSec }: ReplayClientProps) {
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [selectedBib, setSelectedBib] = useState<string | null>(null);

  const course = useMemo(
    () => race.course_gpx as unknown as LineString,
    [race.course_gpx],
  );
  const cumDist = useMemo(() => buildCumulativeDistances(course), [course]);

  const { currentTime, isPlaying, playbackSpeed, play, pause, seek, setPlaybackSpeed } =
    useRaceAnimation({ totalDuration: maxTimeSec });

  // Compute stats on-the-fly
  const stats = useMemo(() => {
    let onCourse = 0;
    let finished = 0;
    let notStarted = 0;

    for (const r of runners) {
      if (r.waypoints.length < 2) {
        notStarted++;
        continue;
      }
      const lastWp = r.waypoints[r.waypoints.length - 1];
      if (currentTime > lastWp.timeSec) {
        finished++;
      } else if (currentTime <= 0) {
        notStarted++;
      } else {
        onCourse++;
      }
    }

    return { onCourse, finished, notStarted, elapsedTime: currentTime };
  }, [currentTime, runners]);

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

    // Compute positions for current time
    const positions = computeFramePositions(runners, currentTime, course, cumDist);

    // Build GeoJSON
    const features: GeoJSON.Feature[] = [];
    for (let i = 0; i < runners.length; i++) {
      const pos = positions[i];
      if (!pos) continue;

      const runner = runners[i];
      let status = 'on_course';
      if (runner.netTimeSec !== null && currentTime >= runner.netTimeSec) {
        status = 'finished';
      }

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pos },
        properties: {
          bib: runner.bib_number,
          name: runner.name,
          status,
          highlighted: selectedBib === runner.bib_number,
        },
      });
    }

    source.setData({ type: 'FeatureCollection', features });
  }, [currentTime, runners, course, cumDist, selectedBib, isPlaying]);

  const handleMapReady = useCallback((map: maplibregl.Map) => {
    mapInstanceRef.current = map;
  }, []);

  // Convert RunnerWaypoints to ResultRow-like format for SearchPanel
  const searchableRunners = useMemo(
    () =>
      runners.map((r) => ({
        bib_number: r.bib_number,
        name: r.name,
        gender: r.gender,
        age_group: r.age_group,
        net_time: r.net_time,
        splits: {} as Record<string, string>,
      })),
    [runners],
  );

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      <MapView race={race} onMapReady={handleMapReady} />
      <TopBar raceName={race.name} />
      <StatsPanel stats={stats} />
      <SearchPanel
        runners={searchableRunners}
        onSelectRunner={setSelectedBib}
        selectedBib={selectedBib}
      />
      <Timeline
        currentTime={currentTime}
        totalDuration={maxTimeSec}
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
