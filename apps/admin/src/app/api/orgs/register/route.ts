import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { publicClient, provisionTenantSchema } from '@signflow/db';

const schema = z.object({
  orgName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { orgName, email, password, name } = parsed.data;
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  // Hash outside the transaction to avoid holding it open during CPU work
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await publicClient.$transaction(async (tx) => {
      const existing = await tx.organization.findUnique({ where: { slug } });
      if (existing) throw Object.assign(new Error('SLUG_TAKEN'), { status: 409 });

      const emailExists = await tx.user.findUnique({ where: { email } });
      if (emailExists) throw Object.assign(new Error('EMAIL_TAKEN'), { status: 409 });

      const org = await tx.organization.create({
        data: { name: orgName, slug, plan: 'FREE' },
      });

      await tx.user.create({
        data: { email, name, passwordHash, role: 'ADMIN', orgId: org.id, emailVerified: new Date() },
      });
    });

    await provisionTenantSchema(slug, publicClient);

    return NextResponse.json({ ok: true, slug }, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'SLUG_TAKEN') return NextResponse.json({ error: 'Organisation slug already taken' }, { status: 409 });
      if (err.message === 'EMAIL_TAKEN') return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }
    console.error('Registration error:', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
