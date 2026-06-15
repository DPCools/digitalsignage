import { router, adminProcedure } from '../init';

export const screenGroupsRouter = router({
  _placeholder: adminProcedure.query(() => null),
});
