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
