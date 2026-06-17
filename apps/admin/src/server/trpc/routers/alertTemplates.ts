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
    .input(templateInput.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, autoExpireMinutes, ...data } = input;
      const updateData: any = { ...data };
      if (autoExpireMinutes !== undefined) {
        updateData.autoExpireMinutes = autoExpireMinutes ?? null;
      }
      return ctx.db.alertTemplate.update({
        where: { id },
        data: updateData,
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.alertTemplate.delete({ where: { id: input.id } });
    }),

  trigger: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Load the template by id
      const template = await ctx.db.alertTemplate.findUnique({ where: { id: input.id } });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });

      // Deactivate all existing active alerts
      await ctx.db.emergencyAlert.updateMany({ where: { isActive: true }, data: { isActive: false } });

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
      } else if (template.targetType === 'SCREENS') {
        screenIds = template.targetScreenIds;
      }

      // Create EmergencyAlert record
      const alert = await ctx.db.emergencyAlert.create({
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
