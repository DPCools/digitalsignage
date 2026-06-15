# SignFlow — Digital Signage Management System
## Design Specification
**Date:** 2026-06-14
**Status:** Approved

---

## 1. Overview

SignFlow is a multi-tenant, production-ready Digital Signage Management System. It allows organisations to manage content, build playlists, schedule campaigns, and monitor displays in real time. Screens run a kiosk-optimised player that operates offline-first and receives real-time commands from the admin backend.

**Scale target:** Multiple organisations, 50–500 screens total, single-host Docker Compose deployment.

---

## 2. Repository Structure

Turborepo monorepo with two Next.js apps and three shared packages.

```
signflow/
├── apps/
│   ├── admin/                        # Next.js 15 — dashboard, tRPC server, Socket.io
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/           # /login, /register
│   │       │   ├── (dashboard)/      # all admin pages (layout-guarded)
│   │       │   └── api/              # tRPC handler, NextAuth, player REST, health
│   │       └── server/trpc/          # routers: screens, playlists, content, orgs, users
│   └── player/                       # Next.js 15 — kiosk display, minimal bundle
│       └── src/app/
│           ├── play/[screenId]/      # root player page
│           │   ├── ZoneRenderer/
│           │   ├── PlaylistEngine/
│           │   └── widgets/          # clock, ticker, weather, emergency
│           └── pair/                 # pairing screen (QR + 6-digit code)
├── packages/
│   ├── db/                           # Prisma client, schema, migrations, tenant factory
│   ├── ui/                           # shadcn/ui components (admin only)
│   └── types/                        # shared TypeScript types, Zod schemas, tRPC contracts
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/                        # reverse proxy config, SSL
│   └── minio/                        # bucket init script
├── turbo.json
└── package.json                      # pnpm workspaces
```

---

## 3. Tech Stack

| Concern | Choice |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (admin only) |
| API layer | tRPC v11 (admin dashboard ↔ tRPC server) |
| Player API | REST endpoints at `/api/player/*` (consumed by player app) |
| Database | PostgreSQL 16 + Prisma 5 |
| Multi-tenancy | Separate PostgreSQL schema per organisation |
| Auth | NextAuth.js v5 (credentials provider + optional Google OAuth) |
| Real-time | Socket.io (embedded in admin Next.js, Redis adapter) |
| Offline | Workbox (service worker) + IndexedDB (via `idb`) |
| File storage | MinIO (S3-compatible, self-hosted) |
| Caching / rate limiting | Redis 7 |
| Deployment | Docker Compose |
| Reverse proxy | nginx |

---

## 4. Multi-Tenancy

### Schema Strategy

- **Public schema:** `Organization`, `User` — system-wide, shared across all tenants.
- **Tenant schema:** All operational data lives in a PostgreSQL schema named `tenant_<orgSlug>` (e.g., `tenant_acme`).

### Tenant Client Factory

`packages/db/src/tenant-client.ts` exports `getTenantClient(orgSlug: string): PrismaClient`. Internally, it caches a `PrismaClient` instance per slug, initialised with `DATABASE_URL?schema=tenant_<slug>`. All tRPC routers receive the scoped client via context; no router can access another tenant's data.

### Tenant Provisioning Flow

```
POST /api/orgs
  → INSERT INTO public.Organization
  → INSERT INTO public.User (first admin)
  → CREATE SCHEMA IF NOT EXISTS tenant_<slug>
  → prisma migrate deploy (against tenant schema)
  → return { orgId, orgSlug, adminUserId }
```

---

## 5. Data Model

### Public Schema

```
Organization
  id          String  @id @default(cuid())
  name        String
  slug        String  @unique          // used as schema suffix
  plan        Plan    @default(FREE)   // FREE | PRO | ENTERPRISE
  createdAt   DateTime

User
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  passwordHash  String?
  role          Role                   // SUPER_ADMIN | ADMIN | CONTENT_MANAGER | VIEWER
  orgId         String   → Organization
  emailVerified DateTime?
  preferences   Json?                  // { locale: "en", temperatureUnit: "C"|"F" }
  createdAt     DateTime
```

### Tenant Schema (per org)

