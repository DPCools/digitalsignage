import { router, adminProcedure } from '../init';

export const templatesRouter = router({
  _placeholder: adminProcedure.query(() => null),
});
