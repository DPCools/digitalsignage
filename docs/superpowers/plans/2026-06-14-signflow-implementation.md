# SignFlow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready multi-tenant digital signage platform with a kiosk player, admin dashboard, real-time monitoring, and offline-first operation.

**Architecture:** Turborepo monorepo with two Next.js 15 apps (admin + player) sharing packages for DB, UI, and types. PostgreSQL with per-tenant schemas; Socket.io + Redis for real-time commands; Workbox service worker for offline player operation. Two separate Prisma schemas (public + tenant) with dynamically-scoped PrismaClient per tenant.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, shadcn/ui, tRPC v11, Prisma 5, NextAuth.js v5, Socket.io 4, Redis 7, MinIO, Workbox 7, idb 8, @dnd-kit/sortable, node-cron, pino, isomorphic-dompurify, next-intl, Docker Compose.

---

## File Map

```
signflow/
├── apps/
│   ├── admin/
│   │   ├── Dockerfile
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── (auth)/login/page.tsx
│   │   │   │   ├── (auth)/register/page.tsx
│   │   │   │   ├── (dashboard)/layout.tsx
│   │   │   │   ├── (dashboard)/page.tsx
│   │   │   │   ├── (dashboard)/screens/page.tsx
│   │   │   │   ├── (dashboard)/screens/[screenId]/page.tsx
│   │   │   │   ├── (dashboard)/screens/groups/page.tsx
│   │   │   │   ├── (dashboard)/content/page.tsx
│   │   │   │   ├── (dashboard)/content/upload/page.tsx
│   │   │   │   ├── (dashboard)/content/templates/page.tsx
│   │   │   │   ├── (dashboard)/content/templates/[id]/editor/page.tsx
│   │   │   │   ├── (dashboard)/playlists/page.tsx
│   │   │   │   ├── (dashboard)/playlists/[id]/page.tsx
│   │   │   │   ├── (dashboard)/schedules/page.tsx
│   │   │   │   ├── (dashboard)/alerts/page.tsx
│   │   │   │   ├── (dashboard)/analytics/page.tsx
│   │   │   │   └── api/
│   │   │   │       ├── auth/[...nextauth]/route.ts
│   │   │   │       ├── trpc/[trpc]/route.ts
│   │   │   │       ├── health/route.ts
│   │   │   │       └── player/
│   │   │   │           ├── pair/route.ts
│   │   │   │           ├── heartbeat/route.ts
│   │   │   │           ├── config/route.ts
│   │   │   │           ├── impressions/route.ts
│   │   │   │           ├── snapshot/route.ts
│   │   │   │           └── error/route.ts
│   │   │   ├── server/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── socket.ts
│   │   │   │   └── trpc/
│   │   │   │       ├── init.ts
│   │   │   │       ├── root.ts
│   │   │   │       └── routers/
│   │   │   │           ├── orgs.ts
│   │   │   │           ├── screens.ts
│   │   │   │           ├── screen-groups.ts
│   │   │   │           ├── content.ts
│   │   │   │           ├── templates.ts
│   │   │   │           ├── playlists.ts
│   │   │   │           ├── schedules.ts
│   │   │   │           ├── alerts.ts
│   │   │   │           └── analytics.ts
│   │   │   ├── lib/
│   │   │   │   ├── minio.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   ├── sanitize.ts
│   │   │   │   ├── cron.ts
│   │   │   │   └── trpc-client.ts
│   │   │   └── components/
│   │   │       ├── nav/Sidebar.tsx
│   │   │       ├── screens/ScreenGrid.tsx
│   │   │       ├── screens/ScreenCard.tsx
│   │   │       ├── screens/RegisterScreenModal.tsx
│   │   │       ├── content/ContentLibrary.tsx
│   │   │       ├── content/ContentCard.tsx
│   │   │       ├── content/UploadZone.tsx
│   │   │       ├── playlists/PlaylistBuilder.tsx
│   │   │       ├── playlists/PlaylistItemCard.tsx
│   │   │       ├── schedules/ScheduleCalendar.tsx
│   │   │       └── alerts/AlertForm.tsx
│   └── player/
│       ├── Dockerfile
│       ├── next.config.ts
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── pair/page.tsx
│       │   │   ├── play/[screenId]/page.tsx
│       │   │   └── api/health/route.ts
│       │   ├── components/
│       │   │   ├── PlayerRoot.tsx
│       │   │   ├── ScreenLayout.tsx
│       │   │   ├── ZoneRenderer.tsx
│       │   │   ├── ZoneErrorBoundary.tsx
│       │   │   ├── ContentPlayer.tsx
│       │   │   ├── TransitionWrapper.tsx
│       │   │   ├── EmergencyOverlay.tsx
│       │   │   ├── DebugOverlay.tsx
│       │   │   └── widgets/
│       │   │       ├── ClockWidget.tsx
│       │   │       ├── WeatherWidget.tsx
│       │   │       └── TickerWidget.tsx
│       │   ├── engine/
│       │   │   ├── scheduler.ts
│       │   │   └── PlaylistEngine.ts
│       │   └── lib/
│       │       ├── db.ts
│       │       ├── api.ts
│       │       ├── socket.ts
│       │       └── cache.ts
├── packages/
│   ├── db/
│   │   ├── prisma/
│   │   │   ├── public.prisma
│   │   │   ├── tenant.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── public-client.ts
│   │       ├── tenant-client.ts
│   │       └── provision-tenant.ts
│   ├── ui/
│   │   └── src/index.ts
│   └── types/
│       └── src/
│           ├── index.ts
│           ├── player.ts
│           ├── socket.ts
│           └── api.ts
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/nginx.conf
│   └── minio/init-buckets.sh
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .env.example
```

---

## Phase 1: Foundation

### Task 1: Initialise Turborepo monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialise git and pnpm workspace**

```bash
cd /var/www/html/sinage
git init
corepack enable
pnpm init
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Write root `package.json`**

```json
{
  "name": "signflow",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "db:generate": "turbo db:generate --filter=@signflow/db",
    "db:migrate:public": "turbo db:migrate:public --filter=@signflow/db",
    "db:seed": "turbo db:seed --filter=@signflow/db"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "prettier": "^3.4.0"
  },
  "engines": { "node": ">=20", "pnpm": ">=9" }
}
```

- [ ] **Step 4: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "db:generate": { "cache": false },
    "db:migrate:public": { "cache": false },
    "db:seed": { "cache": false },
    "lint": {}
  }
}
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
.next/
dist/
generated/
.env
.env.local
*.log
.turbo/
```

- [ ] **Step 6: Write `.env.example`**

```bash
# Database
DATABASE_URL=postgresql://signflow:secret@localhost:5432/signflow

# Auth
NEXTAUTH_SECRET=change-me-minimum-32-characters-long
NEXTAUTH_URL=http://localhost:3000

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=signflow
MINIO_SECRET_KEY=signflow-secret
MINIO_BUCKET=signflow-assets
MINIO_PUBLIC_URL=http://localhost:9000

# Redis
REDIS_URL=redis://localhost:6379

# Socket.io
SOCKET_SECRET=change-me-socket-secret

# Player
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# External
OPENWEATHERMAP_API_KEY=your-key-here

# Features
CONTENT_APPROVAL_REQUIRED=false
```

- [ ] **Step 7: Install root devDependencies**

```bash
pnpm install
```

Expected: `node_modules/` created at root, `pnpm-lock.yaml` written.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: initialise Turborepo monorepo with pnpm workspaces"
```

---

### Task 2: packages/types — shared type definitions

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/player.ts`
- Create: `packages/types/src/socket.ts`
- Create: `packages/types/src/api.ts`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: Scaffold the package**

```bash
mkdir -p packages/types/src
```

`packages/types/package.json`:
```json
{
  "name": "@signflow/types",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`packages/types/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write `packages/types/src/player.ts`**

```typescript
export type Zone = 'main' | 'ticker' | 'clock' | 'weather';

export type ContentType = 'IMAGE' | 'VIDEO' | 'HTML_TEMPLATE' | 'RSS_FEED' | 'PDF';
export type TransitionType = 'FADE' | 'SLIDE_LEFT' | 'SLIDE_RIGHT' | 'ZOOM' | 'NONE';
export type RecurrenceType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface PlaylistItemConfig {
  id: string;
  contentItemId: string;
  type: ContentType;
  url: string;
  duration: number;       // seconds
  transition: TransitionType;
  zone: Zone;
  metadata?: Record<string, unknown>;
}

export interface PlaylistConfig {
  id: string;
  name: string;
  isDefault: boolean;
  items: PlaylistItemConfig[];
}

export interface ScheduleConfig {
  id: string;
  playlistId: string;
  startDate: string;      // ISO date string
  endDate?: string;
  startTime?: string;     // "HH:MM"
  endTime?: string;       // "HH:MM"
  recurrence: RecurrenceType;
  daysOfWeek: number[];   // 0 = Sunday, 6 = Saturday
  screenIds: string[];
  groupIds: string[];
  priority: number;
  isActive: boolean;
}

export interface EmergencyAlertConfig {
  id: string;
  title: string;
  message: string;
  backgroundColor: string;
  textColor: string;
  screenIds: string[];    // empty = all screens
  isActive: boolean;
  expiresAt?: string;
}

export interface PlayerConfig {
  screenId: string;
  orgSlug: string;
  playlists: PlaylistConfig[];
  schedules: ScheduleConfig[];
  activeAlert: EmergencyAlertConfig | null;
  weatherApiKey?: string;
  weatherLocation?: string;
  timezone: string;
  locale: string;
}

export interface ResolvedZoneQueue {
  zone: Zone;
  items: PlaylistItemConfig[];
  currentIndex: number;
}
```

- [ ] **Step 3: Write `packages/types/src/socket.ts`**

```typescript
import type { EmergencyAlertConfig, PlayerConfig } from './player';

export interface ServerToClientEvents {
  'playlist:update': (config: PlayerConfig) => void;
  'alert:emergency': (alert: EmergencyAlertConfig) => void;
  'alert:clear': () => void;
  'screen:reload': () => void;
  'screen:screenshot': () => void;
  'config:update': (patch: Partial<PlayerConfig>) => void;
}

export interface ClientToServerEvents {
  'screen:join': (data: { screenId: string; orgSlug: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}
```

- [ ] **Step 4: Write `packages/types/src/api.ts`**

```typescript
export interface HeartbeatRequest {
  screenId: string;
  orgSlug: string;
  playlistId?: string;
  contentId?: string;
}

export interface HeartbeatResponse {
  ok: boolean;
}

export interface PairRequest {
  code: string;
}

export interface PairResponse {
  screenId: string;
  token: string;
  orgSlug: string;
}

export interface ImpressionRecord {
  contentItemId: string;
  screenId: string;
  playedAt: string;     // ISO string
  durationMs: number;
}

export interface ImpressionsRequest {
  orgSlug: string;
  screenId: string;
  impressions: ImpressionRecord[];
}

export interface SnapshotRequest {
  orgSlug: string;
  screenId: string;
  imageBase64: string;  // PNG, base64 encoded
}

export interface PlayerErrorRequest {
  orgSlug: string;
  screenId: string;
  zone: string;
  message: string;
  stack?: string;
}
```

- [ ] **Step 5: Write `packages/types/src/index.ts`**

```typescript
export * from './player';
export * from './socket';
export * from './api';
```

- [ ] **Step 6: Commit**

```bash
git add packages/types
git commit -m "feat(types): add shared PlayerConfig, socket event, and API types"
```

---

### Task 3: packages/db — public Prisma schema

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/public.prisma`

- [ ] **Step 1: Scaffold the db package**

```bash
mkdir -p packages/db/prisma packages/db/src
```

`packages/db/package.json`:
```json
{
  "name": "@signflow/db",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "db:generate": "prisma generate --schema ./prisma/public.prisma && prisma generate --schema ./prisma/tenant.prisma",
    "db:migrate:public": "prisma migrate deploy --schema ./prisma/public.prisma",
    "db:migrate:public:dev": "prisma migrate dev --schema ./prisma/public.prisma",
    "db:seed": "tsx ./prisma/seed.ts"
  },
  "exports": { ".": "./src/index.ts" },
  "main": "./src/index.ts",
  "devDependencies": {
    "prisma": "^5.22.0",
    "tsx": "^4.19.0"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0"
  }
}
```

`packages/db/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src", "prisma"]
}
```

- [ ] **Step 2: Write `packages/db/prisma/public.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/public"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  plan      Plan     @default(FREE)
  users     User[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  id            String       @id @default(cuid())
  email         String       @unique
  name          String?
  passwordHash  String?
  role          Role         @default(VIEWER)
  orgId         String
  org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  emailVerified DateTime?
  preferences   Json?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

// Pairing codes: generated by player, claimed by admin during screen registration
model PairingCode {
  id        String   @id @default(cuid())
  code      String   @unique
  orgSlug   String?  // null until claimed
  screenId  String?  // null until screen registered
  expiresAt DateTime
  createdAt DateTime @default(now())
}

enum Role {
  SUPER_ADMIN
  ADMIN
  CONTENT_MANAGER
  VIEWER
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}
```

- [ ] **Step 3: Install db dependencies**

```bash
cd packages/db && pnpm install
```

- [ ] **Step 4: Run first public migration**

```bash
cd packages/db
pnpm db:migrate:public:dev --name init-public
```

Expected: `packages/db/prisma/migrations/` created, `public.prisma` applied to PostgreSQL `public` schema.

(Requires a running PostgreSQL instance — see Task 41 for Docker Compose setup. For local dev, start postgres via `docker run -e POSTGRES_PASSWORD=secret -e POSTGRES_USER=signflow -e POSTGRES_DB=signflow -p 5432:5432 postgres:16-alpine`)

- [ ] **Step 5: Commit**

```bash
cd /var/www/html/sinage
git add packages/db
git commit -m "feat(db): add public Prisma schema (Organization, User, PairingCode)"
```

---

### Task 4: packages/db — tenant Prisma schema

**Files:**
- Create: `packages/db/prisma/tenant.prisma`

- [ ] **Step 1: Write `packages/db/prisma/tenant.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/tenant"
}

datasource db {
  provider = "postgresql"
  url      = env("TENANT_DATABASE_URL")
}

model Screen {
  id                String           @id @default(cuid())
  name              String
  uniqueCode        String           @unique
  groupId           String?
  group             ScreenGroup?     @relation(fields: [groupId], references: [id])
  orientation       Orientation      @default(LANDSCAPE)
  resolution        String?
  tags              String[]
  isOnline          Boolean          @default(false)
  lastHeartbeat     DateTime?
  lastSnapshot      String?
  currentPlaylistId String?
  currentPlaylist   Playlist?        @relation("CurrentScreenPlaylist", fields: [currentPlaylistId], references: [id])
  heartbeats        ScreenHeartbeat[]
  impressions       Impression[]
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
}