```
Screen
  id                String
  name              String
  uniqueCode        String  @unique    // for QR/manual pairing
  groupId           String? → ScreenGroup
  orientation       Orientation        // LANDSCAPE | PORTRAIT
  resolution        String?            // "1920x1080"
  tags              String[]
  isOnline          Boolean
  lastHeartbeat     DateTime?
  lastSnapshot      String?            // MinIO URL
  currentPlaylistId String? → Playlist

ScreenGroup
  id        String
  name      String
  location  String?
  screens   Screen[]

ContentItem
  id           String
  name         String
  type         ContentType  // IMAGE | VIDEO | HTML_TEMPLATE | RSS_FEED | PDF
  url          String       // MinIO presigned base URL (empty string for HTML_TEMPLATE type)
  thumbnailUrl String?
  mimeType     String?
  fileSize     Int?         // bytes (null for HTML_TEMPLATE, RSS_FEED)
  duration     Int?         // seconds (video only)
  templateId   String?      // → Template; populated when type = HTML_TEMPLATE
  metadata     Json?        // type-specific:
                            //   HTML_TEMPLATE: { variables: { key: value } } — bound values for templateId
                            //   RSS_FEED:      { feedUrl, maxItems, refreshIntervalMin }
                            //   PDF:           { pageCount, currentPage, autoAdvanceSec }
  status       ContentStatus // PENDING | APPROVED | REJECTED
  approvedBy   String?      // User.id
  uploadedBy   String       // User.id
  createdAt    DateTime

Template
  id        String
  name      String
  html      String          // sanitized HTML with {{variable}} placeholders
  css       String?
  variables Json            // { name, type: "text"|"image"|"color"|"number", default }[]
  thumbnail String?
  createdBy String          // User.id
  createdAt DateTime

Playlist
  id          String
  name        String
  description String?
  isDefault   Boolean       // fallback when no schedule matches
  items       PlaylistItem[]
  schedules   Schedule[]
  createdBy   String
  updatedAt   DateTime @updatedAt
  createdAt   DateTime

PlaylistItem
  id            String
  playlistId    String → Playlist
  contentItemId String → ContentItem
  position      Int          // order within playlist
  duration      Int          // seconds to display
  transition    TransitionType  // FADE | SLIDE_LEFT | SLIDE_RIGHT | ZOOM | NONE
  zone          String       // "main" | "ticker" | "clock" | "weather" (layout-defined)

Schedule
  id          String
  playlistId  String → Playlist
  name        String?
  startDate   DateTime
  endDate     DateTime?
  startTime   String?        // "09:00" — null means all day
  endTime     String?        // "18:00"
  recurrence  RecurrenceType // ONCE | DAILY | WEEKLY | MONTHLY
  daysOfWeek  Int[]          // [0..6] Sunday=0; empty = all days
  screenIds   String[]       // explicit screen targets
  groupIds    String[]       // group targets; expanded at resolution time
  priority    Int  @default(0)  // higher wins when schedules overlap
  isActive    Boolean

EmergencyAlert
  id              String
  title           String
  message         String
  backgroundColor String  @default("#FF0000")
  textColor       String  @default("#FFFFFF")
  screenIds       String[]  // empty array = all screens
  isActive        Boolean
  expiresAt       DateTime?
  createdBy       String
  createdAt       DateTime

ScreenHeartbeat
  id         String
  screenId   String → Screen
  timestamp  DateTime
  playlistId String?
  contentId  String?

Impression
  id            String
  contentItemId String → ContentItem
  screenId      String
  playedAt      DateTime
  durationMs    Int          // actual display time (may differ from configured duration)
```

---

## 6. Player Architecture

### Boot & Pairing

On first launch, the player has no `screenId`. It shows a pairing screen with a randomly generated 6-digit code and a QR code encoding `{ code, playerUrl }`. The player polls `GET /api/player/pair?code=XXXXXX` every 3 seconds. The admin registers the screen from the dashboard (entering the code or scanning the QR). The API responds with `{ screenId, token }`, which the player stores in `localStorage` and `IndexedDB`, then reloads to `/play/[screenId]`.

### Zone System

A layout is a named CSS Grid template. Each active playlist assigns content to named zones. Built-in zones:

