/**
 * 스플릿 데이터 + 코스 GPS 경로 → 시간별 좌표 보간(interpolation)
 * Web Worker 호환 — DOM/Node API 미사용
 */

// ── Types ──────────────────────────────────────────────

export interface LineString {
  type: "LineString";
  coordinates: [number, number][]; // [lng, lat]
}

export interface ResultRow {
  bib_number: string;
  name: string;
  gender: string;
  age_group: string;
  net_time: string | null; // "HH:MM:SS" or null (DNF)
  splits: Record<string, string>; // {"5": "00:25:30", ...}
}

export interface AnimationPayload {
  total_duration_sec: number;
  frame_interval: number;
  runner_count: number;
  /** frames[frameIdx][runnerIdx] = [lng, lat] | null */
  frames: ([number, number] | null)[][];
}

// ── Helpers ────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;

/** Haversine distance between two [lng, lat] points in km */
function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Parse "HH:MM:SS" to seconds. Returns null on invalid input. */
export function parseTime(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.split(":").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/**
 * Build cumulative distance array for a LineString.
 * Returns array of same length as coordinates, where segDistances[i] = distance from start to point i in km.
 */
function buildCumulativeDistances(course: LineString): number[] {
  const coords = course.coordinates;
  const cumDist: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineKm(coords[i - 1], coords[i]));
  }
  return cumDist;
}

// ── Core functions ─────────────────────────────────────

/**
 * 코스 경로에서 거리(km) 지점의 GPS 좌표를 반환한다.
 * 코스 밖의 거리에 대해서는 시작/끝 좌표로 클램프.
 */
export function getPointAtDistance(
  course: LineString,
  distanceKm: number,
  _cumDist?: number[],
): [number, number] {
  const coords = course.coordinates;
  const cumDist = _cumDist ?? buildCumulativeDistances(course);
  const totalDist = cumDist[cumDist.length - 1];

  // clamp
  if (distanceKm <= 0) return coords[0];
  if (distanceKm >= totalDist) return coords[coords.length - 1];

  // find segment
  for (let i = 1; i < cumDist.length; i++) {
    if (cumDist[i] >= distanceKm) {
      const segLen = cumDist[i] - cumDist[i - 1];
      if (segLen === 0) return coords[i];
      const t = (distanceKm - cumDist[i - 1]) / segLen;
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      return [lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t];
    }
  }

  return coords[coords.length - 1];
}

/**
 * 참가자 한 명의 스플릿 데이터를 프레임별 좌표로 보간한다.
 */
export function interpolateRunner(
  course: LineString,
  splits: Record<string, string>,
  splitDistances: number[],
  totalFrames: number,
  frameIntervalSec: number,
  netTimeSec: number | null,
  _cumDist?: number[],
): ([number, number] | null)[] {
  const cumDist = _cumDist ?? buildCumulativeDistances(course);
  const totalCourseDist = cumDist[cumDist.length - 1];

  const waypoints: { distance: number; timeSec: number }[] = [
    { distance: 0, timeSec: 0 },
  ];

  for (const dist of splitDistances) {
    const key = String(dist);
    const timeSec = parseTime(splits[key]);
    if (timeSec !== null) {
      waypoints.push({ distance: dist, timeSec });
    }
  }

  if (netTimeSec !== null) {
    waypoints.push({ distance: totalCourseDist, timeSec: netTimeSec });
  }

  waypoints.sort((a, b) => a.timeSec - b.timeSec);

  // Need at least 2 waypoints to interpolate
  if (waypoints.length < 2) {
    return new Array(totalFrames).fill(null);
  }

  const lastWaypoint = waypoints[waypoints.length - 1];
  const frames: ([number, number] | null)[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const timeSec = f * frameIntervalSec;

    if (timeSec < 0) {
      frames.push(null);
      continue;
    }

    if (timeSec > lastWaypoint.timeSec) {
      frames.push(null);
      continue;
    }

    let segIdx = 1;
    for (let i = 1; i < waypoints.length; i++) {
      if (waypoints[i].timeSec >= timeSec) {
        segIdx = i;
        break;
      }
    }

    const prev = waypoints[segIdx - 1];
    const next = waypoints[segIdx];
    const segDuration = next.timeSec - prev.timeSec;

    let distance: number;
    if (segDuration === 0) {
      distance = next.distance;
    } else {
      const t = (timeSec - prev.timeSec) / segDuration;
      distance = prev.distance + (next.distance - prev.distance) * t;
    }

    frames.push(getPointAtDistance(course, distance, cumDist));
  }

  return frames;
}

/**
 * 전체 참가자의 애니메이션 데이터를 생성한다.
 * NOTE: 대량 데이터(9,000+명)에서는 너무 느림 — computeFramePositions 사용 권장.
 */
