import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import { GRID_PRESETS } from '@signflow/types';
import { TenantPrisma } from '@signflow/db';
import { resolveCellMode } from '@/lib/layout';

// Explicit output schemas: Playlist sits at the centre of a circular Prisma
// relation graph (Playlist <-> Screen <-> ScreenGroup <-> Playlist). Letting
// tRPC infer procedure output types straight from the Prisma return value
// pulls that whole cycle into the client's generated types and blows past
// TypeScript's instantiation depth limit during `next build` (not caught by
// `next dev`, which doesn't full-typecheck). Sealing the output to a flat
// Zod shape here breaks the cycle at the router boundary.
const playlistOutput = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  layoutPreset: z.string().nullable(),
  cellConfig: z.any().nullable(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const playlistListOutput = playlistOutput.extend({
  _count: z.object({ items: z.number() }),
});

const contentItemOutput = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  url: z.string(),
  thumbnailUrl: z.string().nullable(),
  mimeType: z.string().nullable(),
  fileSize: z.number().nullable(),
  duration: z.number().nullable(),
  templateId: z.string().nullable(),
  metadata: z.any().nullable(),
  status: z.string(),
  approvedBy: z.string().nullable(),
  uploadedBy: z.string(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const playlistItemBaseOutput = z.object({
  id: z.string(),
  playlistId: z.string(),
  contentItemId: z.string(),
  position: z.number(),
  duration: z.number(),
  transition: z.string(),
  zone: z.string(),
  createdAt: z.date(),
});

const playlistItemWithContentOutput = playlistItemBaseOutput.extend({
  contentItem: contentItemOutput,
});

const playlistGetOutput = playlistOutput.extend({
  items: z.array(playlistItemWithContentOutput),
});

async function assertFixedCellHasRoom(
  tx: TenantPrisma.TransactionClient,
  playlistId: string,
  zone: string,
  excludeItemId?: string
) {
  const playlist = await tx.playlist.findUnique({
    where: { id: playlistId },
    select: { layoutPreset: true, cellConfig: true },
  });
  if (!playlist) throw new TRPCError({ code: 'NOT_FOUND' });
  if (resolveCellMode(playlist.layoutPreset, playlist.cellConfig, zone) !== 'FIXED') return;

  const existing = await tx.playlistItem.findFirst({
    where: { playlistId, zone, ...(excludeItemId ? { NOT: { id: excludeItemId } } : {}) },
  });
  if (existing) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This cell is fixed and already has content — remove it first.' });
  }
}

export const playlistsRouter = router({
  list: tenantProcedure
    .output(z.array(playlistListOutput))
    .query(({ ctx }) =>
      ctx.db.playlist.findMany({ include: { _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' } })
    ),

  get: tenantProcedure
    .input(z.object({ id: z.string() }))
    .output(playlistGetOutput)
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
    .output(playlistOutput)
    .mutation(({ ctx, input }) =>
      ctx.db.playlist.create({ data: { ...input, createdBy: ctx.session.user.id } })
    ),

  update: tenantProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      isDefault: z.boolean().optional(),
      layoutPreset: z.string().nullable().optional(),
      cellConfig: z.array(z.object({ cellId: z.string(), mode: z.enum(['FIXED', 'DYNAMIC']) })).optional(),
    }))
    .output(playlistOutput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.layoutPreset && !GRID_PRESETS.some((p) => p.id === data.layoutPreset)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown layout preset' });
      }
      if (data.isDefault) {
        // Ensure only one default playlist per tenant
        await ctx.db.playlist.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } });
      }
      return ctx.db.playlist.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .output(playlistOutput)
    .mutation(({ ctx, input }) => ctx.db.playlist.delete({ where: { id: input.id } })),

  addItem: tenantProcedure
    .input(z.object({
      playlistId: z.string(),
      contentItemId: z.string(),
      duration: z.number().min(1).default(10),
      transition: z.enum(['FADE', 'SLIDE_LEFT', 'SLIDE_RIGHT', 'ZOOM', 'NONE']).default('FADE'),
      zone: z.string().default('main'),
    }))
    .output(playlistItemWithContentOutput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        await assertFixedCellHasRoom(tx, input.playlistId, input.zone);
        const agg = await tx.playlistItem.aggregate({
          where: { playlistId: input.playlistId },
          _max: { position: true },
        });
        const position = (agg._max.position ?? -1) + 1;
        return tx.playlistItem.create({ data: { ...input, position }, include: { contentItem: true } });
      });
    }),

  removeItem: tenantProcedure
    .input(z.object({ id: z.string() }))
    .output(playlistItemBaseOutput)
    .mutation(({ ctx, input }) => ctx.db.playlistItem.delete({ where: { id: input.id } })),

  reorderItems: tenantProcedure
    .input(z.object({
      playlistId: z.string(),
      itemIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.itemIds.map((id, position) =>
          // playlistId in where ensures items belong to this playlist (ownership + FK guard)
          ctx.db.playlistItem.update({ where: { id, playlistId: input.playlistId }, data: { position } })
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
    .output(playlistItemBaseOutput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.zone === undefined) {
        return ctx.db.playlistItem.update({ where: { id }, data });
      }
      return ctx.db.$transaction(async (tx) => {
        const item = await tx.playlistItem.findUnique({ where: { id }, select: { playlistId: true } });
        if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
        await assertFixedCellHasRoom(tx, item.playlistId, data.zone!, id);
        return tx.playlistItem.update({ where: { id }, data });
      });
    }),
});
