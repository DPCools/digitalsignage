import { Redis } from 'ioredis';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL!);
    client.on('error', (err) => console.error('[redis] error:', err.message));
  }
  return client;
}
