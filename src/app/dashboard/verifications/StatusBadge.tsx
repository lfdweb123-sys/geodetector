const COLORS: Record<string, string> = {
  VERIFIED: 'bg-emerald-100 text-emerald-700',
  SUSPICIOUS: 'bg-amber-100 text-amber-700',
  UNVERIFIED: 'bg-red-100 text-red-700',
  ACCEPT: 'bg-emerald-100 text-emerald-700',
  REJECT: 'bg-red-100 text-red-700',
  MANUAL_REVIEW: 'bg-amber-100 text-amber-700',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${COLORS[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}