model ScreenGroup {
  id        String   @id @default(cuid())
  name      String
  location  String?
  screens   Screen[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ContentItem {
  id            String        @id @default(cuid())
  name          String
  type          ContentType
  url           String
  thumbnailUrl  String?
  mimeType      String?
  fileSize      Int?
  duration      Int?
  templateId    String?
  template      Template?     @relation(fields: [templateId], references: [id])
  metadata      Json?
  status        ContentStatus @default(PENDING)
  approvedBy    String?
  uploadedBy    String
  playlistItems PlaylistItem[]
  impressions   Impression[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

model Template {
  id           String        @id @default(cuid())
  name         String
  html         String
  css          String?
  variables    Json
  thumbnail    String?
  createdBy    String
  contentItems ContentItem[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Playlist {
  id             String         @id @default(cuid())
  name           String
  description    String?
  isDefault      Boolean        @default(false)
  items          PlaylistItem[]
  schedules      Schedule[]
  currentScreens Screen[]       @relation("CurrentScreenPlaylist")
  createdBy      String
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

model PlaylistItem {
  id            String         @id @default(cuid())
  playlistId    String
  playlist      Playlist       @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  contentItemId String
  contentItem   ContentItem    @relation(fields: [contentItemId], references: [id])
  position      Int
  duration      Int
  transition    TransitionType @default(FADE)
  zone          String         @default("main")
  createdAt     DateTime       @default(now())

  @@unique([playlistId, position])
}

model Schedule {
  id          String         @id @default(cuid())
  playlistId  String
  playlist    Playlist       @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  name        String?
  startDate   DateTime
  endDate     DateTime?
  startTime   String?
  endTime     String?
  recurrence  RecurrenceType @default(ONCE)
  daysOfWeek  Int[]
  screenIds   String[]
  groupIds    String[]
  priority    Int            @default(0)
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
}

model EmergencyAlert {
  id              String    @id @default(cuid())
  title           String
  message         String
  backgroundColor String    @default("#FF0000")
  textColor       String    @default("#FFFFFF")
  screenIds       String[]
  isActive        Boolean   @default(true)
  expiresAt       DateTime?
  createdBy       String
  createdAt       DateTime  @default(now())
}

model ScreenHeartbeat {
  id         String   @id @default(cuid())
  screenId   String
  screen     Screen   @relation(fields: [screenId], references: [id], onDelete: Cascade)
  timestamp  DateTime @default(now())
  playlistId String?
  contentId  String?
}

model Impression {
  id            String      @id @default(cuid())
  contentItemId String
  contentItem   ContentItem @relation(fields: [contentItemId], references: [id])
  screenId      String
  screen        Screen      @relation(fields: [screenId], references: [id])
  playedAt      DateTime    @default(now())
  durationMs    Int
}

enum Orientation      { LANDSCAPE PORTRAIT }
enum ContentType      { IMAGE VIDEO HTML_TEMPLATE RSS_FEED PDF }
enum ContentStatus    { PENDING APPROVED REJECTED }
enum TransitionType   { FADE SLIDE_LEFT SLIDE_RIGHT ZOOM NONE }
enum RecurrenceType   { ONCE DAILY WEEKLY MONTHLY }
```

- [ ] **Step 2: Add `TENANT_DATABASE_URL` to `.env` for local dev**

Add to your local `.env`:
```bash
TENANT_DATABASE_URL=postgresql://signflow:secret@localhost:5432/signflow?schema=tenant_dev
```

This is only used for `prisma generate`. At runtime, the tenant client factory overrides it per request.

- [ ] **Step 3: Generate both Prisma clients**

```bash
cd packages/db
pnpm db:generate
```

Expected: `packages/db/src/generated/public/` and `packages/db/src/generated/tenant/` created.

- [ ] **Step 4: Commit**

```bash
cd /var/www/html/sinage
git add packages/db
git commit -m "feat(db): add tenant Prisma schema with all operational models"
```

---

### Task 5: packages/db — client factory and tenant provisioning

**Files:**
- Create: `packages/db/src/public-client.ts`
- Create: `packages/db/src/tenant-client.ts`
- Create: `packages/db/src/provision-tenant.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/prisma/seed.ts`
- Test: `packages/db/src/__tests__/tenant-client.test.ts`

- [ ] **Step 1: Write `packages/db/src/public-client.ts`**

```typescript
import { PrismaClient } from '../src/generated/public';

declare global {
  // eslint-disable-next-line no-var
  var __publicClient: PrismaClient | undefined;
}

export const publicClient: PrismaClient =
  globalThis.__publicClient ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__publicClient = publicClient;
}
```

- [ ] **Step 2: Write `packages/db/src/tenant-client.ts`**

```typescript
import { PrismaClient } from '../src/generated/tenant';

const clientCache = new Map<string, PrismaClient>();

export function getTenantClient(orgSlug: string): PrismaClient {
  const cached = clientCache.get(orgSlug);
  if (cached) return cached;

  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL is not set');

  const url = new URL(baseUrl);
  url.searchParams.set('schema', `tenant_${orgSlug}`);

  const client = new PrismaClient({
    datasources: { db: { url: url.toString() } },
  });

  clientCache.set(orgSlug, client);
  return client;
}

export async function closeTenantClients(): Promise<void> {
  await Promise.all([...clientCache.values()].map((c) => c.$disconnect()));
  clientCache.clear();
}
```

- [ ] **Step 3: Write `packages/db/src/provision-tenant.ts`**

```typescript
import { execFileSync } from 'child_process';
import path from 'path';
import type { PrismaClient } from '../src/generated/public';

export async function provisionTenantSchema(
  orgSlug: string,
  db: PrismaClient
): Promise<void> {
  const schemaName = `tenant_${orgSlug}`;

  // 1. Create the PostgreSQL schema
  await db.$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`
  );

  // 2. Push Prisma tenant schema to the new PostgreSQL schema.
  //    prisma db push applies the schema without migration history —
  //    correct for per-tenant provisioning where all schemas must match.
  const tenantUrl = new URL(process.env.DATABASE_URL!);
  tenantUrl.searchParams.set('schema', schemaName);

  execFileSync(
    'npx',
    [
      'prisma',
      'db',
      'push',
      '--skip-generate',
      '--accept-data-loss',
      '--schema',
      path.join(__dirname, '../prisma/tenant.prisma'),
    ],
    {
      env: { ...process.env, TENANT_DATABASE_URL: tenantUrl.toString() },
      stdio: 'pipe',
    }
  );
}
```

- [ ] **Step 4: Write `packages/db/src/index.ts`**

```typescript
export { publicClient } from './public-client';
export { getTenantClient, closeTenantClients } from './tenant-client';
export { provisionTenantSchema } from './provision-tenant';
export { PrismaClient as PublicPrismaClient } from '../src/generated/public';
export { PrismaClient as TenantPrismaClient } from '../src/generated/tenant';
```

- [ ] **Step 5: Write `packages/db/prisma/seed.ts`**

```typescript
import { PrismaClient } from '../src/generated/public';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const org = await db.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: { name: 'Default Organisation', slug: 'default', plan: 'FREE' },
  });

  await db.user.upsert({
    where: { email: 'admin@signflow.local' },
    update: {},
    create: {
      email: 'admin@signflow.local',
      name: 'Super Admin',
      passwordHash: await bcrypt.hash('changeme', 12),
      role: 'SUPER_ADMIN',
      orgId: org.id,
      emailVerified: new Date(),
    },
  });

  console.log('Seeded: admin@signflow.local / changeme');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
```

- [ ] **Step 6: Install bcryptjs in db package**

Add to `packages/db/package.json` dependencies:
```json
"bcryptjs": "^2.4.3",
"@types/bcryptjs": "^2.4.6"
```
Then: `cd packages/db && pnpm install`

- [ ] **Step 7: Write unit test for tenant client**

Install vitest: add to `packages/db/package.json` devDependencies:
```json
"vitest": "^2.1.0"
```

`packages/db/src/__tests__/tenant-client.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock PrismaClient so we don't need a real DB
vi.mock('../../src/generated/tenant', () => ({
  PrismaClient: vi.fn().mockImplementation((opts: { datasources: { db: { url: string } } }) => ({
    _url: opts.datasources.db.url,
  })),
}));

// Must import after mock
const { getTenantClient, closeTenantClients } = await import('../tenant-client');

describe('getTenantClient', () => {
  beforeEach(async () => {
    await closeTenantClients();
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
  });

  it('appends schema=tenant_<slug> to the DATABASE_URL', () => {
    const client = getTenantClient('acme') as unknown as { _url: string };
    expect(client._url).toContain('schema=tenant_acme');
  });

  it('returns the same client instance on repeated calls', () => {
    const a = getTenantClient('acme');
    const b = getTenantClient('acme');
    expect(a).toBe(b);
  });

  it('returns different instances for different slugs', () => {
    const a = getTenantClient('acme');
    const b = getTenantClient('corp');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 8: Run tests**

```bash
cd packages/db
pnpm vitest run
```

Expected: 3 tests pass.

- [ ] **Step 9: Commit**

```bash
cd /var/www/html/sinage
git add packages/db
git commit -m "feat(db): add public client, tenant client factory, and tenant provisioner"
```

---

### Task 6: packages/ui — shadcn/ui component library

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`

- [ ] **Step 1: Scaffold the ui package**

```bash
mkdir -p packages/ui/src
```

`packages/ui/package.json`:
```json
{
  "name": "@signflow/ui",
  "version": "0.1.0",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "main": "./src/index.ts",
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.460.0",
    "tailwind-merge": "^2.5.0"
  }
}
```

`packages/ui/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write `packages/ui/src/index.ts`**

This file will be populated by shadcn when components are added from the admin app. For now, export the cn utility:

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// shadcn components are added here via: pnpm dlx shadcn@latest add <component>
// Run from apps/admin with components.json pointing output to packages/ui/src/
```

- [ ] **Step 3: Install ui deps**

```bash
cd packages/ui && pnpm install
```

- [ ] **Step 4: Commit**

```bash
cd /var/www/html/sinage
git add packages/ui
git commit -m "feat(ui): scaffold shared UI package (shadcn base)"
```

---

### Task 7: apps/admin — Next.js 15 scaffold + dependencies

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/next.config.ts`
- Create: `apps/admin/tailwind.config.ts`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/src/app/layout.tsx`

- [ ] **Step 1: Scaffold admin app**

```bash
mkdir -p apps/admin/src/app apps/admin/src/server/trpc/routers apps/admin/src/lib apps/admin/src/components
```

`apps/admin/package.json`:
```json
{
  "name": "@signflow/admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@signflow/db": "workspace:*",
    "@signflow/types": "workspace:*",
    "@signflow/ui": "workspace:*",
    "@trpc/server": "^11.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@tanstack/react-query": "^5.62.0",
    "next": "^15.1.0",
    "next-auth": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.0",
    "pino": "^9.5.0",
    "socket.io": "^4.8.0",
    "@socket.io/redis-adapter": "^8.3.0",
    "ioredis": "^5.4.0",
    "minio": "^8.0.0",
    "file-type": "^19.6.0",
    "isomorphic-dompurify": "^2.16.0",
    "node-cron": "^3.0.0",
    "@upstash/ratelimit": "^2.0.0",
    "next-intl": "^3.26.0",
    "@dnd-kit/core": "^6.3.0",
    "@dnd-kit/sortable": "^8.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/node-cron": "^3.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0"
  }
}
```

- [ ] **Step 2: Write `apps/admin/next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@signflow/ui', '@signflow/db', '@signflow/types'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
```

- [ ] **Step 3: Write `apps/admin/tsconfig.json`**

```json
{
  "extends": "../../packages/ui/tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "ES2020"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `apps/admin/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
```

- [ ] **Step 5: Write `apps/admin/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SignFlow Admin',
  description: 'Digital Signage Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

Create `apps/admin/src/app/globals.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 6: Install admin dependencies**

```bash
cd apps/admin && pnpm install
```

- [ ] **Step 7: Verify build scaffolding**

```bash
cd apps/admin && pnpm next info
```

Expected: Next.js version info printed, no errors.

- [ ] **Step 8: Commit**

```bash
cd /var/www/html/sinage
git add apps/admin
git commit -m "feat(admin): scaffold Next.js 15 admin app with dependencies"
```

---

### Task 8: apps/admin — NextAuth.js v5 + session types

**Files:**
- Create: `apps/admin/src/server/auth.ts`
- Create: `apps/admin/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/admin/src/middleware.ts`
- Create: `apps/admin/src/app/(auth)/login/page.tsx`
- Create: `apps/admin/src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Write `apps/admin/src/server/auth.ts`**

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { publicClient } from '@signflow/db';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await publicClient.user.findUnique({
          where: { email: parsed.data.email },
          include: { org: true },
        });

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          orgId: user.orgId,
          orgSlug: user.org.slug,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.orgId = (user as { orgId: string }).orgId;
        token.orgSlug = (user as { orgSlug: string }).orgSlug;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.orgId = token.orgId as string;
      session.user.orgSlug = token.orgSlug as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
});

// Extend next-auth types
declare module 'next-auth' {
  interface User {
    role: string;
    orgId: string;
    orgSlug: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      role: string;
      orgId: string;
      orgSlug: string;
    };
  }
}
```

- [ ] **Step 2: Write auth route handler**

`apps/admin/src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from '@/server/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Write `apps/admin/src/middleware.ts`**

```typescript
import { auth } from '@/server/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard') ||
    req.nextUrl.pathname === '/';
  const isAuth = req.nextUrl.pathname.startsWith('/login') ||
    req.nextUrl.pathname.startsWith('/register');

  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (isAuth && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 4: Write login page**

`apps/admin/src/app/(auth)/login/page.tsx`:
```tsx
'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const result = await signIn('credentials', {
      email: fd.get('email'),
      password: fd.get('password'),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-2xl font-bold text-white">SignFlow</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 text-white font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500">
          No account?{' '}
          <a href="/register" className="text-blue-400 hover:underline">
            Register organisation
          </a>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write register page**

`apps/admin/src/app/(auth)/register/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/orgs/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: fd.get('orgName'),
        email: fd.get('email'),
        password: fd.get('password'),
        name: fd.get('name'),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Registration failed');
    } else {
      router.push('/login');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-2xl font-bold text-white">Create Organisation</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { name: 'orgName', label: 'Organisation name', type: 'text' },
            { name: 'name', label: 'Your name', type: 'text' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'password', label: 'Password (min 8 chars)', type: 'password' },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-sm text-gray-400 mb-1">{f.label}</label>
              <input
                name={f.name}
                type={f.type}
                required
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 text-white font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create organisation'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /var/www/html/sinage
git add apps/admin/src/server/auth.ts apps/admin/src/app/api/auth apps/admin/src/middleware.ts apps/admin/src/app/'(auth)'
git commit -m "feat(admin): add NextAuth.js v5 credentials auth with JWT sessions"
```

---

### Task 9: apps/admin — tRPC v11 init, context, and root router

**Files:**
- Create: `apps/admin/src/server/trpc/init.ts`
- Create: `apps/admin/src/server/trpc/root.ts`
- Create: `apps/admin/src/app/api/trpc/[trpc]/route.ts`
- Create: `apps/admin/src/lib/trpc-client.ts`

- [ ] **Step 1: Write `apps/admin/src/server/trpc/init.ts`**

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@/server/auth';
import { getTenantClient, publicClient } from '@signflow/db';
import type { TenantPrismaClient } from '@signflow/db';
import { ZodError } from 'zod';

export interface TRPCContext {
  session: {
    user: {
      id: string;
      email: string;
      role: string;
      orgId: string;
      orgSlug: string;
    };
  } | null;
  db: TenantPrismaClient | null;
  publicDb: typeof publicClient;
  orgSlug: string | null;
}

export async function createTRPCContext(): Promise<TRPCContext> {
  const session = await auth();
  return {
    session: session as TRPCContext['session'],
    db: session?.user.orgSlug ? getTenantClient(session.user.orgSlug) : null,
    publicDb: publicClient,
    orgSlug: session?.user.orgSlug ?? null,
  };
}

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const tenantProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (!ctx.db || !ctx.orgSlug) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No tenant DB' });
  }
  return next({ ctx: { ...ctx, session: ctx.session, db: ctx.db, orgSlug: ctx.orgSlug } });
});

export const adminProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(ctx.session.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});
```

- [ ] **Step 2: Write `apps/admin/src/server/trpc/root.ts`**

```typescript
import { router } from './init';
import { orgsRouter } from './routers/orgs';
import { screensRouter } from './routers/screens';
import { screenGroupsRouter } from './routers/screen-groups';
import { contentRouter } from './routers/content';
import { templatesRouter } from './routers/templates';
import { playlistsRouter } from './routers/playlists';
import { schedulesRouter } from './routers/schedules';
import { alertsRouter } from './routers/alerts';
import { analyticsRouter } from './routers/analytics';

