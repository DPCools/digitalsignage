import { router } from './init';
import { orgsRouter } from './routers/orgs';
import { screensRouter } from './routers/screens';
import { screenGroupsRouter } from './routers/screen-groups';
import { contentRouter } from './routers/content';
import { templatesRouter } from './routers/templates';
import { playlistsRouter } from './routers/playlists';
import { schedulesRouter } from './routers/schedules';
import { alertsRouter } from './routers/alerts';
import { alertTemplatesRouter } from './routers/alertTemplates';
import { analyticsRouter } from './routers/analytics';

export const appRouter = router({
  orgs: orgsRouter,
  screens: screensRouter,
  screenGroups: screenGroupsRouter,
  content: contentRouter,
  templates: templatesRouter,
  playlists: playlistsRouter,
  schedules: schedulesRouter,
  alerts: alertsRouter,
  alertTemplates: alertTemplatesRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