| Zone key | Purpose | Content types |
|---|---|---|
| `main` | Primary display area | Image, Video, HTML template, PDF |
| `ticker` | Scrolling bottom bar | RSS feed, plain text |
| `clock` | Time display | Clock widget (built-in) |
| `weather` | Weather widget | Weather widget (built-in, OpenWeatherMap) |

Each zone runs an independent `PlaylistEngine` instance. A zone missing from the active playlist renders empty (transparent).

### Playlist Engine

Pure TypeScript class (not a React component) held in a `useRef`. No framework dependencies in the core logic.

```
PlaylistEngine
  resolveActivePlaylist(now: Date): Playlist
    Priority order:
      1. Active EmergencyAlert (always wins)
      2. Scheduled Playlist with highest priority whose window contains `now`
      3. Default Playlist (isDefault = true)
      4. Built-in fallback (org logo from config + clock)

  buildZoneQueues(playlist): Map<zone, PlaylistItem[]>
    Groups items by zone, sorted by position.

  tick(): void
    Advances current zone to next item.
    Calls preloadNext() for the item after that.
    Records impression for the completed item.
    Schedules next tick via setTimeout(duration * 1000).

  preloadNext(): void
    For images: new Image().src = url
    For videos: hidden <video>.src = url; video.load()
    Assets resolved via IndexedDB blob cache first, then MinIO URL.

  emitTransition(type: TransitionType): void
    Adds CSS class to wrapper; removes after transitionend event.

  recordImpression(itemId, screenId, durationMs): void
    Appends to IndexedDB "impressions" store.
    Flushes to POST /api/player/impressions when batch >= 10 or every 30s.
```

### Offline-First

```
Service Worker (Workbox)
  CacheFirst:     all media assets (images, videos, HTML, PDFs)
  NetworkFirst:   /api/player/config (playlist JSON)
  BackgroundSync: impression POST queue
  Precache:       player app shell (JS/CSS bundles, fonts)

IndexedDB stores
  "playlist"    current resolved playlist JSON snapshot
  "assets"      { url → blobUrl } — fetched assets stored as Blobs
  "impressions" queued records pending server sync
  "config"      { screenId, token, orgConfig, lastSync }
```

On network loss: continues from IndexedDB playlist. All cached assets play normally. On reconnect: flushes impressions → fetches updated config → hot-swaps playlist engine if changed (no reload required).

### Real-Time (Hybrid)

**WebSocket (Socket.io):**

| Event (inbound) | Action |
|---|---|
| `playlist:update` | Re-resolve active playlist, hot-swap if changed |
| `alert:emergency` | Show `<EmergencyOverlay>` immediately |
| `alert:clear` | Dismiss overlay, resume normal playback |
| `screen:reload` | `location.reload()` |
| `screen:screenshot` | `html2canvas` → POST `/api/player/snapshot` |
| `config:update` | Update screen settings from payload |

**Polling (fallback + routine):**
- Every 30s: `POST /api/player/heartbeat` with `{ screenId, playlistId, contentId }`
- Every 5min: `GET /api/player/config` — full playlist sync
- On WebSocket disconnect: poll interval tightens to 10s until reconnected

### Player Component Tree

```
<PlayerRoot>                        full-screen, black background, overflow hidden
  <EmergencyOverlay />              z-index 9999, full-screen colour + text
  <ScreenLayout zones={layout}>     CSS Grid, orientation-aware (portrait/landscape)
    <ZoneRenderer zone="main">
      <ErrorBoundary fallback={<BlackRect />}>
        <ContentPlayer item={current} />    video | img | iframe | pdf
        <TransitionWrapper type={transition} />
      </ErrorBoundary>
    </ZoneRenderer>
    <ZoneRenderer zone="ticker">
      <ErrorBoundary>
        <TickerWidget items={rssFeedItems} />
      </ErrorBoundary>
    </ZoneRenderer>
    <ZoneRenderer zone="clock">
      <ClockWidget />
    </ZoneRenderer>
    <ZoneRenderer zone="weather">
      <WeatherWidget apiKey={key} location={loc} />
    </ZoneRenderer>
  </ScreenLayout>
  <DebugOverlay />                  toggled by D key; shows screenId, playlist, zone states
</PlayerRoot>
```

### Player Optimisations

