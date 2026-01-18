import { router } from '@dxlander/shared';
import { projectsRouter } from './projects';
import { analysisRouter } from './analysis';
import { deploymentsRouter } from './deployments';
import { deploymentTargetsRouter } from './deployment-targets';
import { secretsRouter } from './secrets';
import { configServicesRouter } from './config-services';
import { setupRouter } from './setup';
import { settingsRouter } from './settings';
import { configsRouter } from './configs';
import { aiProvidersRouter } from './ai-providers';
import { sessionsRouter } from './sessions';

export const appRouter = router({
  setup: setupRouter,
  projects: projectsRouter,
  analysis: analysisRouter,
  deployments: deploymentsRouter,
  deploymentTargets: deploymentTargetsRouter,
  secrets: secretsRouter,
  configServices: configServicesRouter,
  settings: settingsRouter,
  configs: configsRouter,
  aiProviders: aiProvidersRouter,
  sessions: sessionsRouter,
});

export type AppRouter = typeof appRouter;