export const appRouter = router({
  orgs: orgsRouter,
  screens: screensRouter,
  screenGroups: screenGroupsRouter,
  content: contentRouter,
  templates: templatesRouter,
  playlists: playlistsRouter,
  schedules: schedulesRouter,
  alerts: alertsRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Write tRPC API route handler**

`apps/admin/src/app/api/trpc/[trpc]/route.ts`:
```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/root';
import { createTRPCContext } from '@/server/trpc/init';
import type { NextRequest } from 'next/server';

function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(`tRPC error on ${path}:`, error)
        : undefined,
  });
}

export { handler as GET, handler as POST };
```

- [ ] **Step 4: Write `apps/admin/src/lib/trpc-client.ts`**

```typescript
'use client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/trpc/root';

export const trpc = createTRPCReact<AppRouter>();
```

- [ ] **Step 5: Create stub routers so root.ts compiles**

Create `apps/admin/src/server/trpc/routers/orgs.ts` (and same pattern for all 8 other routers):
```typescript
import { router, adminProcedure } from '../init';

export const orgsRouter = router({
  // populated in later tasks
  _placeholder: adminProcedure.query(() => null),
});
```

Repeat for: `screens.ts`, `screen-groups.ts`, `content.ts`, `templates.ts`, `playlists.ts`, `schedules.ts`, `alerts.ts`, `analytics.ts` — all identical stubs for now.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd apps/admin && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /var/www/html/sinage
git add apps/admin/src/server/trpc apps/admin/src/app/api/trpc apps/admin/src/lib/trpc-client.ts
git commit -m "feat(admin): add tRPC v11 init, context middleware chain, and root router"
```

---

### Task 10: apps/admin — organisation registration API + dashboard layout

**Files:**
- Create: `apps/admin/src/app/api/orgs/register/route.ts`
- Create: `apps/admin/src/app/api/health/route.ts`
- Create: `apps/admin/src/app/(dashboard)/layout.tsx`
- Create: `apps/admin/src/app/(dashboard)/page.tsx`
- Create: `apps/admin/src/components/nav/Sidebar.tsx`
- Modify: `apps/admin/src/server/trpc/routers/orgs.ts`

- [ ] **Step 1: Write org registration REST endpoint**

`apps/admin/src/app/api/orgs/register/route.ts`:
```typescript
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
```

- [ ] **Step 2: Write health endpoint**

`apps/admin/src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { publicClient } from '@signflow/db';

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
```

- [ ] **Step 3: Write `apps/admin/src/components/nav/Sidebar.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Monitor, Image, ListVideo, Calendar, AlertTriangle,
  BarChart2, Settings, LogOut,
} from 'lucide-react';
import { signOut } from 'next-auth/react';

const nav = [
  { href: '/dashboard', label: 'Overview', icon: BarChart2 },
  { href: '/dashboard/screens', label: 'Screens', icon: Monitor },
  { href: '/dashboard/content', label: 'Content', icon: Image },
  { href: '/dashboard/playlists', label: 'Playlists', icon: ListVideo },
  { href: '/dashboard/schedules', label: 'Schedules', icon: Calendar },
  { href: '/dashboard/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-800 bg-gray-900 px-3 py-4">
      <div className="mb-8 px-2 text-xl font-bold text-white">SignFlow</div>
      <nav className="flex-1 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname === href
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}
```

- [ ] **Step 4: Write `apps/admin/src/app/(dashboard)/layout.tsx`**

```tsx
import { Sidebar } from '@/components/nav/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Write `apps/admin/src/app/(dashboard)/page.tsx`**

```tsx
import { auth } from '@/server/auth';

export default async function DashboardPage() {
  const session = await auth();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Overview</h1>
      <p className="text-gray-400">
        Welcome, {session?.user.name ?? session?.user.email}
      </p>
      <p className="text-sm text-gray-500 mt-1">
        Organisation: <span className="text-gray-300">{session?.user.orgSlug}</span>
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /var/www/html/sinage
git add apps/admin/src/app/api/orgs apps/admin/src/app/api/health apps/admin/src/app/'(dashboard)' apps/admin/src/components/nav
git commit -m "feat(admin): add org registration API, health endpoint, and dashboard layout"
```

---

## Phase 2: Admin Core

### Task 11: apps/admin — screens tRPC router + player REST endpoints

**Files:**
- Modify: `apps/admin/src/server/trpc/routers/screens.ts`
- Create: `apps/admin/src/app/api/player/pair/route.ts`
- Create: `apps/admin/src/app/api/player/heartbeat/route.ts`
- Create: `apps/admin/src/app/api/player/config/route.ts`
- Create: `apps/admin/src/app/api/player/impressions/route.ts`
- Create: `apps/admin/src/app/api/player/snapshot/route.ts`
- Create: `apps/admin/src/app/api/player/error/route.ts`

- [ ] **Step 1: Write `apps/admin/src/server/trpc/routers/screens.ts`**

```typescript
import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { nanoid } from 'nanoid';
import { TRPCError } from '@trpc/server';

export const screensRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.screen.findMany({
      include: { group: true },
      orderBy: { createdAt: 'desc' },
    })
  ),

  get: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const screen = await ctx.db.screen.findUnique({
        where: { id: input.id },
        include: { group: true, heartbeats: { take: 20, orderBy: { timestamp: 'desc' } } },
      });
      if (!screen) throw new TRPCError({ code: 'NOT_FOUND' });
      return screen;
    }),

  register: adminProcedure
    .input(z.object({ code: z.string().length(6), name: z.string().min(1), groupId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the pairing code exists and is unclaimed
      const pairing = await ctx.publicDb.pairingCode.findUnique({
        where: { code: input.code },
      });
      if (!pairing || pairing.orgSlug) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or already-used pairing code' });
      }
      if (pairing.expiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pairing code expired' });
      }

      const screen = await ctx.db.screen.create({
        data: {
          name: input.name,
          uniqueCode: input.code,
          groupId: input.groupId,
        },
      });

      // Claim the pairing code
      await ctx.publicDb.pairingCode.update({
        where: { code: input.code },
        data: { orgSlug: ctx.orgSlug, screenId: screen.id },
      });

      return screen;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      groupId: z.string().nullable().optional(),
      orientation: z.enum(['LANDSCAPE', 'PORTRAIT']).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.screen.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.screen.delete({ where: { id: input.id } })
    ),

  sendCommand: adminProcedure
    .input(z.object({
      screenId: z.string(),
      command: z.enum(['reload', 'screenshot', 'playlist_update']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Socket.io emit — imported lazily to avoid circular deps
      const { emitToScreen } = await import('@/server/socket');
      const event = input.command === 'reload' ? 'screen:reload'
        : input.command === 'screenshot' ? 'screen:screenshot'
        : 'playlist:update';
      await emitToScreen(ctx.orgSlug, input.screenId, event);
      return { ok: true };
    }),
});
```

- [ ] **Step 2: Write `apps/admin/src/app/api/player/pair/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { publicClient } from '@signflow/db';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// GET /api/player/pair?code=XXXXXX — called by player polling for registration
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  const pairing = await publicClient.pairingCode.findUnique({ where: { code } });
  if (!pairing?.screenId || !pairing.orgSlug) {
    return NextResponse.json({ pending: true }, { status: 202 });
  }

  return NextResponse.json({
    screenId: pairing.screenId,
    orgSlug: pairing.orgSlug,
    token: Buffer.from(`${pairing.screenId}:${pairing.orgSlug}`).toString('base64'),
  });
}

// POST /api/player/pair — called by player on first boot to create a pairing code
export async function POST() {
  const code = nanoid(6).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await publicClient.pairingCode.create({ data: { code, expiresAt } });
  return NextResponse.json({ code }, { status: 201 });
}
```

- [ ] **Step 3: Write `apps/admin/src/app/api/player/heartbeat/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { HeartbeatRequest } from '@signflow/types';

export async function POST(req: NextRequest) {
  const body: HeartbeatRequest = await req.json();
  if (!body.screenId || !body.orgSlug) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db = getTenantClient(body.orgSlug);
  await db.screen.update({
    where: { id: body.screenId },
    data: {
      isOnline: true,
      lastHeartbeat: new Date(),
      currentPlaylistId: body.playlistId ?? undefined,
    },
  });

  await db.screenHeartbeat.create({
    data: {
      screenId: body.screenId,
      playlistId: body.playlistId,
      contentId: body.contentId,
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write `apps/admin/src/app/api/player/config/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { PlayerConfig } from '@signflow/types';

export async function GET(req: NextRequest) {
  const screenId = req.nextUrl.searchParams.get('screenId');
  const orgSlug = req.nextUrl.searchParams.get('orgSlug');
  if (!screenId || !orgSlug) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const db = getTenantClient(orgSlug);

  const [playlists, schedules, activeAlert] = await Promise.all([
    db.playlist.findMany({
      include: {
        items: { include: { contentItem: true }, orderBy: { position: 'asc' } },
      },
    }),
    db.schedule.findMany({ where: { isActive: true } }),
    db.emergencyAlert.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const config: PlayerConfig = {
    screenId,
    orgSlug,
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      items: p.items.map((item) => ({
        id: item.id,
        contentItemId: item.contentItemId,
        type: item.contentItem.type as PlayerConfig['playlists'][0]['items'][0]['type'],
        url: item.contentItem.url,
        duration: item.duration,
        transition: item.transition as PlayerConfig['playlists'][0]['items'][0]['transition'],
        zone: item.zone as 'main' | 'ticker' | 'clock' | 'weather',
        metadata: item.contentItem.metadata as Record<string, unknown> | undefined,
      })),
    })),
    schedules: schedules.map((s) => ({
      id: s.id,
      playlistId: s.playlistId,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate?.toISOString(),
      startTime: s.startTime ?? undefined,
      endTime: s.endTime ?? undefined,
      recurrence: s.recurrence as PlayerConfig['schedules'][0]['recurrence'],
      daysOfWeek: s.daysOfWeek,
      screenIds: s.screenIds,
      groupIds: s.groupIds,
      priority: s.priority,
      isActive: s.isActive,
    })),
    activeAlert: activeAlert
      ? {
          id: activeAlert.id,
          title: activeAlert.title,
          message: activeAlert.message,
          backgroundColor: activeAlert.backgroundColor,
          textColor: activeAlert.textColor,
          screenIds: activeAlert.screenIds,
          isActive: activeAlert.isActive,
          expiresAt: activeAlert.expiresAt?.toISOString(),
        }
      : null,
    timezone: 'UTC',
    locale: 'en',
  };

  return NextResponse.json(config);
}
```

- [ ] **Step 5: Write impressions, snapshot, and error endpoints**

`apps/admin/src/app/api/player/impressions/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import type { ImpressionsRequest } from '@signflow/types';

export async function POST(req: NextRequest) {
  const body: ImpressionsRequest = await req.json();
  if (!body.orgSlug || !body.impressions?.length) {
    return NextResponse.json({ ok: true });
  }

  const db = getTenantClient(body.orgSlug);
  await db.impression.createMany({
    data: body.impressions.map((i) => ({
      contentItemId: i.contentItemId,
      screenId: i.screenId,
      playedAt: new Date(i.playedAt),
      durationMs: i.durationMs,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true });
}
```

`apps/admin/src/app/api/player/snapshot/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@signflow/db';
import { getMinio } from '@/lib/minio';
import type { SnapshotRequest } from '@signflow/types';

export async function POST(req: NextRequest) {
  const body: SnapshotRequest = await req.json();
  if (!body.screenId || !body.orgSlug || !body.imageBase64) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const buffer = Buffer.from(body.imageBase64, 'base64');
  const key = `snapshots/${body.orgSlug}/${body.screenId}.png`;
  const minio = getMinio();
  await minio.putObject(process.env.MINIO_BUCKET!, key, buffer, { 'Content-Type': 'image/png' });

  const url = `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/${key}`;
  const db = getTenantClient(body.orgSlug);
  await db.screen.update({ where: { id: body.screenId }, data: { lastSnapshot: url } });

  return NextResponse.json({ ok: true, url });
}
```

`apps/admin/src/app/api/player/error/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import type { PlayerErrorRequest } from '@signflow/types';
import pino from 'pino';

const logger = pino();

export async function POST(req: NextRequest) {
  const body: PlayerErrorRequest = await req.json();
  logger.error({ screenId: body.screenId, orgSlug: body.orgSlug, zone: body.zone }, body.message);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Commit**

```bash
cd /var/www/html/sinage
git add apps/admin/src/server/trpc/routers/screens.ts apps/admin/src/app/api/player
git commit -m "feat(admin): add screens tRPC router and all player REST endpoints"
```

---

### Task 12: apps/admin — MinIO client + content tRPC router

**Files:**
- Create: `apps/admin/src/lib/minio.ts`
- Modify: `apps/admin/src/server/trpc/routers/content.ts`

- [ ] **Step 1: Write `apps/admin/src/lib/minio.ts`**

```typescript
import * as Minio from 'minio';

let client: Minio.Client | null = null;

export function getMinio(): Minio.Client {
  if (!client) {
    client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: parseInt(process.env.MINIO_PORT ?? '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
  }
  return client;
}

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'application/pdf': ['.pdf'],
};

export const ALLOWED_MIMES = Object.keys(ALLOWED_MIME_TYPES);

const MAX_SIZE: Record<string, number> = {
  image: 50 * 1024 * 1024,   // 50 MB
  video: 2 * 1024 * 1024 * 1024, // 2 GB
  application: 100 * 1024 * 1024, // 100 MB
};

export function getMaxSize(mimeType: string): number {
  const [category] = mimeType.split('/');
  return MAX_SIZE[category] ?? 50 * 1024 * 1024;
}

export async function getPresignedUploadUrl(
  orgSlug: string,
  filename: string,
  mimeType: string
): Promise<{ url: string; key: string }> {
  const ext = filename.split('.').pop() ?? '';
  const key = `uploads/${orgSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const minio = getMinio();

  // presigned PUT URL valid for 15 minutes
  const url = await minio.presignedPutObject(
    process.env.MINIO_BUCKET!,
    key,
    15 * 60
  );
  return { url, key };
}

export function getPublicUrl(key: string): string {
  return `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET}/${key}`;
}
```

- [ ] **Step 2: Write `apps/admin/src/server/trpc/routers/content.ts`**

```typescript
import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import {
  ALLOWED_MIMES, getMaxSize, getPresignedUploadUrl, getPublicUrl
} from '@/lib/minio';

export const contentRouter = router({
  list: tenantProcedure
    .input(z.object({
      type: z.enum(['IMAGE', 'VIDEO', 'HTML_TEMPLATE', 'RSS_FEED', 'PDF']).optional(),
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.contentItem.findMany({
        where: {
          type: input.type,
          status: input.status ?? (process.env.CONTENT_APPROVAL_REQUIRED === 'true' ? 'APPROVED' : undefined),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      });
      const hasMore = items.length > input.limit;
      return { items: items.slice(0, input.limit), nextCursor: hasMore ? items[input.limit - 1].id : null };
    }),

  getUploadUrl: tenantProcedure
    .input(z.object({ filename: z.string(), mimeType: z.string(), size: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ALLOWED_MIMES.includes(input.mimeType)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'File type not allowed' });
      }
      if (input.size > getMaxSize(input.mimeType)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'File too large' });
      }
      return getPresignedUploadUrl(ctx.orgSlug, input.filename, input.mimeType);
    }),

  confirmUpload: tenantProcedure
    .input(z.object({
      name: z.string(),
      key: z.string(),
      mimeType: z.string(),
      fileSize: z.number(),
      type: z.enum(['IMAGE', 'VIDEO', 'HTML_TEMPLATE', 'RSS_FEED', 'PDF']),
      duration: z.number().optional(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.db.contentItem.create({
        data: {
          name: input.name,
          type: input.type,
          url: getPublicUrl(input.key),
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          duration: input.duration,
          uploadedBy: ctx.session.user.id,
          status: process.env.CONTENT_APPROVAL_REQUIRED === 'true' ? 'PENDING' : 'APPROVED',
        },
      })
    ),

  approve: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.contentItem.update({
        where: { id: input.id },
        data: { status: 'APPROVED', approvedBy: ctx.session.user.id },
      })
    ),

  reject: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.contentItem.update({
        where: { id: input.id },
        data: { status: 'REJECTED', approvedBy: ctx.session.user.id },
      })
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.contentItem.delete({ where: { id: input.id } })
    ),
});
```

- [ ] **Step 3: Commit**

```bash
cd /var/www/html/sinage
git add apps/admin/src/lib/minio.ts apps/admin/src/server/trpc/routers/content.ts
git commit -m "feat(admin): add MinIO client and content tRPC router with presigned upload"
```

---

### Task 13: apps/admin — playlists + schedules tRPC routers

**Files:**
- Modify: `apps/admin/src/server/trpc/routers/playlists.ts`
- Modify: `apps/admin/src/server/trpc/routers/schedules.ts`

- [ ] **Step 1: Write `apps/admin/src/server/trpc/routers/playlists.ts`**

```typescript
import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';

export const playlistsRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.playlist.findMany({ include: { _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' } })
  ),

  get: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const p = await ctx.db.playlist.findUnique({
        where: { id: input.id },
        include: { items: { include: { contentItem: true }, orderBy: { position: 'asc' } } },
      });
      if (!p) throw new TRPCError({ code: 'NOT_FOUND' });
      return p;
    }),

  create: tenantProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional(), isDefault: z.boolean().default(false) }))
    .mutation(({ ctx, input }) =>
      ctx.db.playlist.create({ data: { ...input, createdBy: ctx.session.user.id } })
    ),

  update: tenantProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).optional(), description: z.string().optional(), isDefault: z.boolean().optional() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.playlist.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.playlist.delete({ where: { id: input.id } })),

  addItem: tenantProcedure
    .input(z.object({
      playlistId: z.string(),
      contentItemId: z.string(),
      duration: z.number().min(1).default(10),
      transition: z.enum(['FADE', 'SLIDE_LEFT', 'SLIDE_RIGHT', 'ZOOM', 'NONE']).default('FADE'),
      zone: z.string().default('main'),
    }))
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.playlistItem.count({ where: { playlistId: input.playlistId } });
      return ctx.db.playlistItem.create({
        data: { ...input, position: count },
      });
    }),

  removeItem: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.playlistItem.delete({ where: { id: input.id } })),

  reorderItems: tenantProcedure
    .input(z.object({
      playlistId: z.string(),
      itemIds: z.array(z.string()), // new order
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.itemIds.map((id, position) =>
          ctx.db.playlistItem.update({ where: { id }, data: { position } })
        )
      );
      return { ok: true };
    }),

  updateItem: tenantProcedure
    .input(z.object({
      id: z.string(),
      duration: z.number().min(1).optional(),
      transition: z.enum(['FADE', 'SLIDE_LEFT', 'SLIDE_RIGHT', 'ZOOM', 'NONE']).optional(),
      zone: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.playlistItem.update({ where: { id }, data });
    }),
});
```

- [ ] **Step 2: Write `apps/admin/src/server/trpc/routers/schedules.ts`**

```typescript
import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';

