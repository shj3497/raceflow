'use client';

import { formatTime, formatNumber } from '@/lib/utils';
import type { RaceStats } from '@/lib/animation';

export default function StatsPanel({ stats }: { stats: RaceStats }) {
  return (
    <div className="absolute left-4 bottom-24 z-30 w-[220px] bg-gray-900/85 backdrop-blur-lg rounded-xl border border-white/[0.06] p-4">
      {/* Elapsed time */}
      <div className="mb-3">
        <p className="text-xs text-gray-400 mb-1">경과 시간</p>
        <p className="text-3xl font-bold font-mono text-white">
          {formatTime(stats.elapsedTime)}
        </p>
      </div>

      <div className="border-t border-white/10 my-3" />

      {/* Participant distribution */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-amber-400">코스 위</span>
          <span className="font-semibold font-mono text-amber-400">{formatNumber(stats.onCourse)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-emerald-400">완주</span>
          <span className="font-semibold font-mono text-emerald-400">{formatNumber(stats.finished)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">출발 전</span>
          <span className="font-semibold font-mono text-gray-500">{formatNumber(stats.notStarted)}</span>
        </div>
      </div>
    </div>
  );
}
