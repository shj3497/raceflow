import { mockRaceDetail, mockRunners, getMockTotalDuration } from '@/lib/mock-data';
import ReplayClient from './ReplayClient';

export default async function RacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // TODO: Replace with actual API calls:
  // const race = await fetch(`/api/races/${id}`).then(r => r.json());
  // const runners = await fetch(`/api/races/${id}/results`).then(r => r.json());
  void id;
  const race = mockRaceDetail;
  const runners = mockRunners;
  const totalDuration = getMockTotalDuration();

  return <ReplayClient race={race} runners={runners} totalDuration={totalDuration} />;
}
