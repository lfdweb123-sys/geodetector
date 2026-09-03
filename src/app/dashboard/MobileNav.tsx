'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { LayoutDashboard, ShieldCheck, FolderKanban, KeyRound, Menu, X } from 'lucide-react';
import { isNavItemActive } from './navActive';
import type { NavItem } from './SidebarNav';
import { SignOutButton } from './SignOutButton';

const BOTTOM_ITEMS = [
  { href: '/dashboard', label: 'Accueil', icon: LayoutDashboard },
  { href: '/dashboard/verifications', label: 'Vérifs', icon: ShieldCheck },
  { href: '/dashboard/projects', label: 'Projets', icon: FolderKanban },
  { href: '/dashboard/api-keys', label: 'Clés API', icon: KeyRound },
];

export function MobileNav({ items, userEmail }: { items: NavItem[]; userEmail: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer automatically on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navigation principale"
      >
        {BOTTOM_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                active ? 'text-brand-600' : 'text-slate-500',
              )}
            >
              <item.icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"
        >
          <Menu size={20} strokeWidth={1.75} />
          Plus
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-bold text-brand-700">GeoLock</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-1">
              {items.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'block rounded-lg px-3 py-2 text-sm font-medium',
                      active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="truncate px-3 text-xs text-slate-400">{userEmail}</p>
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
