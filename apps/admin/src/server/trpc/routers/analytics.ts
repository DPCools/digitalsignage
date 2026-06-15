import { router, adminProcedure } from '../init';

export const analyticsRouter = router({
  _placeholder: adminProcedure.query(() => null),
});
