import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);
redis.on('error', (err) => console.error('[rate-limit] Redis error:', err));

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local expire_sec = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
local count = redis.call('ZCARD', key)
if count >= limit then
  return 0
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, expire_sec)
return 1
`;

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ success: boolean; remaining: number }> {
  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const member = `${now}-${Math.random().toString(36).slice(2)}`;
  const redisKey = `rl:${key}`;

  const result = await redis.eval(
    SLIDING_WINDOW_LUA,
    1,
    redisKey,
    String(now),
    String(windowStart),
    String(limit),
    member,
    String(windowSec + 1)
  ) as number;

  return { success: result === 1, remaining: result === 1 ? limit - 1 : 0 };
}
