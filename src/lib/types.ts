export interface RaceSummary {
  id: string;
  name: string;
  date: string;
  distance_km: number;
  participant_count: number;
}

export interface RaceDetail {
  id: string;
  name: string;
  date: string;
  distance_km: number;
  course_gpx: GeoJSON.LineString; // from Supabase JSONB
  split_points: number[]; // [5, 10, 15, 21.0975]
  participant_count: number;
}

/** Raw result row from Supabase (matches ResultRow in interpolate.ts) */
export interface ResultRow {
  bib_number: string;
  name: string;
  gender: string;
  age_group: string;
  net_time: string | null; // "HH:MM:SS" or null (DNF)
  splits: Record<string, string>; // {"5": "00:25:30", ...}
}

export interface AnimationState {
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  totalDuration: number;
}