- Bundle target: < 150KB gzipped (no shadcn/ui, no admin deps)
- Raw `<img>` tags with `loading="eager"` on current, `loading="lazy"` on next
- CSS transitions use `opacity` and `transform` only (GPU-accelerated, no layout thrash)
- `<video>` attributes: `playsinline muted autoplay` for kiosk autoplay policy
- Keyboard shortcuts: `F11` fullscreen, `R` reload, `D` debug overlay, `P` pause/resume
- Watchdog timer: if `tick()` hasn't fired within 2× expected duration, force-advance
- Error boundary per zone: one broken zone does not affect others; auto-retry after 30s
- Self-host Inter font via `next/font` — no external font requests

---

## 7. Admin Dashboard

### Page Map

```
/(auth)
  /login
  /register                         org creation + first admin account

/(dashboard)                        layout: sidebar + top nav + session guard
  /                                 overview: screen count, alert status, today's impressions
  /screens                          screen grid (online/offline, snapshot, heartbeat)
  /screens/[screenId]               detail: current content, heartbeat log, settings
  /screens/groups                   create/manage screen groups
  /content                          media library (grid, search, type filter)
  /content/upload                   drag-drop upload + URL import
  /content/templates                template gallery
  /content/templates/[id]/editor    HTML/CSS editor + live preview
  /playlists                        playlist list
  /playlists/[id]                   playlist builder (drag-drop, zone assignment)
  /schedules                        calendar view of all campaigns
  /alerts                           emergency alert management
  /analytics                        impressions, play time, screen uptime
```

### tRPC Router Tree

```
appRouter
  auth.*          session info, org-switch (SUPER_ADMIN)
  screens.*       list, get, register, update, delete, sendCommand, getSnapshot
  screenGroups.*  list, create, update, delete
  content.*       list, get, getUploadUrl, confirmUpload, delete, approve, reject
  templates.*     list, get, create, update, delete, preview
  playlists.*     list, get, create, update, delete, reorderItems, addItem, removeItem
  schedules.*     list, get, create, update, delete, getCalendar
  alerts.*        list, getActive, create, deactivate
  analytics.*     impressionsByContent, impressionsByScreen, playDuration, summary, uptime
  orgs.*          settings, inviteUser, removeUser, updateRole  [ADMIN+ only]
```

**Middleware chain on every tRPC request:**
1. `enforceAuth` — validates JWT session, attaches `session.user`
2. `enforceTenant` — derives `orgSlug` from `session.user.orgSlug`, calls `getTenantClient(slug)`, attaches scoped Prisma client to context

### Authentication (NextAuth.js v5)

- **Provider:** Credentials (email + password, bcrypt verify)
- **Session strategy:** JWT (stateless; works across Docker containers without shared session store)
- **Session shape:** `{ user: { id, email, name, role, orgId, orgSlug } }`
- **Route protection:** Next.js middleware guards all `/dashboard/*` routes; redirects to `/login` on missing/expired session
- **Org switching:** SUPER_ADMINs only; `POST /api/auth/switch-org` re-issues JWT with target org context

### Key UI Interactions

**Screen Grid (`/screens`)**
Cards show: name, group, online dot (green/grey), last heartbeat (relative), snapshot thumbnail, current playlist. Real-time status updates via Socket.io room `org:<slug>` pushing `screen:status` events → React Query cache invalidation. Bulk actions: assign playlist, send reload, move to group.

**Playlist Builder (`/playlists/[id]`)**
Three-panel layout: content library (left, searchable), drag-drop item list using `@dnd-kit/sortable` (centre), live preview iframe in player preview mode (right). Each `PlaylistItem` card shows thumbnail, name, duration input, transition picker, zone selector. Save is debounced 500ms via `playlists.update` tRPC mutation.

**Schedule Calendar (`/schedules`)**
Calendar grid showing campaigns per screen/group. Click a slot → create-schedule modal: playlist picker, date/time range, recurrence, days of week, priority, target screens/groups. Overlapping schedules show priority badge.

**Content Upload (`/content/upload`)**
Client calls `content.getUploadUrl` → receives presigned MinIO URL → uploads file direct from browser (bypasses Next.js server). On completion: `content.confirmUpload` → creates `ContentItem` record → triggers background thumbnail generation (sharp for images, ffmpeg for video). If approval workflow enabled, content status is `PENDING` until ADMIN/CONTENT_MANAGER acts.