const scheduleInput = z.object({
  playlistId: z.string(),
  name: z.string().optional(),
  startDate: z.string(), // ISO string
  endDate: z.string().optional(),
  startTime: z.string().optional(), // "HH:MM"
  endTime: z.string().optional(),
  recurrence: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('ONCE'),
  daysOfWeek: z.array(z.number().min(0).max(6)).default([]),
  screenIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([]),
  priority: z.number().default(0),
  isActive: z.boolean().default(true),
});

export const schedulesRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.schedule.findMany({ include: { playlist: { select: { id: true, name: true } } }, orderBy: { startDate: 'asc' } })
  ),

  create: tenantProcedure
    .input(scheduleInput)
    .mutation(({ ctx, input }) =>
      ctx.db.schedule.create({
        data: { ...input, startDate: new Date(input.startDate), endDate: input.endDate ? new Date(input.endDate) : undefined },
      })
    ),

  update: tenantProcedure
    .input(scheduleInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, startDate, endDate, ...rest } = input;
      return ctx.db.schedule.update({
        where: { id },
        data: {
          ...rest,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : null,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.schedule.delete({ where: { id: input.id } })),
});
```

- [ ] **Step 3: Commit**

```bash
cd /var/www/html/sinage
git add apps/admin/src/server/trpc/routers/playlists.ts apps/admin/src/server/trpc/routers/schedules.ts
git commit -m "feat(admin): add playlists and schedules tRPC routers"
```

---

### Task 14: apps/admin — alerts + analytics routers, Socket.io server

**Files:**
- Modify: `apps/admin/src/server/trpc/routers/alerts.ts`
- Modify: `apps/admin/src/server/trpc/routers/analytics.ts`
- Create: `apps/admin/src/server/socket.ts`
- Create: `apps/admin/src/lib/cron.ts`

- [ ] **Step 1: Write `apps/admin/src/server/socket.ts`**

```typescript
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ServerToClientEvents, ClientToServerEvents, InterServerEvents } from '@signflow/types';

type SocketServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents>;

let io: SocketServer | null = null;

export function getSocketServer(): SocketServer {
  if (io) return io;

  const pubClient = new Redis(process.env.REDIS_URL!);
  const subClient = pubClient.duplicate();

  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents>({
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket) => {
    socket.on('screen:join', ({ screenId, orgSlug }) => {
      socket.join(`org:${orgSlug}`);
      socket.join(`screen:${screenId}`);
    });
  });

  return io;
}

export async function emitToScreen(
  orgSlug: string,
  screenId: string,
  event: keyof ServerToClientEvents,
  payload?: unknown
): Promise<void> {
  const server = getSocketServer();
  (server.to(`screen:${screenId}`) as unknown as { emit: (e: string, p?: unknown) => void })
    .emit(event, payload);
}

export async function emitToOrg(
  orgSlug: string,
  event: keyof ServerToClientEvents,
  payload?: unknown
): Promise<void> {
  const server = getSocketServer();
  (server.to(`org:${orgSlug}`) as unknown as { emit: (e: string, p?: unknown) => void })
    .emit(event, payload);
}
```

- [ ] **Step 2: Write `apps/admin/src/server/trpc/routers/alerts.ts`**

```typescript
import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { emitToOrg, emitToScreen } from '@/server/socket';
import type { EmergencyAlertConfig } from '@signflow/types';

export const alertsRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.emergencyAlert.findMany({ orderBy: { createdAt: 'desc' } })
  ),

  getActive: tenantProcedure.query(({ ctx }) =>
    ctx.db.emergencyAlert.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } })
  ),

  create: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      message: z.string().min(1),
      backgroundColor: z.string().default('#FF0000'),
      textColor: z.string().default('#FFFFFF'),
      screenIds: z.array(z.string()).default([]),
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const alert = await ctx.db.emergencyAlert.create({
        data: {
          ...input,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          createdBy: ctx.session.user.id,
        },
      });

      const payload: EmergencyAlertConfig = {
        id: alert.id, title: alert.title, message: alert.message,
        backgroundColor: alert.backgroundColor, textColor: alert.textColor,
        screenIds: alert.screenIds, isActive: true,
        expiresAt: alert.expiresAt?.toISOString(),
      };

      if (alert.screenIds.length === 0) {
        await emitToOrg(ctx.orgSlug, 'alert:emergency', payload);
      } else {
        await Promise.all(
          alert.screenIds.map((id) => emitToScreen(ctx.orgSlug, id, 'alert:emergency', payload))
        );
      }

      return alert;
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const alert = await ctx.db.emergencyAlert.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      if (alert.screenIds.length === 0) {
        await emitToOrg(ctx.orgSlug, 'alert:clear');
      } else {
        await Promise.all(alert.screenIds.map((id) => emitToScreen(ctx.orgSlug, id, 'alert:clear')));
      }
      return alert;
    }),
});
```

- [ ] **Step 3: Write `apps/admin/src/server/trpc/routers/analytics.ts`**

```typescript
import { z } from 'zod';
import { router, tenantProcedure } from '../init';

export const analyticsRouter = router({
  summary: tenantProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 86400000);
      const [totalImpressions, topContent, screenUptime] = await Promise.all([
        ctx.db.impression.count({ where: { playedAt: { gte: since } } }),
        ctx.db.impression.groupBy({
          by: ['contentItemId'],
          _count: { contentItemId: true },
          _sum: { durationMs: true },
          where: { playedAt: { gte: since } },
          orderBy: { _count: { contentItemId: 'desc' } },
          take: 10,
        }),
        ctx.db.screen.findMany({
          select: { id: true, name: true, isOnline: true, lastHeartbeat: true },
        }),
      ]);

      return { totalImpressions, topContent, screenUptime };
    }),

  impressionsByContent: tenantProcedure
    .input(z.object({ contentItemId: z.string(), days: z.number().default(7) }))
    .query(({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 86400000);
      return ctx.db.impression.findMany({
        where: { contentItemId: input.contentItemId, playedAt: { gte: since } },
        orderBy: { playedAt: 'desc' },
      });
    }),
});
```

- [ ] **Step 4: Write `apps/admin/src/lib/cron.ts`**

```typescript
import cron from 'node-cron';
import { publicClient, getTenantClient } from '@signflow/db';
import { emitToOrg, emitToScreen } from '@/server/socket';

let started = false;

export function startCronJobs() {
  if (started) return;
  started = true;

  // Every minute: expire emergency alerts and mark screens offline if no heartbeat for 2 minutes
  cron.schedule('* * * * *', async () => {
    const orgs = await publicClient.organization.findMany({ select: { slug: true } });

    await Promise.all(
      orgs.map(async ({ slug }) => {
        const db = getTenantClient(slug);

        // Deactivate expired alerts
        const expired = await db.emergencyAlert.findMany({
          where: { isActive: true, expiresAt: { lt: new Date() } },
        });
        for (const alert of expired) {
          await db.emergencyAlert.update({ where: { id: alert.id }, data: { isActive: false } });
          if (alert.screenIds.length === 0) {
            await emitToOrg(slug, 'alert:clear');
          } else {
            await Promise.all(alert.screenIds.map((id) => emitToScreen(slug, id, 'alert:clear')));
          }
        }

        // Mark screens offline if heartbeat older than 2 minutes
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        await db.screen.updateMany({
          where: { isOnline: true, lastHeartbeat: { lt: twoMinutesAgo } },
          data: { isOnline: false },
        });
      })
    );
  });
}
```

- [ ] **Step 5: Call `startCronJobs()` on server startup**

Add to `apps/admin/src/app/api/health/route.ts` — import and call at module level:
```typescript
import { startCronJobs } from '@/lib/cron';
startCronJobs(); // starts only once due to guard flag
```

- [ ] **Step 6: Commit**

```bash
cd /var/www/html/sinage
git add apps/admin/src/server/socket.ts apps/admin/src/server/trpc/routers/alerts.ts apps/admin/src/server/trpc/routers/analytics.ts apps/admin/src/lib/cron.ts
git commit -m "feat(admin): add Socket.io server, alerts router with real-time emit, analytics router, and cron jobs"
```

---

### Task 15: apps/admin — key dashboard UI pages

**Files:**
- Create: `apps/admin/src/app/(dashboard)/screens/page.tsx`
- Create: `apps/admin/src/components/screens/ScreenCard.tsx`
- Create: `apps/admin/src/components/screens/RegisterScreenModal.tsx`
- Create: `apps/admin/src/app/(dashboard)/playlists/[id]/page.tsx`
- Create: `apps/admin/src/components/playlists/PlaylistBuilder.tsx`

- [ ] **Step 1: Write screen management page**

`apps/admin/src/app/(dashboard)/screens/page.tsx`:
```tsx
import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';
import { ScreenCard } from '@/components/screens/ScreenCard';
import { RegisterScreenModal } from '@/components/screens/RegisterScreenModal';

