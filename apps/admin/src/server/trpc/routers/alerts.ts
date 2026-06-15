import { router, adminProcedure } from '../init';

export const alertsRouter = router({
  _placeholder: adminProcedure.query(() => null),
});