**Emergency Alerts (`/alerts`)**
Form: title, message, background/text colours, target (all screens or specific). On submit: Socket.io emits `alert:emergency` immediately to all target screens. `expiresAt` auto-deactivates via `node-cron` job running in admin process.

### RBAC Matrix

| Action | SUPER_ADMIN | ADMIN | CONTENT_MANAGER | VIEWER |
|---|---|---|---|---|
| Manage orgs / users | ✓ | ✗ | ✗ | ✗ |
| Register / delete screens | ✓ | ✓ | ✗ | ✗ |
| Upload content | ✓ | ✓ | ✓ | ✗ |
| Approve / reject content | ✓ | ✓ | ✗ | ✗ |
| Build playlists / schedules | ✓ | ✓ | ✓ | ✗ |
| Send emergency alerts | ✓ | ✓ | ✗ | ✗ |
| View analytics / monitoring | ✓ | ✓ | ✓ | ✓ |
| Remote reload / screenshot | ✓ | ✓ | ✗ | ✗ |

---

## 8. Docker & Deployment

### Services

| Service | Image | Role |
|---|---|---|
| `postgres` | `postgres:16-alpine` | Primary database |
| `redis` | `redis:7-alpine` | Socket.io adapter, rate limiting |
| `minio` | `minio/minio:latest` | S3-compatible asset storage |
| `createbuckets` | `minio/mc` | One-shot bucket + policy init |
| `admin` | `./apps/admin` | Next.js admin app |
| `player` | `./apps/player` | Next.js player app |
| `nginx` | `nginx:alpine` | Reverse proxy, SSL termination |

### Network Layout

```
nginx :80/:443  (only service exposed to host)
  /play/*        → player:3001
  /socket.io/*   → admin:3000  (WebSocket upgrade headers)
  /minio/*       → minio:9000
  /*             → admin:3000

Internal bridge network: signflow_net
Volumes: postgres_data, redis_data, minio_data, nginx_certs
```

### Dockerfiles

Both apps use Next.js `output: 'standalone'`. Three-stage build:
1. `deps` — pnpm install with frozen lockfile
2. `builder` — `pnpm turbo build --filter=<app>`
3. `runner` — lean Alpine image, copies standalone output only (~200MB final image)

### Startup Sequence

```
postgres (healthy) ──┐
minio (healthy)    ──┤→ createbuckets → admin → nginx
redis (healthy)    ──┘               → player
```

Admin runs on startup:
```
prisma migrate deploy    # public schema
prisma db seed           # default SUPER_ADMIN user
node server.js           # start accepting traffic
```

### Environment Variables

```bash
DATABASE_URL=postgresql://signflow:secret@postgres:5432/signflow
NEXTAUTH_SECRET=<32+ random chars>
NEXTAUTH_URL=http://localhost
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=signflow
MINIO_SECRET_KEY=signflow-secret
MINIO_BUCKET=signflow-assets
MINIO_PUBLIC_URL=http://localhost/minio
REDIS_URL=redis://redis:6379
SOCKET_SECRET=<random>
NEXT_PUBLIC_API_URL=http://localhost
NEXT_PUBLIC_SOCKET_URL=http://localhost
OPENWEATHERMAP_API_KEY=<key>
CONTENT_APPROVAL_REQUIRED=false
```

### Health Checks

All services define Docker healthchecks. Admin and player expose `GET /api/health → { status, version, db, uptime }`. All services restart: `unless-stopped`.

---

## 9. Cross-Cutting Concerns

### Security

**HTML Template Sanitization**
- Server-side: `isomorphic-dompurify` strips `<script>`, event handlers, `javascript:` URLs before storage
- Player renders templates in `<iframe sandbox="allow-same-origin allow-scripts">` with strict CSP
- Template variable injection is server-side string replacement — never `eval` or raw `innerHTML`

**File Upload**
- Client requests presigned MinIO URL from tRPC; server validates MIME type and size before issuing URL
- Allowed: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `application/pdf`
- Size limits: images 50MB, videos 2GB, PDFs 100MB
- Post-upload: `file-type` library verifies declared MIME matches actual file bytes

