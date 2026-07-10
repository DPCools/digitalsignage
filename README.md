# SignFlow

Open-source digital signage platform. Multi-tenant, real-time, offline-capable.

## Architecture

| Layer | Tech |
|-------|------|
| Admin app | Next.js 15, tRPC v11, NextAuth.js v5 |
| Player app | Next.js 15, IndexedDB, Socket.io client |
| Database | PostgreSQL + per-tenant Prisma schemas |
| Media | MinIO (S3-compatible) |
| Real-time | Socket.io 4 + Redis adapter |
| Cache / Rate-limit | Redis (ioredis) |

## Quick start (Docker)

```sh
cp .env.example .env
# Edit .env — set NEXTAUTH_SECRET and other secrets
docker compose -f infra/docker-compose.yml up -d --build
```

Admin: http://localhost  
Player: http://player.localhost/pair (most browsers resolve `*.localhost` to
127.0.0.1 automatically; see below for why player needs its own host)

`NEXT_PUBLIC_*` vars (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) are
inlined into the client bundle at *build* time, not read at container runtime — they must be set in `.env`
before running `up --build`, and any later change to them requires a rebuild (`up -d --build`) to take effect,
not just a restart.

Player is served on a `player.` subdomain, not a path under the main domain. Admin and player are two
separate Next.js apps that each generate `/_next/static/...` asset URLs at their own root — sharing one
origin means whichever app isn't matched by nginx's catch-all 404s on its own JS/CSS the moment you load
it. In production, add a DNS record and reverse-proxy entry for `player.<your-domain>` pointing at the
same server; `infra/nginx/nginx.conf` already routes any `player.*` hostname to the player app.

## Development

```sh
pnpm install
pnpm dev          # starts admin (port 3000) + player (port 3001)
pnpm test         # runs all Vitest suites
```

## Environment variables

See `.env.example` for the full list. Required:
- `DATABASE_URL` / `TENANT_DATABASE_URL` — PostgreSQL connection strings
- `NEXTAUTH_SECRET` — random 32+ char string
- `REDIS_URL` — Redis connection string
- `MINIO_*` — MinIO connection details
- `PLAYER_TOKEN_SECRET` — HMAC secret for player auth
