'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { isNavItemActive } from './navActive';

export interface NavItem {
  href: string;
  label: string;
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
