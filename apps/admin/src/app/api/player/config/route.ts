import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { PlayerConfig } from '@signflow/types';
import { verifyPlayerToken } from '@/lib/player-auth';

export async function GET(req: NextRequest) {
  const screenId = req.nextUrl.searchParams.get('screenId');
  const orgSlug = req.nextUrl.searchParams.get('orgSlug');
  if (!screenId || !orgSlug) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }
  if (!verifyPlayerToken(screenId, orgSlug, req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getTenantClient(orgSlug);

  const [playlists, schedules, activeAlert] = await Promise.all([
    db.playlist.findMany({
      include: {
        items: { include: { contentItem: true }, orderBy: { position: 'asc' } },
      },
    }),
    db.schedule.findMany({ where: { isActive: true } }),
    db.emergencyAlert.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const config: PlayerConfig = {
    screenId,
    orgSlug,
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      items: p.items.map((item) => ({
        id: item.id,
        contentItemId: item.contentItemId,
        type: item.contentItem.type as PlayerConfig['playlists'][0]['items'][0]['type'],
        url: item.contentItem.url,
        duration: item.duration,
        transition: item.transition as PlayerConfig['playlists'][0]['items'][0]['transition'],
        zone: item.zone as 'main' | 'ticker' | 'clock' | 'weather',
        metadata: item.contentItem.metadata as Record<string, unknown> | undefined,
      })),
    })),
    schedules: schedules.map((s) => ({
      id: s.id,
      playlistId: s.playlistId,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate?.toISOString(),
      startTime: s.startTime ?? undefined,
      endTime: s.endTime ?? undefined,
      recurrence: s.recurrence as PlayerConfig['schedules'][0]['recurrence'],
      daysOfWeek: s.daysOfWeek,
      screenIds: s.screenIds,
      groupIds: s.groupIds,
      priority: s.priority,
      isActive: s.isActive,
    })),
    activeAlert: activeAlert
      ? {
          id: activeAlert.id,
          title: activeAlert.title,
          message: activeAlert.message,
          backgroundColor: activeAlert.backgroundColor,
          textColor: activeAlert.textColor,
          screenIds: activeAlert.screenIds,
          isActive: activeAlert.isActive,
          expiresAt: activeAlert.expiresAt?.toISOString(),
        }
      : null,
    timezone: 'UTC',
    locale: 'en',
  };

  return NextResponse.json(config);
}
