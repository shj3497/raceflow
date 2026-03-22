import Link from 'next/link';
import type { RaceSummary } from '@/lib/types';
import { formatNumber, getDistanceLabel } from '@/lib/utils';

export default function RaceCard({ race }: { race: RaceSummary }) {
  const dist = getDistanceLabel(race.distance_km);
  const dateStr = race.date.replace(/-/g, '.');

  return (
    <Link
      href={`/race/${race.id}`}
      className="group block bg-white border border-gray-200 rounded-xl p-6 min-h-[200px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <span
        className="inline-block text-xs font-semibold uppercase px-2.5 py-1 rounded-full mb-4"
        style={{ color: dist.color, backgroundColor: dist.bg }}
      >
        {dist.label}
      </span>

      <h3 className="text-lg md:text-xl font-bold text-gray-900 leading-tight line-clamp-2 mb-4">
        {race.name}
      </h3>

      <div className="space-y-1 text-sm text-gray-500">
        <p>{dateStr}</p>
        <p>{formatNumber(race.participant_count)}명</p>
      </div>

      <p className="mt-4 text-sm text-gray-400 group-hover:text-blue-500 transition-colors duration-200">
        리플레이 보기 &rarr;
      </p>
    </Link>
  );
}
