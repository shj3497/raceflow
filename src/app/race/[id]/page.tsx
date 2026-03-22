import { createServiceClient } from '@/lib/supabase';
import type { RaceDetail, ResultRow } from '@/lib/types';
import { prepareRunnerWaypoints, buildCumulativeDistances } from '@/lib/interpolate';
import ReplayClient from './ReplayClient';
import { notFound } from 'next/navigation';

async function getRaceDetail(id: string): Promise<RaceDetail | null> {
  const supabase = createServiceClient();

  const { data: race, error } = await supabase
    .from('races')
    .select('id, name, date, distance_km, course_gpx, split_points')
    .eq('id', id)
    .single();

  if (error || !race) return null;

  const { count } = await supabase
    .from('results')
    .select('*', { count: 'exact', head: true })
    .eq('race_id', id);

  return { ...race, participant_count: count ?? 0 };
}

async function getResults(raceId: string): Promise<ResultRow[]> {
  const supabase = createServiceClient();

  const allResults: ResultRow[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('results')
      .select('bib_number, name, gender, age_group, net_time, splits')
      .eq('race_id', raceId)
      .order('net_time', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;
    allResults.push(...(data as ResultRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allResults;
}

export default async function RacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [race, results] = await Promise.all([
    getRaceDetail(id),
    getResults(id),
  ]);

  if (!race) notFound();

  const course = race.course_gpx as unknown as import('@/lib/interpolate').LineString;
  const cumDist = buildCumulativeDistances(course);
  const totalCourseDist = cumDist[cumDist.length - 1];

  // Lightweight waypoint preparation (no frame computation)
  const { runners, maxTimeSec } = prepareRunnerWaypoints(
    results,
    race.split_points,
    totalCourseDist,
  );

  return (
    <ReplayClient
      race={race}
      runners={runners}
      maxTimeSec={maxTimeSec}
    />
  );
}
