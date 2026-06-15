import { router, adminProcedure } from '../init';

export const schedulesRouter = router({
  _placeholder: adminProcedure.query(() => null),
});
