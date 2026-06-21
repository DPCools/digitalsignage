import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { publicClient } from '@signflow/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await publicClient.invite.findUnique({
    where: { token },
    include: { org: { select: { name: true } } },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
  }

  return NextResponse.json({
    email: invite.email,
    name: invite.name ?? '',
    role: invite.role,
    orgName: invite.org.name,
  });
}

const acceptSchema = z.object({
  name: z.string().min(1).max(100),
  password: z.string().min(8),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const body = await req.json();
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Name and password (min 8 chars) are required' }, { status: 400 });
  }

  const invite = await publicClient.invite.findUnique({ where: { token } });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
  }

  const existing = await publicClient.user.findUnique({ where: { email: invite.email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await publicClient.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        email: invite.email,
        name: parsed.data.name,
        passwordHash,
        role: invite.role,
        orgId: invite.orgId,
        emailVerified: new Date(),
      },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
