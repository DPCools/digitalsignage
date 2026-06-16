import { Redis } from 'ioredis';

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

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, '-inf', windowStart);
  pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
  pipeline.zcard(redisKey);
  pipeline.expire(redisKey, windowSec + 1);
  const results = await pipeline.exec();

  const count = (results?.[2]?.[1] as number) ?? 0;
  return { success: count <= limit, remaining: Math.max(0, limit - count) };
}
