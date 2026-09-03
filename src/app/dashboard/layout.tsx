import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { SignOutButton } from './SignOutButton';
import { SidebarNav } from './SidebarNav';
import { MobileNav } from './MobileNav';
import { ToastProvider } from './ToastProvider';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/verifications', label: 'Verifications' },
  { href: '/dashboard/projects', label: 'Projects' },
  { href: '/dashboard/api-keys', label: 'API Keys' },
  { href: '/dashboard/sdk', label: 'SDK & Tests' },
  { href: '/dashboard/usage', label: 'Usage' },
  { href: '/dashboard/logs', label: 'Logs' },
  { href: '/dashboard/billing', label: 'Billing' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 md:flex">
          <div className="mb-8 px-2 text-lg font-bold text-brand-700">GeoLock</div>
          <SidebarNav items={NAV} />
          <div className="border-t border-slate-200 pt-4">
            <p className="truncate px-2 text-xs text-slate-400">{user.email}</p>
            <SignOutButton />
          </div>
        </aside>
        <main className="h-screen flex-1 overflow-y-auto bg-slate-50 p-4 pb-24 sm:p-6 sm:pb-24 md:p-8 md:pb-8">
          {children}
        </main>
        <MobileNav items={NAV} userEmail={user.email} />
      </div>
    </ToastProvider>
  );
}