**Rate Limiting** (via `@upstash/ratelimit` + Redis)
- Auth endpoints: 5 req/min per IP
- `content.getUploadUrl`: 20 req/min per user
- Player heartbeat: 4 req/min per screenId
- Player impressions: 60 req/min per screenId

**Other**
- CSRF protection via NextAuth.js v5 built-in tokens
- All DB queries via Prisma (parameterized) — raw queries only for schema DDL
- MinIO assets served via presigned GET URLs (1-hour TTL), refreshed by player config endpoint

### Error Handling

**Player Zone Error Boundaries**
Each `ZoneRenderer` wrapped in React Error Boundary. Crashed zone → black rectangle + error POST to `/api/player/error` + auto-retry after 30s. Other zones unaffected.

**Player Watchdog Timer**
`setInterval` at 2× current item duration. If `PlaylistEngine.tick()` has not fired, force-advance to next item.

**Player Network Loss Cascade**
```
WebSocket disconnect → tighten poll to 10s
Asset 404 / network error → serve from IndexedDB blob cache
Config fetch fails → continue on cached playlist
All caches empty → built-in fallback screen (org logo + clock)
```

**Admin tRPC Errors**
Structured `TRPCError` codes. Client shows shadcn `<Toast>` on error — no raw server messages in UI. Unhandled errors logged as structured JSON via `pino`.

### Analytics

**Ingestion:** Player batches impressions in IndexedDB, flushes every 30s or on item advance. `prisma.impression.createMany()` for batch inserts.

**Queries (on-demand aggregation):**
- Plays per content: `COUNT GROUP BY contentItemId`
- Play time per content: `SUM(durationMs) GROUP BY contentItemId`
- Plays per screen: `COUNT GROUP BY screenId`
- Peak hours heatmap: `COUNT GROUP BY EXTRACT(HOUR FROM playedAt)`
- Screen uptime %: heartbeat interval analysis vs expected 30s cadence

At high volume (>10K impressions/day), a `pg_cron` nightly job materialises summaries into `analytics_daily`.

### Performance

- Admin: cursor-based pagination (20 items/page), React Query `stale-while-revalidate`
- Player: < 150KB bundle; self-hosted Inter font; WebP assets from MinIO; GPU-only CSS transitions
- Asset CDN headers: `Cache-Control: public, max-age=31536000, immutable` on versioned MinIO URLs
- Video: hidden offscreen element preloads next clip while current plays

### Internationalisation

`next-intl` in admin app. Initial locales: `en`, `fr`, `de`, `es`. Locale stored in `User.preferences` JSON field, applied via Next.js middleware. Player has no UI text; only dynamic widgets (date format, temperature units) respect locale.

### Observability

- Structured JSON logging via `pino` (both apps) — every log line includes `orgSlug`, `screenId` where applicable
- `GET /api/health` on both apps for Docker healthcheck + uptime monitoring
- Docker Compose `logging` block documented for Loki/Grafana extension (not included in base compose)

---

## 10. Out of Scope (v1)

The following are explicitly excluded from v1 to keep scope focused:

- Kubernetes / horizontal scaling (single Docker Compose host)
- Per-tenant database (shared DB with per-tenant schemas is sufficient at this scale)
- Native mobile app for admin
- Video transcoding pipeline (videos uploaded as-is; encoding on the client/source side)
- SSO / SAML (Google OAuth is optional but SAML is not included)
- A/B testing of content
- White-labelling / custom domains per tenant

---

## 11. Implementation Order

1. Repo scaffold (Turborepo, pnpm, Dockerfiles, compose)
2. `packages/db` — Prisma schema, public + tenant migrations, client factory
3. `apps/admin` — NextAuth, tRPC skeleton, org/user routers
4. `apps/admin` — Screen management, content upload, playlist builder
5. `apps/player` — Pairing flow, PlaylistEngine, ZoneRenderer, offline layer
6. `apps/admin` — Real-time (Socket.io), screen monitoring, emergency alerts
7. `apps/admin` — Analytics page, schedule calendar
8. `apps/player` — Dynamic widgets (clock, weather, ticker)
9. Cross-cutting: rate limiting, sanitization, error boundaries, i18n
10. infra: nginx config, SSL, health checks, seed script, README
