import { router, adminProcedure } from '../init';

export const screensRouter = router({
  _placeholder: adminProcedure.query(() => null),
});
