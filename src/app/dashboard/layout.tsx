import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { SignOutButton } from './SignOutButton';
import { SidebarNav } from './SidebarNav';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/verifications', label: 'Verifications' },
  { href: '/dashboard/projects', label: 'Projects' },
  { href: '/dashboard/api-keys', label: 'API Keys' },
  { href: '/dashboard/sdk', label: 'SDK' },
  { href: '/dashboard/usage', label: 'Usage' },
  { href: '/dashboard/logs', label: 'Logs' },
  { href: '/dashboard/billing', label: 'Billing' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6">
        <div className="mb-8 px-2 text-lg font-bold text-brand-700">GeoLock</div>
        <SidebarNav items={NAV} />
        <div className="border-t border-slate-200 pt-4">
          <p className="truncate px-2 text-xs text-slate-400">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-50 p-8">{children}</main>
    </div>
  );
}
