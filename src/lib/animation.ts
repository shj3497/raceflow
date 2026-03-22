import type { RunnerResult, SplitPoint } from './types';

/**
 * Interpolate a runner's position along the course at a given time.
 * Returns [lng, lat] or null if the runner hasn't started or has finished.
 */
export function interpolateRunnerPosition(
  runner: RunnerResult,
  currentTime: number,
  splitPoints: SplitPoint[],
  courseCoords: [number, number][],
): [number, number] | null {
  const { splits } = runner;
  if (splits.length === 0) return null;

  // Not started yet
  if (currentTime < splits[0].time_seconds) return null;

  // Find which segment the runner is in
  let segStart = splits[0];
  let segEnd = splits[splits.length - 1];
  let segStartIdx = 0;
  let segEndIdx = splits.length - 1;

  for (let i = 0; i < splits.length - 1; i++) {
    if (currentTime >= splits[i].time_seconds && currentTime < splits[i + 1].time_seconds) {
      segStart = splits[i];
      segEnd = splits[i + 1];
      segStartIdx = i;
      segEndIdx = i + 1;
      break;
    }
  }

  // Past last split (finished or DNF)
  if (currentTime >= splits[splits.length - 1].time_seconds) {
    if (runner.finish_time_seconds !== null) {
      // Finished - return finish position
      return splitPoints[splitPoints.length - 1].coordinates;
    }
    // DNF - return last known position
    const lastSplit = splitPoints[Math.min(splits.length - 1, splitPoints.length - 1)];
    return lastSplit.coordinates;
  }

  // Calculate fraction within segment
  const segDuration = segEnd.time_seconds - segStart.time_seconds;
  if (segDuration <= 0) return splitPoints[segStartIdx]?.coordinates ?? null;

  const fraction = (currentTime - segStart.time_seconds) / segDuration;

  // Map split indices to course coordinate ranges
  const totalCoords = courseCoords.length;
  const startCoordIdx = Math.floor((segStartIdx / (splitPoints.length - 1)) * (totalCoords - 1));
  const endCoordIdx = Math.floor((segEndIdx / (splitPoints.length - 1)) * (totalCoords - 1));

  // Interpolate along course coordinates in this segment
  const segCoordRange = endCoordIdx - startCoordIdx;
  const exactIdx = startCoordIdx + fraction * segCoordRange;
  const lowIdx = Math.floor(exactIdx);
  const highIdx = Math.min(lowIdx + 1, totalCoords - 1);
  const subFraction = exactIdx - lowIdx;

  const lng = courseCoords[lowIdx][0] + (courseCoords[highIdx][0] - courseCoords[lowIdx][0]) * subFraction;
  const lat = courseCoords[lowIdx][1] + (courseCoords[highIdx][1] - courseCoords[lowIdx][1]) * subFraction;

  return [lng, lat];
}

/**
 * Status of a runner at a given time
 */
export type RunnerStatus = 'not_started' | 'on_course' | 'finished' | 'dnf';

export function getRunnerStatus(runner: RunnerResult, currentTime: number): RunnerStatus {
  if (runner.splits.length === 0) return 'not_started';
  if (currentTime < runner.splits[0].time_seconds) return 'not_started';

  if (runner.finish_time_seconds === null) {
    // DNF runner
    const lastSplit = runner.splits[runner.splits.length - 1];
    if (currentTime >= lastSplit.time_seconds) return 'dnf';
    return 'on_course';
  }

  if (currentTime >= runner.finish_time_seconds) return 'finished';
  return 'on_course';
}

/**
 * Build GeoJSON FeatureCollection for all runners at a given time.
 */
export function buildRunnersGeoJSON(
  runners: RunnerResult[],
  currentTime: number,
  splitPoints: SplitPoint[],
  courseCoords: [number, number][],
  highlightedRunnerId?: string | null,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const runner of runners) {
    const pos = interpolateRunnerPosition(runner, currentTime, splitPoints, courseCoords);
    if (!pos) continue;

    const status = getRunnerStatus(runner, currentTime);
    const isHighlighted = highlightedRunnerId === runner.id;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: pos },
      properties: {
        id: runner.id,
        bib: runner.bib,
        name: runner.name,
        status,
        highlighted: isHighlighted,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Calculate race stats at a given time.
 */
export interface RaceStats {
  onCourse: number;
  finished: number;
  notStarted: number;
  dnf: number;
  elapsedTime: number;
}

export function calculateStats(
  runners: RunnerResult[],
  currentTime: number,
): RaceStats {
  let onCourse = 0;
  let finished = 0;
  let notStarted = 0;
  let dnf = 0;

  for (const runner of runners) {
    const status = getRunnerStatus(runner, currentTime);
    switch (status) {
      case 'on_course': onCourse++; break;
      case 'finished': finished++; break;
      case 'not_started': notStarted++; break;
      case 'dnf': dnf++; break;
    }
  }

  return { onCourse, finished, notStarted, dnf, elapsedTime: currentTime };
}
