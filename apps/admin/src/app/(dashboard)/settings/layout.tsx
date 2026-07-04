'use client';
import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// General / SMTP & Alerts / Transcoding are all served by the same /settings
// route, switched via ?tab=. Members is its own route. Keeping them in one tabs
// array renders them on a single nav line.
const tabs: { href: string; label: string; path: string; tab: string | null }[] = [
  { href: '/settings',                    label: 'General',       path: '/settings',         tab: null },
  { href: '/settings/members',            label: 'Members',       path: '/settings/members', tab: null },
  { href: '/settings?tab=smtp',           label: 'SMTP & Alerts', path: '/settings',         tab: 'smtp' },
  { href: '/settings?tab=transcoding',    label: 'Transcoding',   path: '/settings',         tab: 'transcoding' },
];

function SettingsTabs() {
  const pathname = usePathname();
  const currentTab = useSearchParams().get('tab');
  return (
    <div className="flex gap-1 border-b border-gray-800 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const active = pathname === t.path && (currentTab ?? null) === t.tab;
        return (
          <Link
            key={t.label}
            href={t.href as any}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Organisation-wide configuration</p>
      </div>
      <Suspense fallback={<div className="h-10 border-b border-gray-800" />}>
        <SettingsTabs />
      </Suspense>
      {children}
    </div>
  );
}
