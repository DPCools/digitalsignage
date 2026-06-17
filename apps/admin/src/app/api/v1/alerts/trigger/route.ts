import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getTenantClient } from '@signflow/db';
import type { EmergencyAlertConfig } from '@signflow/types';
import { isSafeOrgSlug } from '@/lib/player-auth';
import { rateLimit } from '@/lib/rate-limit';
import { emitToOrg, emitToScreen } from '@/server/socket';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  // Prevent the ?apiKey= query param from leaking via Referer on any redirects
  'Referrer-Policy': 'no-referrer',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Parse body (Axis units may send empty body)
  let body: { orgSlug?: string; templateId?: string } = {};
  try {
    const text = await req.text();
    if (text.trim()) {
      body = JSON.parse(text) as typeof body;
    }
  } catch {
    // ignore parse errors — treat as empty body
  }

  // Query params take precedence over body
  const orgSlug = searchParams.get('orgSlug') ?? body.orgSlug ?? '';
  const templateId = searchParams.get('templateId') ?? body.templateId ?? '';

  if (!orgSlug || !templateId) {
    return NextResponse.json({ error: 'Missing orgSlug or templateId' }, { status: 400, headers: CORS });
  }

  if (!isSafeOrgSlug(orgSlug)) {
    return NextResponse.json({ error: 'Invalid orgSlug' }, { status: 400, headers: CORS });
  }

  // Extract API key: Authorization header first, then query param
  const authHeader = req.headers.get('authorization');
  let rawKey: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    rawKey = authHeader.slice(7).trim();
  }
  if (!rawKey) {
    rawKey = searchParams.get('apiKey');
  }
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401, headers: CORS });
  }

  const db = getTenantClient(orgSlug);

  // Authenticate first — rate limit is keyed on the verified key id, not orgSlug,
  // so unauthenticated requests cannot exhaust a legitimate caller's quota.
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const apiKey = await db.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null,
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
  });
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  // Rate limit per verified key (not per org) to prevent key holders from starving each other
  const { success } = await rateLimit(`v1:alerts:trigger:${apiKey.id}`, 10, 60);
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS });
  }

  // Fetch template
  const template = await db.alertTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404, headers: CORS });
  }

  // Resolve target screen IDs
  let screenIds: string[] = [];
  if (template.targetType === 'ALL') {
    screenIds = [];
  } else if (template.targetType === 'GROUPS') {
    const screens = await db.screen.findMany({
      where: { groupId: { in: template.targetGroupIds } },
      select: { id: true },
    });
    screenIds = screens.map((s) => s.id);
  } else if (template.targetType === 'SCREENS') {
    screenIds = template.targetScreenIds;
  }

  // Emit alert:clear to existing active alerts' screens
  const existingActive = await db.emergencyAlert.findMany({ where: { isActive: true } });
  for (const existing of existingActive) {
    if (existing.screenIds.length === 0) {
      emitToOrg(orgSlug, 'alert:clear');
    } else {
      existing.screenIds.forEach((id) => emitToScreen(orgSlug, id, 'alert:clear'));
    }
  }

  // Deactivate existing alerts and create the new one atomically
  const alert = await db.$transaction(async (tx) => {
    await tx.emergencyAlert.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.emergencyAlert.create({
      data: {
        title: template.title,
        message: template.message,
        backgroundColor: template.backgroundColor,
        textColor: template.textColor,
        templateId: template.id,
        screenIds,
        isActive: true,
        expiresAt: template.autoExpireMinutes
          ? new Date(Date.now() + template.autoExpireMinutes * 60_000)
          : undefined,
        createdBy: apiKey.id,
      },
    });
  });

  // Emit socket event
  const payload: EmergencyAlertConfig = {
    id: alert.id,
    title: alert.title,
    message: alert.message,
    backgroundColor: alert.backgroundColor,
    textColor: alert.textColor,
    screenIds: alert.screenIds,
    isActive: true,
    expiresAt: alert.expiresAt?.toISOString(),
  };

  if (screenIds.length === 0) {
    emitToOrg(orgSlug, 'alert:emergency', payload);
  } else {
    alert.screenIds.forEach((id) => emitToScreen(orgSlug, id, 'alert:emergency', payload));
  }

  // Update lastUsedAt
  await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  return NextResponse.json({ ok: true, alertId: alert.id }, { headers: CORS });
}
