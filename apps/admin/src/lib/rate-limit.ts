import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';

const redis = new Redis(process.env.REDIS_URL!);
redis.on('error', (err) => console.error('[rate-limit] Redis error:', err));

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ success: boolean; remaining: number }> {
  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const redisKey = `rl:${key}`;

  // Check current count without recording
  const checkPipeline = redis.pipeline();
  checkPipeline.zremrangebyscore(redisKey, '-inf', windowStart);
  checkPipeline.zcard(redisKey);
  const checkResults = await checkPipeline.exec();
  const count = (checkResults?.[1]?.[1] as number) ?? 0;

  if (count >= limit) {
    return { success: false, remaining: 0 };
  }

  // Only record the request when under the limit
  const recordPipeline = redis.pipeline();
  recordPipeline.zadd(redisKey, now, `${now}-${randomUUID()}`);
  recordPipeline.expire(redisKey, windowSec + 1);
  await recordPipeline.exec();

  return { success: true, remaining: Math.max(0, limit - count - 1) };
}
