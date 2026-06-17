import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../init';
import { emitToOrg, emitToScreen } from '@/server/socket';
import type { EmergencyAlertConfig } from '@signflow/types';
import { TRPCError } from '@trpc/server';

const templateInput = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  backgroundColor: z.string().default('#FF0000'),
  textColor: z.string().default('#FFFFFF'),
  targetType: z.enum(['ALL', 'GROUPS', 'SCREENS']).default('ALL'),
  targetGroupIds: z.array(z.string()).default([]),
  targetScreenIds: z.array(z.string()).default([]),
  autoExpireMinutes: z.number().int().positive().optional(),
});

export const alertTemplatesRouter = router({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.alertTemplate.findMany({ orderBy: { name: 'asc' } })
  ),

  create: adminProcedure
    .input(templateInput)
    .mutation(async ({ ctx, input }) => {
      const { autoExpireMinutes, ...createData } = input;
      return ctx.db.alertTemplate.create({
        data: {
          ...createData,
          autoExpireMinutes: autoExpireMinutes ?? null,
          createdBy: ctx.session.user.id,
        },
      });
    }),

  update: adminProcedure
    .input(
      templateInput
        .omit({ autoExpireMinutes: true })
        .partial()
        .extend({
          id: z.string(),
          autoExpireMinutes: z.number().int().positive().nullable().optional(),
        })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, autoExpireMinutes, ...data } = input;
      const updateData = { ...data } as Record<string, unknown>;
      if (autoExpireMinutes !== undefined) {
        updateData.autoExpireMinutes = autoExpireMinutes ?? null;
      }
      try {
        return await ctx.db.alertTemplate.update({
          where: { id },
          data: updateData,
        });
      } catch (e: unknown) {
        if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2025') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
        }
        throw e;
      }
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const activeAlert = await ctx.db.emergencyAlert.findFirst({
        where: { templateId: input.id, isActive: true },
      });
      if (activeAlert) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot delete a template with an active alert. Deactivate the alert first.',
        });
      }
      return ctx.db.alertTemplate.delete({ where: { id: input.id } });
    }),

  trigger: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Load the template by id
      const template = await ctx.db.alertTemplate.findUnique({ where: { id: input.id } });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });

      // Resolve target screen IDs based on targetType
      let screenIds: string[] = [];
      if (template.targetType === 'ALL') {
        screenIds = [];
      } else if (template.targetType === 'GROUPS') {
        const screens = await ctx.db.screen.findMany({
          where: { groupId: { in: template.targetGroupIds } },
          select: { id: true },
        });
        screenIds = screens.map((s) => s.id);
        if (screenIds.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No screens found in the specified groups' });
        }
      } else if (template.targetType === 'SCREENS') {
        screenIds = template.targetScreenIds;
      }

      // Clear existing active alerts from player screens first (before transaction)
      const existingActive = await ctx.db.emergencyAlert.findMany({ where: { isActive: true } });
      for (const existing of existingActive) {
        if (existing.screenIds.length === 0) {
          emitToOrg(ctx.orgSlug, 'alert:clear');
        } else {
          existing.screenIds.forEach((id) => emitToScreen(ctx.orgSlug, id, 'alert:clear'));
        }
      }

      // Deactivate existing alerts and create the new one atomically
      const alert = await ctx.db.$transaction(async (tx) => {
        await tx.emergencyAlert.updateMany({ where: { isActive: true }, data: { isActive: false } });
        return tx.emergencyAlert.create({
          data: {
            title: template.title,
            message: template.message,
            backgroundColor: template.backgroundColor,
            textColor: template.textColor,
            templateId: template.id,
            screenIds,
            isActive: true,
            expiresAt: template.autoExpireMinutes
              ? new Date(Date.now() + template.autoExpireMinutes * 60_000)
              : undefined,
            createdBy: ctx.session.user.id,
          },
        });
      });

      // Emit socket events
      const payload: EmergencyAlertConfig = {
        id: alert.id,
        title: alert.title,
        message: alert.message,
        backgroundColor: alert.backgroundColor,
        textColor: alert.textColor,
        screenIds: alert.screenIds,
        isActive: true,
        expiresAt: alert.expiresAt?.toISOString(),
      };

      if (screenIds.length === 0) {
        emitToOrg(ctx.orgSlug, 'alert:emergency', payload);
      } else {
        alert.screenIds.forEach((id) => emitToScreen(ctx.orgSlug, id, 'alert:emergency', payload));
      }

      return alert;
    }),
});