export default async function ScreensPage() {
  const session = await auth();
  const db = getTenantClient(session!.user.orgSlug);
  const screens = await db.screen.findMany({
    include: { group: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Screens</h1>
        <RegisterScreenModal />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {screens.map((screen) => (
          <ScreenCard key={screen.id} screen={screen} />
        ))}
        {screens.length === 0 && (
          <p className="col-span-full text-center text-gray-500 py-12">
            No screens registered yet. Click &ldquo;Register Screen&rdquo; to add one.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `ScreenCard` component**

`apps/admin/src/components/screens/ScreenCard.tsx`:
```tsx
import Link from 'next/link';
import { Monitor } from 'lucide-react';

interface Props {
  screen: {
    id: string;
    name: string;
    isOnline: boolean;
    lastHeartbeat: Date | null;
    lastSnapshot: string | null;
    group: { name: string } | null;
    orientation: string;
  };
}

export function ScreenCard({ screen }: Props) {
  const lastSeen = screen.lastHeartbeat
    ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        Math.round((screen.lastHeartbeat.getTime() - Date.now()) / 60000),
        'minute'
      )
    : 'Never';

  return (
    <Link
      href={`/dashboard/screens/${screen.id}`}
      className="group rounded-xl border border-gray-800 bg-gray-900 overflow-hidden hover:border-gray-600 transition-colors"
    >
      <div className="aspect-video bg-gray-800 relative overflow-hidden">
        {screen.lastSnapshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={screen.lastSnapshot} alt="Screen snapshot" className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Monitor className="h-12 w-12 text-gray-600" />
          </div>
        )}
        <span
          className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full ${
            screen.isOnline ? 'bg-green-500' : 'bg-gray-600'
          }`}
        />
      </div>
      <div className="p-3">
        <p className="font-medium text-sm text-white truncate">{screen.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {screen.group?.name ?? 'No group'} · {lastSeen}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Write `RegisterScreenModal`**

`apps/admin/src/components/screens/RegisterScreenModal.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Monitor } from 'lucide-react';

export function RegisterScreenModal() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const register = trpc.screens.register.useMutation({
    onSuccess: () => { setOpen(false); setCode(''); setName(''); window.location.reload(); },
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
      >
        <Monitor className="h-4 w-4" />
        Register Screen
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
            <h2 className="font-semibold text-white">Register Screen</h2>
            <p className="text-sm text-gray-400">
              Enter the 6-digit code shown on the display.
            </p>
            <input
              placeholder="6-digit code (e.g. ABC123)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-center text-2xl font-mono tracking-widest"
            />
            <input
              placeholder="Screen name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
            />
            {register.error && (
              <p className="text-sm text-red-400">{register.error.message}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => register.mutate({ code, name })}
                disabled={code.length !== 6 || !name || register.isPending}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {register.isPending ? 'Registering…' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Write playlist builder page**

`apps/admin/src/app/(dashboard)/playlists/[id]/page.tsx`:
```tsx
import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';
import { PlaylistBuilder } from '@/components/playlists/PlaylistBuilder';
import { notFound } from 'next/navigation';

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const db = getTenantClient(session!.user.orgSlug);

  const [playlist, allContent] = await Promise.all([
    db.playlist.findUnique({
      where: { id },
      include: { items: { include: { contentItem: true }, orderBy: { position: 'asc' } } },
    }),
    db.contentItem.findMany({
      where: { status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  if (!playlist) notFound();

  return <PlaylistBuilder playlist={playlist} allContent={allContent} />;
}
```

- [ ] **Step 5: Write `PlaylistBuilder` component (key logic only — full DnD implementation)**

`apps/admin/src/components/playlists/PlaylistBuilder.tsx`:
```tsx
'use client';
import { useState } from 'react';
import {
  DndContext, closestCenter, DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { trpc } from '@/lib/trpc-client';
import { GripVertical, Trash2 } from 'lucide-react';

type ContentItem = { id: string; name: string; type: string; thumbnailUrl: string | null };
type PlaylistItemRow = {
  id: string; contentItemId: string; position: number; duration: number;
  transition: string; zone: string; contentItem: ContentItem;
};
type Playlist = { id: string; name: string; items: PlaylistItemRow[] };

function SortableItem({ item, onRemove, onUpdate }: {
  item: PlaylistItemRow;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: unknown) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 p-3">
      <button {...attributes} {...listeners} className="text-gray-600 hover:text-gray-400 cursor-grab">
        <GripVertical className="h-4 w-4" />
      </button>
      {item.contentItem.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.contentItem.thumbnailUrl} alt="" className="h-10 w-16 object-cover rounded" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.contentItem.name}</p>
        <p className="text-xs text-gray-500">{item.contentItem.type}</p>
      </div>
      <input
        type="number"
        value={item.duration}
        onChange={(e) => onUpdate(item.id, 'duration', parseInt(e.target.value))}
        className="w-16 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white text-center"
        min={1}
      />
      <span className="text-xs text-gray-500">sec</span>
      <select
        value={item.zone}
        onChange={(e) => onUpdate(item.id, 'zone', e.target.value)}
        className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white"
      >
        {['main', 'ticker', 'clock', 'weather'].map((z) => (
          <option key={z} value={z}>{z}</option>
        ))}
      </select>
      <button onClick={() => onRemove(item.id)} className="text-gray-600 hover:text-red-400">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PlaylistBuilder({ playlist, allContent }: {
  playlist: Playlist;
  allContent: ContentItem[];
}) {
  const [items, setItems] = useState(playlist.items);
  const reorder = trpc.playlists.reorderItems.useMutation();
  const remove = trpc.playlists.removeItem.useMutation({
    onSuccess: (_, vars) => setItems((prev) => prev.filter((i) => i.id !== vars.id)),
  });
  const addItem = trpc.playlists.addItem.useMutation({
    onSuccess: (item) => setItems((prev) => [...prev, item as unknown as PlaylistItemRow]),
  });
  const updateItem = trpc.playlists.updateItem.useMutation();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    reorder.mutate({ playlistId: playlist.id, itemIds: reordered.map((i) => i.id) });
  }

  function handleUpdate(id: string, field: string, value: unknown) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    updateItem.mutate({ id, [field]: value });
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Content library panel */}
      <div className="w-64 shrink-0 space-y-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Content Library</h2>
        <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {allContent.map((c) => (
            <button
              key={c.id}
              onClick={() => addItem.mutate({ playlistId: playlist.id, contentItemId: c.id })}
              className="w-full text-left flex items-center gap-2 rounded-lg p-2 hover:bg-gray-800 text-sm"
            >
              {c.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumbnailUrl} alt="" className="h-8 w-12 object-cover rounded" />
              )}
              <div className="min-w-0">
                <p className="text-white truncate">{c.name}</p>
                <p className="text-xs text-gray-500">{c.type}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Playlist items */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          {playlist.name} — {items.length} item{items.length !== 1 ? 's' : ''}
        </h2>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                onRemove={(id) => remove.mutate({ id })}
                onUpdate={handleUpdate}
              />
            ))}
          </SortableContext>
        </DndContext>
        {items.length === 0 && (
          <p className="text-center text-gray-500 py-12 text-sm">
            Click items from the library to add them to this playlist.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /var/www/html/sinage
git add apps/admin/src/app/'(dashboard)'/screens apps/admin/src/components/screens apps/admin/src/app/'(dashboard)'/playlists apps/admin/src/components/playlists
git commit -m "feat(admin): add screens management UI and drag-drop playlist builder"
```

---

## Phase 3: Player App

### Task 16: apps/player — Next.js scaffold + IndexedDB

**Files:**
- Create: `apps/player/package.json`
- Create: `apps/player/next.config.ts`
- Create: `apps/player/tsconfig.json`
- Create: `apps/player/src/app/layout.tsx`
- Create: `apps/player/src/app/globals.css`
- Create: `apps/player/src/lib/db.ts`
- Create: `apps/player/src/lib/api.ts`
- Test: `apps/player/src/__tests__/db.test.ts`

- [ ] **Step 1: Scaffold the player app**

```bash
mkdir -p apps/player/src/app apps/player/src/lib apps/player/src/components/widgets apps/player/src/engine
```

`apps/player/package.json`:
```json
{
  "name": "@signflow/player",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "test": "vitest run"
  },
  "dependencies": {
    "@signflow/types": "workspace:*",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "idb": "^8.0.0",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0"
  }
}
```

- [ ] **Step 2: Write `apps/player/next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@signflow/types'],
  // No image optimization — player uses raw <img> tags for performance
  images: { unoptimized: true },
};

export default nextConfig;
```

- [ ] **Step 3: Write player `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "ES2020"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write player layout + globals**

`apps/player/src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'SignFlow Player' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`apps/player/src/app/globals.css`:
```css
@import "tailwindcss";

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 5: Write `apps/player/src/lib/db.ts`**

```typescript
import { openDB, type IDBPDatabase } from 'idb';
import type { PlayerConfig, ImpressionRecord } from '@signflow/types';

export interface SignFlowDB {
  config: { key: 'main'; value: { screenId: string; orgSlug: string; token: string } };
  playlist: { key: 'main'; value: PlayerConfig };
  impressions: { key: number; value: ImpressionRecord; indexes: { byTime: string } };
  assets: { key: string; value: { url: string; blobUrl: string; cachedAt: number } };
}

let _db: IDBPDatabase<SignFlowDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<SignFlowDB>> {
  if (_db) return _db;
  _db = await openDB<SignFlowDB>('signflow-player', 1, {
    upgrade(db) {
      db.createObjectStore('config');
      db.createObjectStore('playlist');
      const impressions = db.createObjectStore('impressions', { autoIncrement: true });
      impressions.createIndex('byTime', 'playedAt');
      db.createObjectStore('assets');
    },
  });
  return _db;
}

export async function getConfig() {
  const db = await getDB();
  return db.get('config', 'main');
}

export async function setConfig(value: SignFlowDB['config']['value']) {
  const db = await getDB();
  return db.put('config', value, 'main');
}

export async function getPlayerConfig(): Promise<PlayerConfig | undefined> {
  const db = await getDB();
  return db.get('playlist', 'main');
}

export async function setPlayerConfig(config: PlayerConfig) {
  const db = await getDB();
  return db.put('playlist', config, 'main');
}

export async function queueImpression(impression: ImpressionRecord) {
  const db = await getDB();
  return db.add('impressions', impression);
}

export async function flushImpressions(): Promise<ImpressionRecord[]> {
  const db = await getDB();
  const tx = db.transaction('impressions', 'readwrite');
  const all = await tx.store.getAll();
  await tx.store.clear();
  await tx.done;
  return all;
}

export async function getCachedAsset(url: string): Promise<string | null> {
  const db = await getDB();
  const entry = await db.get('assets', url);
  return entry?.blobUrl ?? null;
}

export async function cacheAsset(url: string, blobUrl: string) {
  const db = await getDB();
  return db.put('assets', { url, blobUrl, cachedAt: Date.now() }, url);
}
```

- [ ] **Step 6: Write `apps/player/src/lib/api.ts`**

```typescript
import type { PlayerConfig, ImpressionRecord } from '@signflow/types';
import { flushImpressions, getConfig } from './db';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function fetchPlayerConfig(
  screenId: string,
  orgSlug: string
): Promise<PlayerConfig> {
  const res = await fetch(
    `${BASE}/api/player/config?screenId=${screenId}&orgSlug=${orgSlug}`
  );
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
  return res.json();
}

export async function sendHeartbeat(
  screenId: string,
  orgSlug: string,
  playlistId?: string,
  contentId?: string
) {
  return fetch(`${BASE}/api/player/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ screenId, orgSlug, playlistId, contentId }),
  }).catch(() => null); // fire and forget
}

export async function sendImpressions(orgSlug: string, screenId: string) {
  const impressions = await flushImpressions();
  if (!impressions.length) return;
  return fetch(`${BASE}/api/player/impressions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgSlug, screenId, impressions }),
  }).catch(() => null);
}

export async function sendSnapshot(
  orgSlug: string,
  screenId: string,
  imageBase64: string
) {
  return fetch(`${BASE}/api/player/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgSlug, screenId, imageBase64 }),
  }).catch(() => null);
}

