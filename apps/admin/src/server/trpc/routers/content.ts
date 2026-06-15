import { router, adminProcedure } from '../init';

export const contentRouter = router({
  _placeholder: adminProcedure.query(() => null),
});
