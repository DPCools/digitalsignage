import Link from 'next/link';
import { Monitor } from 'lucide-react';

interface Props {
  screen: {
    id: string;
    name: string;
    isOnline: boolean;
    lastHeartbeat: Date | null;
    lastSnapshot: string | null;
    group: { name: string } | null;
    orientation: string;
  };
}

export function ScreenCard({ screen }: Props) {
  function formatLastSeen(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (diffSec < 30) return 'just now';
    if (diffSec < 3600) return rtf.format(-Math.round(diffSec / 60), 'minute');
    return rtf.format(-Math.round(diffSec / 3600), 'hour');
  }
  const lastSeen = screen.lastHeartbeat ? formatLastSeen(screen.lastHeartbeat) : 'Never';

  return (
    <Link
      href={`/dashboard/screens/${screen.id}`}
      className="group rounded-xl border border-gray-800 bg-gray-900 overflow-hidden hover:border-gray-600 transition-colors"
    >
      <div className="aspect-video bg-gray-800 relative overflow-hidden">
        {screen.lastSnapshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={screen.lastSnapshot} alt="Screen snapshot" className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Monitor className="h-12 w-12 text-gray-600" />
          </div>
        )}
        <span
          className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full ${
            screen.isOnline ? 'bg-green-500' : 'bg-gray-600'
          }`}
        />
      </div>
      <div className="p-3">
        <p className="font-medium text-sm text-white truncate">{screen.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {screen.group?.name ?? 'No group'} · {lastSeen}
        </p>
      </div>
    </Link>
  );
}
