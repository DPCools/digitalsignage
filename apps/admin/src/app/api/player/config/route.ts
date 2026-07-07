import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { PlayerConfig } from '@signflow/types';
import { verifyAndSyncPlayerToken, generateStreamToken, isSafeOrgSlug, isSafeId } from '@/lib/player-auth';
import { parseCellConfig } from '@/lib/layout';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const screenId = req.nextUrl.searchParams.get('screenId');
  const orgSlug = req.nextUrl.searchParams.get('orgSlug');
  if (!screenId || !orgSlug) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }
  if (!isSafeOrgSlug(orgSlug) || !isSafeId(screenId)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const db = getTenantClient(orgSlug);
  if (!(await verifyAndSyncPlayerToken(db, screenId, orgSlug, req.headers.get('authorization')))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [screen, playlists, schedules, activeAlert] = await Promise.all([
    db.screen.findUnique({
      where: { id: screenId },
      include: { group: { select: { id: true, defaultPlaylistId: true } } },
    }),
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
    groupId: screen?.groupId ?? null,
    groupDefaultPlaylistId: screen?.group?.defaultPlaylistId ?? null,
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      layoutPreset: p.layoutPreset,
      cellModes: parseCellConfig(p.cellConfig),
      items: p.items
        .filter((item) => !item.contentItem.expiresAt || item.contentItem.expiresAt > new Date())
        .map((item) => ({
        id: item.id,
        contentItemId: item.contentItemId,
        type: item.contentItem.type as PlayerConfig['playlists'][0]['items'][0]['type'],
        url: item.contentItem.url,
        duration: item.duration,
        transition: item.transition as PlayerConfig['playlists'][0]['items'][0]['transition'],
        zone: item.zone,
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
          severity: activeAlert.severity as 'EMERGENCY' | 'WARNING' | 'INFO',
          expiresAt: activeAlert.expiresAt?.toISOString(),
          soundUrl: activeAlert.soundUrl ?? undefined,
          soundRepeat: activeAlert.soundRepeat,
        }
      : null,
    timezone: 'UTC',
    locale: 'en',
    playerStreamToken: generateStreamToken(screenId, orgSlug),
  };

  return NextResponse.json(config);
}