export async function reportError(
  orgSlug: string,
  screenId: string,
  zone: string,
  message: string,
  stack?: string
) {
  return fetch(`${BASE}/api/player/error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgSlug, screenId, zone, message, stack }),
  }).catch(() => null);
}
```

- [ ] **Step 7: Install player dependencies**

```bash
cd apps/player && pnpm install
```

- [ ] **Step 8: Commit**

```bash
cd /var/www/html/sinage
git add apps/player
git commit -m "feat(player): scaffold Next.js 15 player app with IndexedDB layer and API client"
```

---

### Task 17: apps/player — PlaylistEngine scheduler (TDD)

**Files:**
- Create: `apps/player/src/engine/scheduler.ts`
- Test: `apps/player/src/__tests__/scheduler.test.ts`

- [ ] **Step 1: Write the failing tests**

`apps/player/src/__tests__/scheduler.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { resolveActivePlaylist } from '../engine/scheduler';
import type { PlayerConfig, PlaylistConfig, ScheduleConfig } from '@signflow/types';

const makePlaylist = (id: string, isDefault = false): PlaylistConfig => ({
  id, name: `Playlist ${id}`, isDefault, items: [],
});

const makeSchedule = (
  overrides: Partial<ScheduleConfig> & { playlistId: string }
): ScheduleConfig => ({
  id: 'sched-1',
  startDate: '2026-01-01T00:00:00.000Z',
  recurrence: 'DAILY',
  daysOfWeek: [],
  screenIds: [],
  groupIds: [],
  priority: 0,
  isActive: true,
  ...overrides,
});

const makeConfig = (
  playlists: PlaylistConfig[],
  schedules: ScheduleConfig[],
  activeAlert = null
): PlayerConfig => ({
  screenId: 'screen-1',
  orgSlug: 'test',
  playlists,
  schedules,
  activeAlert,
  timezone: 'UTC',
  locale: 'en',
});

describe('resolveActivePlaylist', () => {
  it('returns null when there are no playlists', () => {
    const result = resolveActivePlaylist(makeConfig([], []), new Date());
    expect(result).toBeNull();
  });

  it('returns the default playlist when no schedules match', () => {
    const def = makePlaylist('default', true);
    const other = makePlaylist('other');
    const result = resolveActivePlaylist(makeConfig([def, other], []), new Date());
    expect(result?.id).toBe('default');
  });

  it('returns the scheduled playlist over the default when schedule is active', () => {
    const def = makePlaylist('default', true);
    const scheduled = makePlaylist('scheduled');
    const sched = makeSchedule({
      id: 'sched-1',
      playlistId: 'scheduled',
      startDate: '2026-01-01T00:00:00.000Z',
      recurrence: 'DAILY',
      daysOfWeek: [],
      priority: 1,
    });
    const now = new Date('2026-06-14T10:00:00.000Z');
    const result = resolveActivePlaylist(makeConfig([def, scheduled], [sched]), now);
    expect(result?.id).toBe('scheduled');
  });

  it('returns the highest-priority schedule when multiple match', () => {
    const p1 = makePlaylist('p1');
    const p2 = makePlaylist('p2');
    const sched1 = makeSchedule({ id: 's1', playlistId: 'p1', priority: 1, recurrence: 'DAILY' });
    const sched2 = makeSchedule({ id: 's2', playlistId: 'p2', priority: 5, recurrence: 'DAILY' });
    const now = new Date('2026-06-14T10:00:00.000Z');
    const result = resolveActivePlaylist(makeConfig([p1, p2], [sched1, sched2]), now);
    expect(result?.id).toBe('p2');
  });

  it('respects startTime/endTime window', () => {
    const p = makePlaylist('p1');
    const sched = makeSchedule({
      playlistId: 'p1',
      recurrence: 'DAILY',
      startTime: '09:00',
      endTime: '17:00',
    });
    const inWindow = new Date('2026-06-14T12:00:00.000Z');
    const outOfWindow = new Date('2026-06-14T20:00:00.000Z');
    expect(resolveActivePlaylist(makeConfig([p], [sched]), inWindow)?.id).toBe('p1');
    expect(resolveActivePlaylist(makeConfig([p], [sched]), outOfWindow)).toBeNull();
  });

  it('respects daysOfWeek filter', () => {
    const p = makePlaylist('p1');
    // Sunday = 0, daysOfWeek: [1] means Monday only
    const sched = makeSchedule({ playlistId: 'p1', recurrence: 'WEEKLY', daysOfWeek: [1] });
    const monday = new Date('2026-06-15T10:00:00.000Z');   // Monday
    const sunday = new Date('2026-06-14T10:00:00.000Z');   // Sunday
    expect(resolveActivePlaylist(makeConfig([p], [sched]), monday)?.id).toBe('p1');
    expect(resolveActivePlaylist(makeConfig([p], [sched]), sunday)).toBeNull();
  });

  it('respects endDate — schedule inactive after end date', () => {
    const p = makePlaylist('p1');
    const sched = makeSchedule({
      playlistId: 'p1',
      recurrence: 'DAILY',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-03-01T00:00:00.000Z',
    });
    const before = new Date('2026-02-15T10:00:00.000Z');
    const after = new Date('2026-06-14T10:00:00.000Z');
    expect(resolveActivePlaylist(makeConfig([p], [sched]), before)?.id).toBe('p1');
    expect(resolveActivePlaylist(makeConfig([p], [sched]), after)).toBeNull();
  });

  it('ignores inactive schedules', () => {
    const def = makePlaylist('default', true);
    const p = makePlaylist('p1');
    const sched = makeSchedule({ playlistId: 'p1', recurrence: 'DAILY', isActive: false });
    const result = resolveActivePlaylist(makeConfig([def, p], [sched]), new Date());
    expect(result?.id).toBe('default');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/player && pnpm vitest run src/__tests__/scheduler.test.ts
```

Expected: FAIL — `resolveActivePlaylist` not defined.

- [ ] **Step 3: Write `apps/player/src/engine/scheduler.ts`**

```typescript
import type { PlayerConfig, PlaylistConfig, ScheduleConfig } from '@signflow/types';

function isScheduleActive(schedule: ScheduleConfig, now: Date): boolean {
  if (!schedule.isActive) return false;

  const startDate = new Date(schedule.startDate);
  if (now < startDate) return false;

  if (schedule.endDate) {
    const endDate = new Date(schedule.endDate);
    if (now > endDate) return false;
  }

  // Check day of week
  if (schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(now.getUTCDay())) {
    return false;
  }

  // Check time window
  if (schedule.startTime || schedule.endTime) {
    const hh = now.getUTCHours();
    const mm = now.getUTCMinutes();
    const currentMinutes = hh * 60 + mm;

    if (schedule.startTime) {
      const [sh, sm] = schedule.startTime.split(':').map(Number);
      if (currentMinutes < sh * 60 + sm) return false;
    }
    if (schedule.endTime) {
      const [eh, em] = schedule.endTime.split(':').map(Number);
      if (currentMinutes >= eh * 60 + em) return false;
    }
  }

  return true;
}

export function resolveActivePlaylist(
  config: PlayerConfig,
  now: Date
): PlaylistConfig | null {
  const playlistMap = new Map(config.playlists.map((p) => [p.id, p]));

  // Find all active schedules and sort by priority descending
  const activeSchedules = config.schedules
    .filter((s) => isScheduleActive(s, now))
    .sort((a, b) => b.priority - a.priority);

  // Return playlist for the highest-priority active schedule
  for (const schedule of activeSchedules) {
    const playlist = playlistMap.get(schedule.playlistId);
    if (playlist) return playlist;
  }

  // Fallback to default playlist
  return config.playlists.find((p) => p.isDefault) ?? null;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/player && pnpm vitest run src/__tests__/scheduler.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /var/www/html/sinage
git add apps/player/src/engine/scheduler.ts apps/player/src/__tests__/scheduler.test.ts
git commit -m "feat(player): add PlaylistEngine scheduler with full test coverage"
```

---

### Task 18: apps/player — PlaylistEngine class

**Files:**
- Create: `apps/player/src/engine/PlaylistEngine.ts`

- [ ] **Step 1: Write `apps/player/src/engine/PlaylistEngine.ts`**

```typescript
import type { PlayerConfig, PlaylistConfig, PlaylistItemConfig, Zone } from '@signflow/types';
import { resolveActivePlaylist } from './scheduler';
import { queueImpression, getCachedAsset, cacheAsset } from '@/lib/db';
import { sendImpressions } from '@/lib/api';

export type ZoneState = {
  zone: Zone;
  items: PlaylistItemConfig[];
  currentIndex: number;
  currentItem: PlaylistItemConfig | null;
};

export type EngineState = {
  zones: Record<Zone, ZoneState>;
  activePlaylist: PlaylistConfig | null;
};

export type EngineListener = (state: EngineState) => void;

const ZONES: Zone[] = ['main', 'ticker', 'clock', 'weather'];
const IMPRESSION_FLUSH_MS = 30_000;

export class PlaylistEngine {
  private config: PlayerConfig | null = null;
  private state: EngineState = this.emptyState();
  private listeners: Set<EngineListener> = new Set();
  private timers: Map<Zone, ReturnType<typeof setTimeout>> = new Map();
  private watchdogTimers: Map<Zone, ReturnType<typeof setTimeout>> = new Map();
  private impressionTimer: ReturnType<typeof setInterval> | null = null;
  private itemStartTimes: Map<Zone, number> = new Map();

  private emptyState(): EngineState {
    const zones = {} as Record<Zone, ZoneState>;
    for (const z of ZONES) {
      zones[z] = { zone: z, items: [], currentIndex: 0, currentItem: null };
    }
    return { zones, activePlaylist: null };
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) l(this.state);
  }

  private setState(update: Partial<EngineState>) {
    this.state = { ...this.state, ...update };
    this.notify();
  }

  load(config: PlayerConfig) {
    this.config = config;
    this.reconcile(new Date());

    // Flush impressions every 30 seconds
    if (this.impressionTimer) clearInterval(this.impressionTimer);
    this.impressionTimer = setInterval(
      () => sendImpressions(config.orgSlug, config.screenId),
      IMPRESSION_FLUSH_MS
    );
  }

  reconcile(now: Date) {
    if (!this.config) return;
    const playlist = resolveActivePlaylist(this.config, now);

    if (playlist?.id === this.state.activePlaylist?.id) return; // no change

    this.clearAllTimers();
    const zones = this.buildZoneQueues(playlist);
    this.setState({ activePlaylist: playlist, zones });
    this.startAllZones();
    this.preloadForAllZones();
  }

  private buildZoneQueues(playlist: PlaylistConfig | null): Record<Zone, ZoneState> {
    const queues = this.emptyState().zones;
    if (!playlist) return queues;

    for (const item of playlist.items) {
      const zone = (item.zone as Zone) ?? 'main';
      if (queues[zone]) {
        queues[zone].items.push(item);
      }
    }

    for (const zone of ZONES) {
      queues[zone].currentItem = queues[zone].items[0] ?? null;
    }

    return queues;
  }

  private startAllZones() {
    for (const zone of ZONES) {
      this.scheduleNextTick(zone);
    }
  }

  private scheduleNextTick(zone: Zone) {
    const zoneState = this.state.zones[zone];
    const item = zoneState.currentItem;
    if (!item) return;

    this.itemStartTimes.set(zone, Date.now());
    const duration = item.duration * 1000;

    // Watchdog: if tick doesn't fire within 2× expected duration, force advance
    const watchdog = setTimeout(() => this.tick(zone), duration * 2);
    this.watchdogTimers.set(zone, watchdog);

    const timer = setTimeout(() => this.tick(zone), duration);
    this.timers.set(zone, timer);
  }

  tick(zone: Zone) {
    const zoneState = this.state.zones[zone];
    const completedItem = zoneState.currentItem;
    const startTime = this.itemStartTimes.get(zone);

    // Record impression
    if (completedItem && startTime) {
      const durationMs = Date.now() - startTime;
      queueImpression({
        contentItemId: completedItem.contentItemId,
        screenId: this.config!.screenId,
        playedAt: new Date().toISOString(),
        durationMs,
      });
    }

    // Advance to next item
    const nextIndex = (zoneState.currentIndex + 1) % Math.max(zoneState.items.length, 1);
    const nextItem = zoneState.items[nextIndex] ?? null;

    const updatedZone: ZoneState = { ...zoneState, currentIndex: nextIndex, currentItem: nextItem };
    const zones = { ...this.state.zones, [zone]: updatedZone };
    this.setState({ zones });

    // Clear timers for this zone
    clearTimeout(this.timers.get(zone));
    clearTimeout(this.watchdogTimers.get(zone));

    // Schedule next
    this.scheduleNextTick(zone);

    // Preload the item after next
    this.preloadNext(zone);

    // Re-check schedule (might need to switch playlist)
    this.reconcile(new Date());
  }

  private async preloadForAllZones() {
    for (const zone of ZONES) {
      await this.preloadNext(zone);
    }
  }

  private async preloadNext(zone: Zone) {
    const zoneState = this.state.zones[zone];
    if (zoneState.items.length < 2) return;
    const nextIndex = (zoneState.currentIndex + 1) % zoneState.items.length;
    const nextItem = zoneState.items[nextIndex];
    if (!nextItem?.url) return;

    const cached = await getCachedAsset(nextItem.url);
    if (cached) return;

    // Preload into blob cache
    try {
      const res = await fetch(nextItem.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      await cacheAsset(nextItem.url, blobUrl);
    } catch {
      // Preload failure is non-fatal — will use original URL as fallback
    }
  }

  private clearAllTimers() {
    for (const t of this.timers.values()) clearTimeout(t);
    for (const t of this.watchdogTimers.values()) clearTimeout(t);
    this.timers.clear();
    this.watchdogTimers.clear();
  }

  destroy() {
    this.clearAllTimers();
    if (this.impressionTimer) clearInterval(this.impressionTimer);
    this.listeners.clear();
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /var/www/html/sinage
git add apps/player/src/engine/PlaylistEngine.ts
git commit -m "feat(player): add PlaylistEngine with zone queues, tick loop, watchdog, and impression batching"
```

---

### Task 19: apps/player — pairing page + core player components

**Files:**
- Create: `apps/player/src/app/pair/page.tsx`
- Create: `apps/player/src/components/ZoneErrorBoundary.tsx`
- Create: `apps/player/src/components/TransitionWrapper.tsx`
- Create: `apps/player/src/components/ContentPlayer.tsx`
- Create: `apps/player/src/components/ZoneRenderer.tsx`
- Create: `apps/player/src/components/ScreenLayout.tsx`
- Create: `apps/player/src/components/EmergencyOverlay.tsx`
- Create: `apps/player/src/components/DebugOverlay.tsx`

- [ ] **Step 1: Write `apps/player/src/app/pair/page.tsx`**

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { setConfig } from '@/lib/db';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function PairPage() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  const createCode = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/player/pair`, { method: 'POST' });
      const data = await res.json();
      setCode(data.code);
    } catch {
      setError('Cannot reach server. Retrying…');
      setTimeout(createCode, 5000);
    }
  }, []);

  // Poll for registration
  useEffect(() => {
    if (!code) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/player/pair?code=${code}`);
        if (res.status === 202) return; // still pending
        if (res.ok) {
          const data = await res.json();
          await setConfig({ screenId: data.screenId, orgSlug: data.orgSlug, token: data.token });
          clearInterval(interval);
          router.replace(`/play/${data.screenId}`);
        }
      } catch { /* ignore network errors during polling */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [code, router]);

  useEffect(() => { createCode(); }, [createCode]);

  // Keyboard shortcut: F11 fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white gap-8">
      <h1 className="text-3xl font-bold">SignFlow</h1>
      <p className="text-gray-400">Register this display in the admin dashboard</p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {code ? (
        <div className="text-center space-y-4">
          <p className="text-gray-400 text-sm">Enter this code in the admin dashboard:</p>
          <div className="text-7xl font-mono font-bold tracking-widest bg-gray-900 border border-gray-700 rounded-2xl px-10 py-6">
            {code}
          </div>
          <p className="text-gray-500 text-sm animate-pulse">Waiting for registration…</p>
        </div>
      ) : (
        <div className="text-gray-500 text-sm animate-pulse">Generating pairing code…</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `apps/player/src/components/ZoneErrorBoundary.tsx`**

```tsx
'use client';
import React from 'react';
import { reportError } from '@/lib/api';

interface Props {
  zone: string;
  screenId: string;
  orgSlug: string;
  children: React.ReactNode;
}

interface State { hasError: boolean }

export class ZoneErrorBoundary extends React.Component<Props, State> {
  retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportError(this.props.orgSlug, this.props.screenId, this.props.zone, error.message, error.stack);
    // Auto-retry after 30 seconds
    this.retryTimer = setTimeout(() => this.setState({ hasError: false }), 30_000);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.hasError) {
      // Invisible black rect — screen continues showing other zones
      return <div className="w-full h-full bg-black" />;
    }
    return this.props.children;
  }
}
```

- [ ] **Step 3: Write `apps/player/src/components/TransitionWrapper.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import type { TransitionType } from '@signflow/types';

const TRANSITION_CLASSES: Record<TransitionType, { out: string; in: string }> = {
  FADE: { out: 'opacity-0', in: 'opacity-100 transition-opacity duration-700' },
  SLIDE_LEFT: { out: '-translate-x-full', in: 'translate-x-0 transition-transform duration-500' },
  SLIDE_RIGHT: { out: 'translate-x-full', in: 'translate-x-0 transition-transform duration-500' },
  ZOOM: { out: 'scale-110 opacity-0', in: 'scale-100 opacity-100 transition-all duration-600' },
  NONE: { out: '', in: '' },
};

export function TransitionWrapper({
  children,
  transitionType,
  itemKey,
}: {
  children: React.ReactNode;
  transitionType: TransitionType;
  itemKey: string;
}) {
  const [cls, setCls] = useState('');
  const prevKey = useRef(itemKey);

  useEffect(() => {
    if (prevKey.current === itemKey) return;
    prevKey.current = itemKey;
    const { out, in: inCls } = TRANSITION_CLASSES[transitionType];
    setCls(out);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setCls(inCls));
    });
    return () => cancelAnimationFrame(raf);
  }, [itemKey, transitionType]);

  return <div className={`w-full h-full ${cls}`}>{children}</div>;
}
```

- [ ] **Step 4: Write `apps/player/src/components/ContentPlayer.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import type { PlaylistItemConfig } from '@signflow/types';
import { getCachedAsset } from '@/lib/db';

export function ContentPlayer({ item }: { item: PlaylistItemConfig }) {
  const [src, setSrc] = useState(item.url);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    getCachedAsset(item.url).then((cached) => {
      if (cached) setSrc(cached);
    });
  }, [item.url]);

  useEffect(() => {
    if (item.type === 'VIDEO' && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => null);
    }
  }, [item.type, src]);

  switch (item.type) {
    case 'IMAGE':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="w-full h-full object-contain"
          loading="eager"
          onError={() => setSrc(item.url)} // fallback to original on blob error
        />
      );

    case 'VIDEO':
      return (
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          muted
          autoPlay
          playsInline
          loop={false}
          onError={() => setSrc(item.url)}
        />
      );

    case 'HTML_TEMPLATE':
      return (
        <iframe
          src={src}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts"
          title="content"
        />
      );

    case 'PDF':
      return (
        <iframe
          src={`${src}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full border-0"
          title="PDF"
        />
      );

    case 'RSS_FEED':
      // RSS feeds are handled by TickerWidget — this case won't appear in main zone
      return null;

    default:
      return null;
  }
}
```

- [ ] **Step 5: Write `apps/player/src/components/ZoneRenderer.tsx`**

```tsx
'use client';
import type { ZoneState } from '@/engine/PlaylistEngine';
import type { Zone } from '@signflow/types';
import { ContentPlayer } from './ContentPlayer';
import { TransitionWrapper } from './TransitionWrapper';
import { ClockWidget } from './widgets/ClockWidget';
import { WeatherWidget } from './widgets/WeatherWidget';
import { TickerWidget } from './widgets/TickerWidget';

interface Props {
  zone: Zone;
  state: ZoneState;
  weatherApiKey?: string;
  weatherLocation?: string;
}

