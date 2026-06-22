'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Monitor, Image, ListVideo, Calendar, AlertTriangle,
  BarChart2, LayoutDashboard, LogOut, Layers, Settings, FileCode,
} from 'lucide-react';
import { signOut } from 'next-auth/react';

const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/screens', label: 'Screens', icon: Monitor },
  { href: '/groups', label: 'Groups', icon: Layers },
  { href: '/content', label: 'Content', icon: Image },
  { href: '/content/templates', label: 'Templates', icon: FileCode, indent: true },
  { href: '/playlists', label: 'Playlists', icon: ListVideo },
  { href: '/schedules', label: 'Schedules', icon: Calendar },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function isActive(href: string, pathname: string, indent?: boolean): boolean {
  if (pathname === href) return true;
  if (href === '/') return false;
  // For the /content parent, only match if the sub-path is NOT /content/templates
  if (href === '/content') {
    return pathname.startsWith('/content/') && !pathname.startsWith('/content/templates');
  }
  return pathname.startsWith(href + '/');
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-800 bg-gray-900 px-3 py-4">
      <div className="mb-8 px-2 text-xl font-bold text-white">SignFlow</div>
      <nav className="flex-1 space-y-1">
        {nav.map(({ href, label, icon: Icon, indent }) => (
          <Link
            key={href}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={href as any}
            className={`flex items-center gap-3 rounded-lg py-2 text-sm transition-colors ${
              indent ? 'pl-8 pr-3' : 'px-3'
            } ${
              isActive(href, pathname, indent)
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
