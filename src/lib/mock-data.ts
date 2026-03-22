import type { RaceSummary, RaceDetail, RunnerResult } from './types';

// Seoul half marathon course (approximate GeoJSON LineString)
const seoulHalfCourse: GeoJSON.LineString = {
  type: 'LineString',
  coordinates: [
    [126.9780, 37.5665], // Start - Seoul City Hall
    [126.9790, 37.5670],
    [126.9810, 37.5680],
    [126.9840, 37.5695],
    [126.9870, 37.5710],
    [126.9900, 37.5725],
    [126.9935, 37.5740],
    [126.9970, 37.5752],
    [127.0000, 37.5760],
    [127.0030, 37.5765],
    [127.0060, 37.5768],
    [127.0090, 37.5770], // ~5K
    [127.0110, 37.5772],
    [127.0130, 37.5775],
    [127.0150, 37.5780],
    [127.0170, 37.5790],
    [127.0185, 37.5805],
    [127.0195, 37.5820],
    [127.0200, 37.5840],
    [127.0198, 37.5860],
    [127.0190, 37.5880],
    [127.0178, 37.5900],
    [127.0165, 37.5915],
    [127.0150, 37.5925], // ~10K
    [127.0130, 37.5930],
    [127.0110, 37.5928],
    [127.0090, 37.5920],
    [127.0070, 37.5910],
    [127.0050, 37.5900],
    [127.0030, 37.5892],
    [127.0010, 37.5885],
    [126.9990, 37.5880],
    [126.9970, 37.5878],
    [126.9950, 37.5880],
    [126.9930, 37.5885],
    [126.9910, 37.5892],
    [126.9895, 37.5900], // ~15K
    [126.9880, 37.5895],
    [126.9865, 37.5885],
    [126.9850, 37.5870],
    [126.9840, 37.5855],
    [126.9835, 37.5840],
    [126.9830, 37.5820],
    [126.9828, 37.5800],
    [126.9825, 37.5780],
    [126.9820, 37.5760],
    [126.9810, 37.5740],
    [126.9800, 37.5720],
    [126.9790, 37.5700],
    [126.9785, 37.5680],
    [126.9780, 37.5665], // Finish - back to start
  ],
};

export const mockRaces: RaceSummary[] = [
  {
    id: 'seoul-half-2026',
    name: '2026 Run Your Way Half Race Seoul',
    date: '2026-03-15',
    distance_km: 21.0975,
    participant_count: 9206,
  },
  {
    id: 'busan-10k-2026',
    name: '2026 Busan Haeundae 10K',
    date: '2026-04-20',
    distance_km: 10,
    participant_count: 3500,
  },
  {
    id: 'jeju-full-2026',
    name: '2026 Jeju International Marathon',
    date: '2026-05-10',
    distance_km: 42.195,
    participant_count: 12000,
  },
];

export const mockRaceDetail: RaceDetail = {
  id: 'seoul-half-2026',
  name: '2026 Run Your Way Half Race Seoul',
  date: '2026-03-15',
  distance_km: 21.0975,
  course_geojson: seoulHalfCourse,
  split_points: [
    { name: 'START', distance_km: 0, coordinates: [126.9780, 37.5665] },
    { name: '5K', distance_km: 5, coordinates: [127.0090, 37.5770] },
    { name: '10K', distance_km: 10, coordinates: [127.0150, 37.5925] },
    { name: '15K', distance_km: 15, coordinates: [126.9895, 37.5900] },
    { name: 'FINISH', distance_km: 21.0975, coordinates: [126.9780, 37.5665] },
  ],
  participant_count: 9206,
};

// Generate mock runner results
function generateMockRunners(count: number): RunnerResult[] {
  const surnames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
  const givenNames = ['민수', '서연', '지훈', '하은', '준호', '수빈', '도윤', '예진', '시우', '다은'];

  const runners: RunnerResult[] = [];
  for (let i = 0; i < count; i++) {
    const surname = surnames[Math.floor(Math.random() * surnames.length)];
    const given = givenNames[Math.floor(Math.random() * givenNames.length)];

    // Base finish time: 80~180 minutes, normal-ish distribution
    const baseMins = 80 + Math.random() * 60 + Math.random() * 40;
    const finishSec = Math.round(baseMins * 60);
    const isDNF = Math.random() < 0.02; // 2% DNF rate

    // Split proportions (cumulative fraction of finish time)
    const splitFractions = [0, 0.22, 0.46, 0.71, 1.0];
    const jitter = () => 1 + (Math.random() - 0.5) * 0.06;

    const splits = [
      { split_name: 'START', time_seconds: 0 },
      { split_name: '5K', time_seconds: Math.round(finishSec * splitFractions[1] * jitter()) },
      { split_name: '10K', time_seconds: Math.round(finishSec * splitFractions[2] * jitter()) },
      { split_name: '15K', time_seconds: Math.round(finishSec * splitFractions[3] * jitter()) },
      { split_name: 'FINISH', time_seconds: isDNF ? -1 : finishSec },
    ];

    // Ensure splits are monotonically increasing
    for (let j = 1; j < splits.length - 1; j++) {
      if (splits[j].time_seconds <= splits[j - 1].time_seconds) {
        splits[j].time_seconds = splits[j - 1].time_seconds + 60;
      }
    }

    if (isDNF) {
      // Remove finish split for DNF
      splits.pop();
    }

    runners.push({
      id: `runner-${i}`,
      bib: String(1001 + i),
      name: `${surname}${given}`,
      splits,
      finish_time_seconds: isDNF ? null : finishSec,
    });
  }

  return runners;
}

export const mockRunners = generateMockRunners(9206);

// Get the total race duration (max finish time + buffer)
export function getMockTotalDuration(): number {
  const maxFinish = mockRunners.reduce((max, r) => {
    if (r.finish_time_seconds && r.finish_time_seconds > max) return r.finish_time_seconds;
    return max;
  }, 0);
  return maxFinish + 60; // 1 minute buffer
}
