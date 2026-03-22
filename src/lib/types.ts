export interface RaceSummary {
  id: string;
  name: string;
  date: string;
  distance_km: number;
  participant_count: number;
}

export interface SplitPoint {
  name: string;
  distance_km: number;
  coordinates: [number, number]; // [lng, lat]
}

export interface RaceDetail {
  id: string;
  name: string;
  date: string;
  distance_km: number;
  course_geojson: GeoJSON.LineString;
  split_points: SplitPoint[];
  participant_count: number;
}

export interface RunnerSplit {
  split_name: string;
  time_seconds: number; // elapsed seconds from race start
}

export interface RunnerResult {
  id: string;
  bib: string;
  name: string;
  splits: RunnerSplit[];
  finish_time_seconds: number | null; // null if DNF
}

export interface AnimationState {
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  totalDuration: number;
}
