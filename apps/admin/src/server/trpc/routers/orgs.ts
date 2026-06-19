import { router, adminProcedure } from '../init';

export const orgsRouter = router({
  _placeholder: adminProcedure.query(() => null),
});
