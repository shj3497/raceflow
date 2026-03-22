import type { RaceSummary } from '@/lib/types';
import RaceCard from './RaceCard';

export default function RaceList({ races }: { races: RaceSummary[] }) {
  if (races.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        등록된 대회가 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
      {races.map((race) => (
        <RaceCard key={race.id} race={race} />
      ))}
    </div>
  );
}
