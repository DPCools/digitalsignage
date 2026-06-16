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
          // undefined = leave unchanged; null/'' = clear; string = set new date
          endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.schedule.delete({ where: { id: input.id } })),
});
