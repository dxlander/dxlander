import { router } from '@dxlander/shared'
import { projectsRouter } from './projects'
import { analysisRouter } from './analysis'
import { deploymentsRouter } from './deployments'
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
  integrations: integrationsRouter,
  settings: settingsRouter,
  configs: configsRouter,
  aiProviders: aiProvidersRouter,
})

export type AppRouter = typeof appRouter