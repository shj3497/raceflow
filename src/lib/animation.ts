import type { AnimationPayload } from './interpolate';
import type { ResultRow } from './types';
import { parseTime } from './interpolate';

/**
 * Build GeoJSON FeatureCollection from a single animation frame.
 */
export function buildFrameGeoJSON(
  animData: AnimationPayload,
  results: ResultRow[],
  frameIndex: number,
  highlightedBib?: string | null,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  if (frameIndex < 0 || frameIndex >= animData.frames.length) {
    return { type: 'FeatureCollection', features };
  }

  const frame = animData.frames[frameIndex];
  const currentTimeSec = frameIndex * animData.frame_interval;

  for (let i = 0; i < frame.length; i++) {
    const pos = frame[i];
    if (!pos) continue;

    const runner = results[i];
    const netTimeSec = parseTime(runner.net_time);
    let status: string = 'on_course';
    if (netTimeSec !== null && currentTimeSec >= netTimeSec) {
      status = 'finished';
    }

    const isHighlighted = highlightedBib === runner.bib_number;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: pos },
      properties: {
        bib: runner.bib_number,
        name: runner.name,
        status,
        highlighted: isHighlighted,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Calculate race stats at a given frame.
 */
export interface RaceStats {
  onCourse: number;
  finished: number;
  notStarted: number;
  elapsedTime: number;
}

export function calculateStats(
  animData: AnimationPayload,
  results: ResultRow[],
  frameIndex: number,
): RaceStats {
  let onCourse = 0;
  let finished = 0;
  let notStarted = 0;

  if (frameIndex < 0 || frameIndex >= animData.frames.length) {
    return { onCourse: 0, finished: 0, notStarted: results.length, elapsedTime: 0 };
  }

  const frame = animData.frames[frameIndex];
  const currentTimeSec = frameIndex * animData.frame_interval;

  for (let i = 0; i < results.length; i++) {
    const pos = frame[i];
    const runner = results[i];
    const netTimeSec = parseTime(runner.net_time);

    if (!pos) {
      // null position = either not started or already finished past their time
      if (netTimeSec !== null && currentTimeSec >= netTimeSec) {
        finished++;
      } else {
        notStarted++;
      }
    } else {
      if (netTimeSec !== null && currentTimeSec >= netTimeSec) {
        finished++;
      } else {
        onCourse++;
      }
    }
  }

  return {
    onCourse,
    finished,
    notStarted,
    elapsedTime: currentTimeSec,
  };
}
