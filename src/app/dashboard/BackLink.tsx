import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function BackLink({ href, label = 'Retour' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
    >
      <ArrowLeft size={16} />
      {label}
    </Link>
  );
}
