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

  try {
    const existing = await publicClient.organization.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'Organisation slug already taken' }, { status: 409 });
    }

    const emailExists = await publicClient.user.findUnique({ where: { email } });
    if (emailExists) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const org = await publicClient.organization.create({
      data: { name: orgName, slug, plan: 'FREE' },
    });

    await publicClient.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 12),
        role: 'ADMIN',
        orgId: org.id,
        emailVerified: new Date(),
      },
    });

    await provisionTenantSchema(slug, publicClient);

    return NextResponse.json({ ok: true, slug }, { status: 201 });
  } catch (err) {
    console.error('Registration error:', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