export function generateAnimationData(
  course: LineString,
  results: ResultRow[],
  splitDistances: number[],
  frameIntervalSec: number = 1,
): AnimationPayload {
  const cumDist = buildCumulativeDistances(course);

  let maxTimeSec = 0;
  for (const r of results) {
    const t = parseTime(r.net_time);
    if (t !== null && t > maxTimeSec) maxTimeSec = t;
  }

  if (maxTimeSec === 0) {
    return {
      total_duration_sec: 0,
      frame_interval: frameIntervalSec,
      runner_count: results.length,
      frames: [],
    };
  }

  const totalFrames = Math.ceil(maxTimeSec / frameIntervalSec) + 1;

  const runnerFrames: ([number, number] | null)[][] = results.map((r) =>
    interpolateRunner(
      course,
      r.splits,
      splitDistances,
      totalFrames,
      frameIntervalSec,
      parseTime(r.net_time),
      cumDist,
    ),
  );

  const frames: ([number, number] | null)[][] = [];
  for (let f = 0; f < totalFrames; f++) {
    const frame: ([number, number] | null)[] = [];
    for (let r = 0; r < results.length; r++) {
      frame.push(runnerFrames[r][f]);
    }
    frames.push(frame);
  }

  return {
    total_duration_sec: maxTimeSec,
    frame_interval: frameIntervalSec,
    runner_count: results.length,
    frames,
  };
}

// ── Per-frame on-demand computation (for large datasets) ──

export interface RunnerWaypoints {
  bib_number: string;
  name: string;
  gender: string;
  age_group: string;
  net_time: string | null;
  netTimeSec: number | null;
  waypoints: { distance: number; timeSec: number }[];
}

/**
 * Pre-compute waypoints for all runners (lightweight).
 * Returns data needed for per-frame interpolation without computing all frames.
 */
export function prepareRunnerWaypoints(
  results: ResultRow[],
  splitDistances: number[],
  totalCourseDist: number,
): { runners: RunnerWaypoints[]; maxTimeSec: number } {
  let maxTimeSec = 0;
  const runners: RunnerWaypoints[] = results.map((r) => {
    const netTimeSec = parseTime(r.net_time);
    if (netTimeSec !== null && netTimeSec > maxTimeSec) maxTimeSec = netTimeSec;

    const waypoints: { distance: number; timeSec: number }[] = [
      { distance: 0, timeSec: 0 },
    ];

    for (const dist of splitDistances) {
      const key = String(dist);
      const timeSec = parseTime(r.splits[key]);
      if (timeSec !== null) {
        waypoints.push({ distance: dist, timeSec });
      }
    }

    if (netTimeSec !== null) {
      waypoints.push({ distance: totalCourseDist, timeSec: netTimeSec });
    }

    waypoints.sort((a, b) => a.timeSec - b.timeSec);

    return {
      bib_number: r.bib_number,
      name: r.name,
      gender: r.gender,
      age_group: r.age_group,
      net_time: r.net_time,
      netTimeSec,
      waypoints,
    };
  });

  return { runners, maxTimeSec };
}

/**
 * Compute a single runner's position at a given time.
 */
function getRunnerPositionAtTime(
  runner: RunnerWaypoints,
  timeSec: number,
  course: LineString,
  cumDist: number[],
): [number, number] | null {
  const { waypoints } = runner;

  if (waypoints.length < 2) return null;

  const lastWaypoint = waypoints[waypoints.length - 1];
  if (timeSec < 0 || timeSec > lastWaypoint.timeSec) return null;

  let segIdx = 1;
  for (let i = 1; i < waypoints.length; i++) {
    if (waypoints[i].timeSec >= timeSec) {
      segIdx = i;
      break;
    }
  }

  const prev = waypoints[segIdx - 1];
  const next = waypoints[segIdx];
  const segDuration = next.timeSec - prev.timeSec;

  let distance: number;
  if (segDuration === 0) {
    distance = next.distance;
  } else {
    const t = (timeSec - prev.timeSec) / segDuration;
    distance = prev.distance + (next.distance - prev.distance) * t;
  }

  return getPointAtDistance(course, distance, cumDist);
}

/**
 * Compute positions for ALL runners at a specific time (single frame).
 * Much more efficient than pre-computing all frames.
 */
export function computeFramePositions(
  runners: RunnerWaypoints[],
  timeSec: number,
  course: LineString,
  _cumDist?: number[],
): ([number, number] | null)[] {
  const cumDist = _cumDist ?? buildCumulativeDistances(course);
  return runners.map((r) => getRunnerPositionAtTime(r, timeSec, course, cumDist));
}

/**
 * Build cumulative distances (exposed for reuse).
 */
export { buildCumulativeDistances };