export function ZoneRenderer({ zone, state, weatherApiKey, weatherLocation }: Props) {
  if (zone === 'clock') return <ClockWidget />;

  if (zone === 'weather') {
    return <WeatherWidget apiKey={weatherApiKey} location={weatherLocation} />;
  }

  if (zone === 'ticker') {
    const rssItems = state.items.filter((i) => i.type === 'RSS_FEED');
    return <TickerWidget items={rssItems} />;
  }

  // main zone
  if (!state.currentItem) return null;

  return (
    <TransitionWrapper
      transitionType={state.currentItem.transition}
      itemKey={state.currentItem.id}
    >
      <ContentPlayer item={state.currentItem} />
    </TransitionWrapper>
  );
}
```

- [ ] **Step 6: Write `apps/player/src/components/ScreenLayout.tsx`**

```tsx
'use client';
import type { Zone } from '@signflow/types';
import type { ZoneState } from '@/engine/PlaylistEngine';
import { ZoneRenderer } from './ZoneRenderer';
import { ZoneErrorBoundary } from './ZoneErrorBoundary';

const ZONES: Zone[] = ['main', 'ticker', 'clock', 'weather'];

interface Props {
  zones: Record<Zone, ZoneState>;
  screenId: string;
  orgSlug: string;
  weatherApiKey?: string;
  weatherLocation?: string;
}

export function ScreenLayout({ zones, screenId, orgSlug, weatherApiKey, weatherLocation }: Props) {
  const hasWeather = zones.weather.items.length > 0 || weatherApiKey;
  const hasTicker = zones.ticker.items.length > 0;

  return (
    <div
      className="w-screen h-screen overflow-hidden bg-black"
      style={{
        display: 'grid',
        gridTemplateRows: hasTicker
          ? `1fr ${hasWeather ? '3rem 3rem' : '3rem'}`
          : '1fr',
        gridTemplateColumns: hasWeather ? '1fr auto' : '1fr',
      }}
    >
      {/* Main content zone — spans full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <ZoneErrorBoundary zone="main" screenId={screenId} orgSlug={orgSlug}>
          <ZoneRenderer zone="main" state={zones.main} />
        </ZoneErrorBoundary>
      </div>

      {/* Ticker */}
      {hasTicker && (
        <div style={{ gridColumn: '1 / -1' }} className="bg-black/80">
          <ZoneErrorBoundary zone="ticker" screenId={screenId} orgSlug={orgSlug}>
            <ZoneRenderer zone="ticker" state={zones.ticker} />
          </ZoneErrorBoundary>
        </div>
      )}

      {/* Clock and weather — bottom row */}
      {(hasTicker || hasWeather) && (
        <>
          <ZoneErrorBoundary zone="clock" screenId={screenId} orgSlug={orgSlug}>
            <ZoneRenderer zone="clock" state={zones.clock} />
          </ZoneErrorBoundary>
          {hasWeather && (
            <ZoneErrorBoundary zone="weather" screenId={screenId} orgSlug={orgSlug}>
              <ZoneRenderer
                zone="weather"
                state={zones.weather}
                weatherApiKey={weatherApiKey}
                weatherLocation={weatherLocation}
              />
            </ZoneErrorBoundary>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write `apps/player/src/components/EmergencyOverlay.tsx`**

```tsx
'use client';
import type { EmergencyAlertConfig } from '@signflow/types';

export function EmergencyOverlay({ alert }: { alert: EmergencyAlertConfig | null }) {
  if (!alert?.isActive) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ backgroundColor: alert.backgroundColor, color: alert.textColor }}
    >
      <h1 className="text-6xl font-black mb-6">{alert.title}</h1>
      <p className="text-3xl font-medium max-w-2xl text-center">{alert.message}</p>
    </div>
  );
}
```

- [ ] **Step 8: Write `apps/player/src/components/DebugOverlay.tsx`**

```tsx
'use client';
import type { EngineState } from '@/engine/PlaylistEngine';

export function DebugOverlay({ state, screenId, orgSlug, visible }: {
  state: EngineState;
  screenId: string;
  orgSlug: string;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-4 left-4 z-[9998] bg-black/80 text-green-400 text-xs font-mono p-3 rounded-lg space-y-1 max-w-xs">
      <p>Screen: {screenId}</p>
      <p>Org: {orgSlug}</p>
      <p>Playlist: {state.activePlaylist?.name ?? 'none'}</p>
      {(['main', 'ticker'] as const).map((z) => (
        <p key={z}>{z}: {state.zones[z].currentItem?.id ?? 'none'}</p>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
cd /var/www/html/sinage
git add apps/player/src
git commit -m "feat(player): add pairing page, ZoneRenderer, ContentPlayer, transitions, overlays"
```

---

### Task 20: apps/player — player page, Socket.io client, widgets, health endpoint

**Files:**
- Create: `apps/player/src/lib/socket.ts`
- Create: `apps/player/src/app/play/[screenId]/page.tsx`
- Create: `apps/player/src/components/PlayerRoot.tsx`
- Create: `apps/player/src/components/widgets/ClockWidget.tsx`
- Create: `apps/player/src/components/widgets/WeatherWidget.tsx`
- Create: `apps/player/src/components/widgets/TickerWidget.tsx`
- Create: `apps/player/src/app/api/health/route.ts`

- [ ] **Step 1: Write `apps/player/src/lib/socket.ts`**

```typescript
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@signflow/types';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket) return socket;
  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? '', {
    transports: ['websocket', 'polling'],
    autoConnect: false,
  });
  return socket;
}

export function connectSocket(screenId: string, orgSlug: string) {
  const s = getSocket();
  s.connect();
  s.on('connect', () => s.emit('screen:join', { screenId, orgSlug }));
  return s;
}
```

- [ ] **Step 2: Write `apps/player/src/components/PlayerRoot.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { PlayerConfig, EmergencyAlertConfig } from '@signflow/types';
import { PlaylistEngine, type EngineState } from '@/engine/PlaylistEngine';
import { ScreenLayout } from './ScreenLayout';
import { EmergencyOverlay } from './EmergencyOverlay';
import { DebugOverlay } from './DebugOverlay';
import { fetchPlayerConfig, sendHeartbeat } from '@/lib/api';
import { getPlayerConfig, setPlayerConfig } from '@/lib/db';
import { connectSocket } from '@/lib/socket';

const EMPTY_ZONES = {} as EngineState['zones'];

export function PlayerRoot({
  screenId,
  orgSlug,
  weatherApiKey,
  weatherLocation,
}: {
  screenId: string;
  orgSlug: string;
  weatherApiKey?: string;
  weatherLocation?: string;
}) {
  const engineRef = useRef<PlaylistEngine | null>(null);
  const [engineState, setEngineState] = useState<EngineState>({ activePlaylist: null, zones: EMPTY_ZONES });
  const [alert, setAlert] = useState<EmergencyAlertConfig | null>(null);
  const [debug, setDebug] = useState(false);

  const loadConfig = useCallback(async (config: PlayerConfig) => {
    await setPlayerConfig(config);
    if (!engineRef.current) return;
    engineRef.current.load(config);
    if (config.activeAlert?.isActive) setAlert(config.activeAlert);
  }, []);

  useEffect(() => {
    // Init engine
    const engine = new PlaylistEngine();
    engineRef.current = engine;
    const unsub = engine.subscribe(setEngineState);

    // Load cached config immediately while fetching fresh
    getPlayerConfig().then((cached) => { if (cached) engine.load(cached); });

    // Fetch fresh config
    fetchPlayerConfig(screenId, orgSlug)
      .then(loadConfig)
      .catch(() => null);

    // Poll every 5 minutes
    const configPoll = setInterval(
      () => fetchPlayerConfig(screenId, orgSlug).then(loadConfig).catch(() => null),
      5 * 60 * 1000
    );

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(
      () => sendHeartbeat(
        screenId,
        orgSlug,
        engine['state'].activePlaylist?.id,
        engine['state'].zones.main?.currentItem?.contentItemId
      ),
      30_000
    );

    // Connect Socket.io
    const socket = connectSocket(screenId, orgSlug);
    socket.on('playlist:update', loadConfig);
    socket.on('alert:emergency', setAlert);
    socket.on('alert:clear', () => setAlert(null));
    socket.on('screen:reload', () => window.location.reload());
    socket.on('screen:screenshot', async () => {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(document.body);
      const { sendSnapshot } = await import('@/lib/api');
      await sendSnapshot(orgSlug, screenId, canvas.toDataURL('image/png').split(',')[1]);
    });

    // Keyboard shortcuts
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'F11') { e.preventDefault(); document.documentElement.requestFullscreen?.(); }
      if (e.key === 'r' || e.key === 'R') window.location.reload();
      if (e.key === 'd' || e.key === 'D') setDebug((v) => !v);
      if (e.key === 'p' || e.key === 'P') { /* pause/resume TODO */ }
    };
    window.addEventListener('keydown', keyHandler);

    return () => {
      unsub();
      engine.destroy();
      clearInterval(configPoll);
      clearInterval(heartbeat);
      socket.disconnect();
      window.removeEventListener('keydown', keyHandler);
    };
  }, [screenId, orgSlug, loadConfig]);

  return (
    <>
      <EmergencyOverlay alert={alert} />
      <ScreenLayout
        zones={engineState.zones}
        screenId={screenId}
        orgSlug={orgSlug}
        weatherApiKey={weatherApiKey}
        weatherLocation={weatherLocation}
      />
      <DebugOverlay state={engineState} screenId={screenId} orgSlug={orgSlug} visible={debug} />
    </>
  );
}
```

- [ ] **Step 3: Write `apps/player/src/app/play/[screenId]/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { PlayerRoot } from '@/components/PlayerRoot';

export default async function PlayPage({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = await params;
  if (!screenId) redirect('/pair');

  return (
    <PlayerRoot
      screenId={screenId}
      orgSlug="" // orgSlug resolved from IndexedDB on client side
      weatherApiKey={process.env.OPENWEATHERMAP_API_KEY}
    />
  );
}
```

Note: `orgSlug` is read from IndexedDB on the client. Update `PlayerRoot` to load it from `getConfig()` on mount before rendering.

- [ ] **Step 4: Write widgets**

`apps/player/src/components/widgets/ClockWidget.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';

export function ClockWidget() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center h-full bg-black/60 px-4">
      <span className="text-white text-lg font-mono tabular-nums">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  );
}
```

`apps/player/src/components/widgets/WeatherWidget.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
}

export function WeatherWidget({ apiKey, location }: { apiKey?: string; location?: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!apiKey || !location) return;
    const fetch_ = async () => {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`
        );
        const data = await res.json();
        setWeather({ temp: Math.round(data.main.temp), description: data.weather[0].description, icon: data.weather[0].icon });
      } catch { /* non-fatal */ }
    };
    fetch_();
    const interval = setInterval(fetch_, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [apiKey, location]);

  if (!weather) return null;

  return (
    <div className="flex items-center justify-center gap-2 h-full bg-black/60 px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
        alt={weather.description}
        className="h-8 w-8"
      />
      <span className="text-white text-lg font-mono">{weather.temp}°C</span>
    </div>
  );
}
```

`apps/player/src/components/widgets/TickerWidget.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import type { PlaylistItemConfig } from '@signflow/types';

export function TickerWidget({ items }: { items: PlaylistItemConfig[] }) {
  const [texts, setTexts] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const all: string[] = [];
      for (const item of items) {
        if (item.metadata?.feedUrl) {
          try {
            const res = await fetch(item.metadata.feedUrl as string);
            const text = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'application/xml');
            const itemTitles = Array.from(doc.querySelectorAll('item title'))
              .slice(0, (item.metadata.maxItems as number) ?? 5)
              .map((el) => el.textContent ?? '');
            all.push(...itemTitles);
          } catch { /* non-fatal */ }
        }
      }
      setTexts(all);
    };
    load();
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [items]);

  if (!texts.length) return null;
  const marqueeText = texts.join('   •   ');

  return (
    <div className="h-full flex items-center overflow-hidden bg-black/80">
      <div
        className="whitespace-nowrap text-white text-sm font-medium"
        style={{
          animation: `marquee ${Math.max(30, marqueeText.length * 0.1)}s linear infinite`,
          paddingLeft: '100vw',
        }}
      >
        {marqueeText}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 5: Write player health endpoint**

`apps/player/src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
}
```

- [ ] **Step 6: Commit**

```bash
cd /var/www/html/sinage
git add apps/player/src
git commit -m "feat(player): add PlayerRoot, widgets, Socket.io client, and play page"
```

---

## Phase 4: Cross-cutting & Infrastructure

### Task 21: Security — rate limiting and HTML sanitization

**Files:**
- Create: `apps/admin/src/lib/rate-limit.ts`
- Create: `apps/admin/src/lib/sanitize.ts`
- Modify: `apps/admin/src/app/api/auth/[...nextauth]/route.ts`
- Modify: `apps/admin/src/app/api/player/heartbeat/route.ts`
- Modify: `apps/admin/src/server/trpc/routers/templates.ts`

- [ ] **Step 1: Write `apps/admin/src/lib/rate-limit.ts`**

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from 'ioredis';

// Wraps ioredis in the interface Upstash Ratelimit expects
class IORedisBridge {
  constructor(private redis: Redis) {}
  async get(key: string) { return this.redis.get(key); }
  async set(key: string, value: string, expiryMode: string, expires: number) {
    return this.redis.set(key, value, expiryMode as 'EX', expires);
  }
  async pipeline() { return this.redis.pipeline(); }
  async eval(script: string, keys: string[], args: string[]) {
    return (this.redis as unknown as { eval: (...a: unknown[]) => Promise<unknown> })
      .eval(script, keys.length, ...keys, ...args);
  }
}

const redis = new Redis(process.env.REDIS_URL!);

export const authLimiter = new Ratelimit({
  redis: new IORedisBridge(redis) as unknown as Parameters<typeof Ratelimit>[0]['redis'],
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl:auth',
});

export const uploadLimiter = new Ratelimit({
  redis: new IORedisBridge(redis) as unknown as Parameters<typeof Ratelimit>[0]['redis'],
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:upload',
});

export const heartbeatLimiter = new Ratelimit({
  redis: new IORedisBridge(redis) as unknown as Parameters<typeof Ratelimit>[0]['redis'],
  limiter: Ratelimit.slidingWindow(4, '1 m'),
  prefix: 'rl:heartbeat',
});

export const impressionLimiter = new Ratelimit({
  redis: new IORedisBridge(redis) as unknown as Parameters<typeof Ratelimit>[0]['redis'],
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'rl:impressions',
});
```

- [ ] **Step 2: Write `apps/admin/src/lib/sanitize.ts`**

```typescript
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'br', 'hr',
  'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'section', 'article', 'header', 'footer', 'main', 'aside',
  'style', // allow <style> blocks for template CSS
];

const ALLOWED_ATTR = [
  'class', 'id', 'style', 'src', 'alt', 'width', 'height',
  'data-*', 'aria-*', 'role',
];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_SCRIPTS: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'iframe'],
    FORCE_BODY: true,
  });
}
```

- [ ] **Step 3: Apply rate limit to heartbeat endpoint**

Update `apps/admin/src/app/api/player/heartbeat/route.ts` — add at the top of the POST handler:
```typescript
import { heartbeatLimiter } from '@/lib/rate-limit';

// Inside POST, before processing:
const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
const { success } = await heartbeatLimiter.limit(`${ip}:${body.screenId}`);
if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
```

- [ ] **Step 4: Write templates tRPC router with sanitization**

`apps/admin/src/server/trpc/routers/templates.ts`:
```typescript
import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { sanitizeHtml } from '@/lib/sanitize';
import { TRPCError } from '@trpc/server';

