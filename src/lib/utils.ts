export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

export function getDistanceLabel(km: number): { label: string; color: string; bg: string } {
  if (km <= 5) return { label: '5K', color: '#10B981', bg: 'rgba(16,185,129,0.1)' };
  if (km <= 10) return { label: '10K', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' };
  if (km <= 25) return { label: 'HALF MARATHON', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' };
  return { label: 'FULL MARATHON', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' };
}
