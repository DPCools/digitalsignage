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
import { apiKeysRouter } from './routers/apiKeys';
import { settingsRouter } from './routers/settings';
import { usersRouter } from './routers/users';
import { auditRouter } from './routers/audit';
import { pushRouter } from './routers/push';

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
  apiKeys: apiKeysRouter,
  settings: settingsRouter,
  users: usersRouter,
  audit: auditRouter,
  push: pushRouter,
});

export type AppRouter = typeof appRouter;
