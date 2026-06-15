import { router, adminProcedure } from '../init';

export const playlistsRouter = router({
  _placeholder: adminProcedure.query(() => null),
});
