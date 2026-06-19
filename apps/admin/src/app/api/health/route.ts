import { NextResponse } from 'next/server';
import { publicClient } from '@signflow/db';
import { startCronJobs } from '@/lib/cron';

startCronJobs();

export async function GET() {
  let db: 'ok' | 'error' = 'ok';
  try {
    await publicClient.$queryRaw`SELECT 1`;
  } catch {
    db = 'error';
  }
  return NextResponse.json({
    status: db === 'ok' ? 'ok' : 'degraded',
    version: process.env.npm_package_version ?? '0.1.0',
    db,
    uptime: Math.floor(process.uptime()),
  });
}
