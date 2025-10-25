import { router } from '@dxlander/shared'
import { projectsRouter } from './projects'
import { analysisRouter } from './analysis'
import { deploymentsRouter } from './deployments'
import { deploymentTargetsRouter } from './deployment-targets'
import { integrationsRouter } from './integrations'
import { setupRouter } from './setup'
import { settingsRouter } from './settings'
import { configsRouter } from './configs'
import { aiProvidersRouter } from './ai-providers'

export const appRouter = router({
  setup: setupRouter,
  projects: projectsRouter,
  analysis: analysisRouter,
  deployments: deploymentsRouter,
  deploymentTargets: deploymentTargetsRouter,
  integrations: integrationsRouter,
  settings: settingsRouter,
  configs: configsRouter,
  aiProviders: aiProvidersRouter,
})

export type AppRouter = typeof appRouter