export const templatesRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.template.findMany({ orderBy: { createdAt: 'desc' } })
  ),

  get: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const t = await ctx.db.template.findUnique({ where: { id: input.id } });
      if (!t) throw new TRPCError({ code: 'NOT_FOUND' });
      return t;
    }),

  create: tenantProcedure
    .input(z.object({
      name: z.string().min(1),
      html: z.string(),
      css: z.string().optional(),
      variables: z.array(z.object({
        name: z.string(),
        type: z.enum(['text', 'image', 'color', 'number']),
        default: z.unknown().optional(),
      })),
    }))
    .mutation(({ ctx, input }) =>
      ctx.db.template.create({
        data: {
          ...input,
          html: sanitizeHtml(input.html), // sanitize before storage
          createdBy: ctx.session.user.id,
        },
      })
    ),

  update: tenantProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      html: z.string().optional(),
      css: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, html, ...rest } = input;
      return ctx.db.template.update({
        where: { id },
        data: { ...rest, html: html ? sanitizeHtml(html) : undefined },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.template.delete({ where: { id: input.id } })),
});
```

- [ ] **Step 5: Commit**

```bash
cd /var/www/html/sinage
git add apps/admin/src/lib/rate-limit.ts apps/admin/src/lib/sanitize.ts apps/admin/src/server/trpc/routers/templates.ts
git commit -m "feat(admin): add rate limiting (Upstash/Redis) and HTML template sanitization (DOMPurify)"
```

---

### Task 22: Docker Compose + Dockerfiles

**Files:**
- Create: `infra/docker-compose.yml`
- Create: `apps/admin/Dockerfile`
- Create: `apps/player/Dockerfile`
- Create: `infra/nginx/nginx.conf`
- Create: `infra/minio/init-buckets.sh`

- [ ] **Step 1: Write `apps/admin/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── deps stage ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install --frozen-lockfile

# ── builder stage ────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
RUN pnpm --filter @signflow/db db:generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @signflow/admin build

# ── runner stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

- [ ] **Step 2: Write `apps/player/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/player/package.json ./apps/player/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/player/node_modules ./apps/player/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @signflow/player build

FROM node:20-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/player/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/player/.next/static ./.next/static
USER nextjs
EXPOSE 3001
ENV PORT=3001 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

- [ ] **Step 3: Write `infra/docker-compose.yml`**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: signflow
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secret}
      POSTGRES_DB: signflow
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U signflow"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [signflow_net]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [signflow_net]

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-signflow}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-signflow-secret}
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [signflow_net]

  createbuckets:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: /bin/sh /init-buckets.sh
    volumes:
      - ./infra/minio/init-buckets.sh:/init-buckets.sh:ro
    environment:
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-signflow}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-signflow-secret}
    networks: [signflow_net]

  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://signflow:${POSTGRES_PASSWORD:-secret}@postgres:5432/signflow
      TENANT_DATABASE_URL: postgresql://signflow:${POSTGRES_PASSWORD:-secret}@postgres:5432/signflow
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost}
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio
      MINIO_PORT: "9000"
      MINIO_USE_SSL: "false"
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-signflow}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-signflow-secret}
      MINIO_BUCKET: signflow-assets
      MINIO_PUBLIC_URL: ${MINIO_PUBLIC_URL:-http://localhost/minio}
      NEXT_PUBLIC_API_URL: ${NEXTAUTH_URL:-http://localhost}
      NEXT_PUBLIC_SOCKET_URL: ${NEXTAUTH_URL:-http://localhost}
      OPENWEATHERMAP_API_KEY: ${OPENWEATHERMAP_API_KEY:-}
      CONTENT_APPROVAL_REQUIRED: ${CONTENT_APPROVAL_REQUIRED:-false}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 30s
    networks: [signflow_net]

  player:
    build:
      context: .
      dockerfile: apps/player/Dockerfile
    restart: unless-stopped
    depends_on:
      admin:
        condition: service_healthy
    environment:
      NEXT_PUBLIC_API_URL: ${NEXTAUTH_URL:-http://localhost}
      NEXT_PUBLIC_SOCKET_URL: ${NEXTAUTH_URL:-http://localhost}
      OPENWEATHERMAP_API_KEY: ${OPENWEATHERMAP_API_KEY:-}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 20s
    networks: [signflow_net]

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    depends_on:
      admin:
        condition: service_healthy
      player:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - nginx_certs:/etc/nginx/certs
    networks: [signflow_net]

volumes:
  postgres_data:
  redis_data:
  minio_data:
  nginx_certs:

networks:
  signflow_net:
    driver: bridge
```

- [ ] **Step 4: Write `infra/nginx/nginx.conf`**

```nginx
events { worker_connections 1024; }

http {
  upstream admin  { server admin:3000; }
  upstream player { server player:3001; }
  upstream minio  { server minio:9000; }

  server {
    listen 80;
    server_name _;
    client_max_body_size 2g;

    # WebSocket support for Socket.io
    location /socket.io/ {
      proxy_pass http://admin;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_read_timeout 86400;
    }

    # Player app
    location /play/ {
      proxy_pass http://player;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /pair {
      proxy_pass http://player;
      proxy_set_header Host $host;
    }

    # MinIO asset delivery
    location /minio/ {
      proxy_pass http://minio/;
      proxy_set_header Host $host;
      add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # All other traffic → admin
    location / {
      proxy_pass http://admin;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
}
```

- [ ] **Step 5: Write `infra/minio/init-buckets.sh`**

```bash
#!/bin/sh
set -e
mc alias set local http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
mc mb --ignore-existing local/signflow-assets
mc anonymous set download local/signflow-assets
echo "MinIO bucket initialised."
```

- [ ] **Step 6: Test Docker build**

```bash
cd /var/www/html/sinage
# Copy .env.example to .env and fill in NEXTAUTH_SECRET
cp .env.example .env
# Edit .env: set NEXTAUTH_SECRET to a 32+ char random string

docker compose -f infra/docker-compose.yml build admin player
```

Expected: both images build without error.

- [ ] **Step 7: Start full stack**

```bash
docker compose -f infra/docker-compose.yml up -d
```

Expected: all 7 services start, postgres + redis + minio healthy before admin/player start.

- [ ] **Step 8: Run database seed**

```bash
docker compose -f infra/docker-compose.yml exec admin npx prisma migrate deploy --schema packages/db/prisma/public.prisma
docker compose -f infra/docker-compose.yml exec admin node packages/db/prisma/seed.js
```

Expected: `Seeded: admin@signflow.local / changeme`

- [ ] **Step 9: Smoke test**

```bash
curl http://localhost/api/health
# Expected: {"status":"ok","version":"0.1.0","db":"ok","uptime":...}

curl http://localhost:3001/api/health
# Expected: {"status":"ok","uptime":...}
```

- [ ] **Step 10: Commit**

```bash
cd /var/www/html/sinage
git add infra apps/admin/Dockerfile apps/player/Dockerfile
git commit -m "feat(infra): add Docker Compose with all 7 services, Dockerfiles, nginx, and MinIO init"
```

---

### Task 23: Remaining pages + README

**Files:**
- Create: `apps/admin/src/app/(dashboard)/analytics/page.tsx`
- Create: `apps/admin/src/app/(dashboard)/alerts/page.tsx`
- Create: `apps/admin/src/app/(dashboard)/content/page.tsx`
- Create: `README.md`

- [ ] **Step 1: Write analytics page**

`apps/admin/src/app/(dashboard)/analytics/page.tsx`:
```tsx
import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';

export default async function AnalyticsPage() {
  const session = await auth();
  const db = getTenantClient(session!.user.orgSlug);
  const since = new Date(Date.now() - 30 * 86400000);

  const [totalImpressions, topContent] = await Promise.all([
    db.impression.count({ where: { playedAt: { gte: since } } }),
    db.impression.groupBy({
      by: ['contentItemId'],
      _count: { contentItemId: true },
      _sum: { durationMs: true },
      where: { playedAt: { gte: since } },
      orderBy: { _count: { contentItemId: 'desc' } },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <p className="text-sm text-gray-400">Total impressions (30d)</p>
          <p className="text-3xl font-bold text-white mt-1">{totalImpressions.toLocaleString()}</p>
        </div>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Top Content (30d)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400">
              <th className="pb-2">Content ID</th>
              <th className="pb-2">Plays</th>
              <th className="pb-2">Total time</th>
            </tr>
          </thead>
          <tbody>
            {topContent.map((row) => (
              <tr key={row.contentItemId} className="border-t border-gray-800">
                <td className="py-2 font-mono text-xs text-gray-300">{row.contentItemId}</td>
                <td className="py-2 text-white">{row._count.contentItemId}</td>
                <td className="py-2 text-gray-300">
                  {Math.round((row._sum.durationMs ?? 0) / 1000 / 60)}min
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write alerts page**

`apps/admin/src/app/(dashboard)/alerts/page.tsx`:
```tsx
'use client';
import { trpc } from '@/lib/trpc-client';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function AlertsPage() {
  const { data: alerts, refetch } = trpc.alerts.list.useQuery();
  const create = trpc.alerts.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); }});
  const deactivate = trpc.alerts.deactivate.useMutation({ onSuccess: () => refetch() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', backgroundColor: '#FF0000', textColor: '#FFFFFF' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Emergency Alerts</h1>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          <AlertTriangle className="h-4 w-4" />
          New Alert
        </button>
      </div>

      <div className="space-y-3">
        {alerts?.map((alert) => (
          <div key={alert.id} className={`flex items-center justify-between rounded-xl border p-4 ${alert.isActive ? 'border-red-700 bg-red-950' : 'border-gray-800 bg-gray-900'}`}>
            <div>
              <p className="font-medium text-white">{alert.title}</p>
              <p className="text-sm text-gray-400 mt-0.5">{alert.message}</p>
            </div>
            {alert.isActive && (
              <button
                onClick={() => deactivate.mutate({ id: alert.id })}
                className="rounded-lg border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800"
              >
                Deactivate
              </button>
            )}
            {!alert.isActive && <span className="text-xs text-gray-600">Inactive</span>}
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
            <h2 className="font-semibold text-white">Create Emergency Alert</h2>
            {(['title', 'message'] as const).map((f) => (
              <div key={f}>
                <label className="block text-sm text-gray-400 mb-1 capitalize">{f}</label>
                <input
                  value={form[f]}
                  onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
                />
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300">Cancel</button>
              <button
                onClick={() => create.mutate(form)}
                disabled={!form.title || !form.message || create.isPending}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {create.isPending ? 'Sending…' : 'Send Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write content library page**

`apps/admin/src/app/(dashboard)/content/page.tsx`:
```tsx
import { auth } from '@/server/auth';
import { getTenantClient } from '@signflow/db';
import Link from 'next/link';
import { Upload } from 'lucide-react';

export default async function ContentPage() {
  const session = await auth();
  const db = getTenantClient(session!.user.orgSlug);
  const items = await db.contentItem.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Content Library</h1>
        <Link
          href="/dashboard/content/upload"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <div className="aspect-video bg-gray-800 overflow-hidden">
              {item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-600">{item.type}</div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-medium text-white truncate">{item.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `README.md`**

```markdown
# SignFlow

A production-ready, multi-tenant Digital Signage Management System.

## Quick Start

### Prerequisites
- Docker + Docker Compose
- A domain or localhost

### 1. Clone and configure
```bash
git clone <repo> signflow && cd signflow
cp .env.example .env
# Edit .env — at minimum set NEXTAUTH_SECRET (32+ random characters)
openssl rand -base64 32  # use this output as NEXTAUTH_SECRET
```

### 2. Start services
```bash
docker compose -f infra/docker-compose.yml up -d
```

### 3. Seed the database
```bash
docker compose -f infra/docker-compose.yml exec admin \
  npx prisma migrate deploy --schema packages/db/prisma/public.prisma
docker compose -f infra/docker-compose.yml exec admin \
  node packages/db/prisma/seed.js
```

### 4. Access SignFlow
- **Admin dashboard:** http://localhost → login as `admin@signflow.local` / `changeme`
- **Player:** http://localhost/pair (on a TV/kiosk)
- **MinIO console:** http://localhost:9001

## Architecture
See `docs/superpowers/specs/2026-06-14-signflow-design.md` for full design spec.

## Environment Variables
See `.env.example` for all required variables.

## Registering a Screen
1. Open http://localhost/pair on the display device.
2. Note the 6-digit code shown.
3. In the admin dashboard → Screens → Register Screen → enter the code + screen name.
4. The display will automatically redirect to the player.

## Development
```bash
pnpm install
pnpm dev          # starts admin on :3000, player on :3001
```

## Deployment
The included Docker Compose handles all services. For SSL in production, replace
the nginx config with a cert-manager or Certbot sidecar and update `NEXTAUTH_URL`.
```

- [ ] **Step 5: Final commit**

```bash
cd /var/www/html/sinage
git add apps/admin/src/app/'(dashboard)'/analytics apps/admin/src/app/'(dashboard)'/alerts apps/admin/src/app/'(dashboard)'/content README.md
git commit -m "feat: add analytics, alerts, content pages and README"
```

---

## Self-Review Checklist

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| Multi-tenant PostgreSQL schemas | Task 3, 4, 5 |
| NextAuth.js v5 credentials auth | Task 8 |
| tRPC v11 with tenant middleware | Task 9 |
| Screen registration (QR/code pairing) | Task 11, 19 |
| Content upload via presigned MinIO URL | Task 12 |
| HTML template sanitization (DOMPurify) | Task 21 |
| Playlist builder (drag-drop, dnd-kit) | Task 15 |
| Schedule router with priority | Task 13 |
| Emergency alerts + Socket.io real-time | Task 14 |
| PlaylistEngine scheduler (TDD) | Task 17 |
| PlaylistEngine tick/watchdog/impressions | Task 18 |
| Zone system (main/ticker/clock/weather) | Task 19, 20 |
| Offline-first (IndexedDB) | Task 16, 18 |
| Service worker (Workbox) | Not yet — add as follow-up |
| Heartbeat / screen monitoring | Task 11 |
| Snapshot endpoint | Task 11 |
| Analytics (impressions aggregation) | Task 14, 23 |
| Rate limiting | Task 21 |
| Clock widget | Task 20 |
| Weather widget | Task 20 |
| RSS ticker widget | Task 20 |
| Docker Compose (7 services) | Task 22 |
| nginx reverse proxy | Task 22 |
| MinIO bucket init | Task 22 |
| i18n (next-intl) | Not covered — add as follow-up |
| Workbox service worker | Not covered — add as follow-up |

**Two items not covered** — both are enhancement features that don't block core functionality. Add as follow-up tasks:

### Follow-up Task A: Workbox service worker

Add `next-pwa` to `apps/player/package.json`. Configure in `apps/player/next.config.ts`:
```typescript
import withPWA from 'next-pwa';
export default withPWA({
  dest: 'public',
  runtimeCaching: [
    { urlPattern: /\/api\/player\/config/, handler: 'NetworkFirst' },
    { urlPattern: /\.(mp4|webm|jpg|jpeg|png|webp|pdf)$/, handler: 'CacheFirst',
      options: { cacheName: 'media', expiration: { maxAgeSeconds: 7 * 86400 } } },
  ],
})(nextConfig);
```

### Follow-up Task B: next-intl i18n

Install `next-intl` in `apps/admin`. Add `messages/en.json`, `messages/fr.json` with all UI strings. Wrap `apps/admin/src/app/layout.tsx` with `NextIntlClientProvider`. Add locale detection middleware.
