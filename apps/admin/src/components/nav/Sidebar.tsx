'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Monitor, Image, ListVideo, Calendar, AlertTriangle,
  BarChart2, LogOut,
} from 'lucide-react';
import { signOut } from 'next-auth/react';

const nav = [
  { href: '/dashboard', label: 'Overview', icon: BarChart2 },
  { href: '/dashboard/screens', label: 'Screens', icon: Monitor },
  { href: '/dashboard/content', label: 'Content', icon: Image },
  { href: '/dashboard/playlists', label: 'Playlists', icon: ListVideo },
  { href: '/dashboard/schedules', label: 'Schedules', icon: Calendar },
  { href: '/dashboard/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-800 bg-gray-900 px-3 py-4">
      <div className="mb-8 px-2 text-xl font-bold text-white">SignFlow</div>
      <nav className="flex-1 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname === href
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}
