FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
RUN pnpm --filter @signflow/db db:generate
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY} \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @signflow/admin build

FROM node:20-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
RUN apk add --no-cache ffmpeg curl openssl
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/socket-gateway.mjs ./apps/admin/socket-gateway.mjs
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/prisma/tenant-migrations ./prisma/tenant-migrations

# socket-gateway.mjs runs as a plain Node script outside Next's build/trace
# graph (it's invoked directly by node, not through the Next.js server), so
# Next's file-tracing never copies its dependencies into .next/standalone's
# node_modules. Resolve them in a completely ISOLATED directory rather than
# running npm install directly inside the existing node_modules Next
# already populated: Next's generated standalone package.json has no
# "dependencies" field at all (it relies on files just being physically
# present, not on manifest declarations), so npm's install reconciliation
# treated everything undeclared as extraneous and deleted it — including
# `next` itself, which broke the container outright. Copying the resolved
# packages in at the filesystem level afterward is purely additive and
# never triggers that reconciliation.
RUN mkdir -p /tmp/gateway-deps && cd /tmp/gateway-deps && \
    npm install --no-save --omit=dev \
      socket.io@4.8.3 \
      @socket.io/redis-adapter@8.3.0 \
      ioredis@5.11.1 && \
    cp -r /tmp/gateway-deps/node_modules/. /app/apps/admin/node_modules/ && \
    rm -rf /tmp/gateway-deps && \
    chown -R nextjs:nodejs /app/apps/admin/node_modules

USER nextjs
EXPOSE 3000 3002
ENV PORT=3000 HOSTNAME="0.0.0.0" TENANT_MIGRATIONS_DIR=/app/prisma/tenant-migrations
CMD ["sh", "-c", "node apps/admin/socket-gateway.mjs & node apps/admin/server.js"]
