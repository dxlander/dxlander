import { z } from 'zod'
import { router, protectedProcedure, IdSchema } from '@dxlander/shared'
import { deploymentService } from '../services/deployment.service'

/**
 * Deployment Targets Router
 * 
 * Manages platform-specific deployment credentials (Vercel, Railway, AWS, etc.)
 * This is different from deploymentsRouter which manages actual deployment runs
 */
export const deploymentTargetsRouter = router({
  /**
   * Get all deployment targets for the authenticated user
   */
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId!
      const credentials = await deploymentService.getDeploymentCredentials(userId)
      return credentials
    }),

  /**
   * Get a single deployment target by ID
   */
  getById: protectedProcedure
    .input(IdSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId!
      const credential = await deploymentService.getDeploymentCredential(input.id, userId)
      
      if (!credential) {
        throw new Error('Deployment target not found')
      }

      return credential
    }),

  /**
   * Create a new deployment target
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, 'Name is required'),
      platform: z.enum([
        'vercel',
        'railway',
        'netlify',
        'aws',
        'gcp',
        'azure',
        'docker-registry',
        'kubernetes',
        'render',
        'fly-io',
        'digital-ocean',
        'heroku'
      ]),
      apiKey: z.string().optional(),
      config: z.record(z.any()).optional(),
      settings: z.record(z.any()).optional(),
      isDefault: z.boolean().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId!
      const credential = await deploymentService.createDeploymentCredential({
        userId,
        name: input.name,
        platform: input.platform,
        apiKey: input.apiKey,
        config: input.config,
        settings: input.settings,
        isDefault: input.isDefault
      })

      return {
        success: true,
        credential
      }
    }),

  /**
   * Update an existing deployment target
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      apiKey: z.string().optional(),
      config: z.record(z.any()).optional(),
      settings: z.record(z.any()).optional(),
      isActive: z.boolean().optional(),
      isDefault: z.boolean().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId!
      const { id, ...updateData } = input

      const credential = await deploymentService.updateDeploymentCredential(
        id,
        userId,
        updateData
      )

      if (!credential) {
        throw new Error('Deployment target not found')
      }

      return {
        success: true,
        credential
      }
    }),

  /**
   * Delete a deployment target
   */
  delete: protectedProcedure
    .input(IdSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId!
      await deploymentService.deleteDeploymentCredential(input.id, userId)

      return {
        success: true,
        message: 'Deployment target deleted successfully'
      }
    }),

  /**
   * Set a target as the default
   */
  setDefault: protectedProcedure
    .input(IdSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId!
      const credential = await deploymentService.setDefaultCredential(input.id, userId)

      if (!credential) {
        throw new Error('Deployment target not found')
      }

      return {
        success: true,
        credential
      }
    }),

  /**
   * Test connection to deployment platform
   */
  testConnection: protectedProcedure
    .input(IdSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId!
      const result = await deploymentService.testConnection(input.id, userId)

      return result
    }),

  /**
   * Get available deployment platforms
   */
  listPlatforms: protectedProcedure
    .query(async () => {
      return [
        {
          id: 'vercel',
          name: 'Vercel',
          description: 'Deploy to Vercel for frontend applications',
          icon: 'vercel',
          category: 'paas',
          requiresApiKey: true,
          configFields: [
            { name: 'teamId', label: 'Team ID', type: 'text', required: false },
            { name: 'projectId', label: 'Project ID', type: 'text', required: false }
          ]
        },
        {
          id: 'railway',
          name: 'Railway',
          description: 'Deploy to Railway for full-stack applications',
          icon: 'railway',
          category: 'paas',
          requiresApiKey: true,
          configFields: [
            { name: 'projectId', label: 'Project ID', type: 'text', required: false },
            { name: 'environment', label: 'Environment', type: 'text', required: false }
          ]
        },
        {
          id: 'netlify',
          name: 'Netlify',
          description: 'Deploy to Netlify for static sites and serverless functions',
          icon: 'netlify',
          category: 'paas',
          requiresApiKey: true,
          configFields: [
            { name: 'siteId', label: 'Site ID', type: 'text', required: false }
          ]
        },
        {
          id: 'aws',
          name: 'AWS',
          description: 'Deploy to Amazon Web Services',
          icon: 'aws',
          category: 'cloud',
          requiresApiKey: false,
          configFields: [
            { name: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
            { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
            { name: 'region', label: 'Region', type: 'text', required: true, default: 'us-east-1' }
          ]
        },
        {
          id: 'gcp',
          name: 'Google Cloud Platform',
          description: 'Deploy to Google Cloud',
          icon: 'gcp',
          category: 'cloud',
          requiresApiKey: false,
          configFields: [
            { name: 'projectId', label: 'Project ID', type: 'text', required: true },
            { name: 'serviceAccount', label: 'Service Account JSON', type: 'textarea', required: true }
          ]
        },
        {
          id: 'azure',
          name: 'Microsoft Azure',
          description: 'Deploy to Microsoft Azure',
          icon: 'azure',
          category: 'cloud',
          requiresApiKey: false,
          configFields: [
            { name: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
            { name: 'tenantId', label: 'Tenant ID', type: 'text', required: true },
            { name: 'clientId', label: 'Client ID', type: 'text', required: true },
            { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true }
          ]
        },
        {
          id: 'docker-registry',
          name: 'Docker Registry',
          description: 'Push images to Docker Hub or private registry',
          icon: 'docker',
          category: 'container',
          requiresApiKey: false,
          configFields: [
            { name: 'registry', label: 'Registry URL', type: 'text', required: true, default: 'docker.io' },
            { name: 'username', label: 'Username', type: 'text', required: true },
            { name: 'password', label: 'Password/Token', type: 'password', required: true }
          ]
        },
        {
          id: 'render',
          name: 'Render',
          description: 'Deploy to Render for web services and databases',
          icon: 'render',
          category: 'paas',
          requiresApiKey: true,
          configFields: []
        },
        {
          id: 'fly-io',
          name: 'Fly.io',
          description: 'Deploy to Fly.io for edge applications',
          icon: 'fly',
          category: 'paas',
          requiresApiKey: true,
          configFields: []
        },
        {
          id: 'digital-ocean',
          name: 'DigitalOcean',
          description: 'Deploy to DigitalOcean App Platform',
          icon: 'digitalocean',
          category: 'cloud',
          requiresApiKey: true,
          configFields: []
        },
        {
          id: 'heroku',
          name: 'Heroku',
          description: 'Deploy to Heroku',
          icon: 'heroku',
          category: 'paas',
          requiresApiKey: true,
          configFields: []
        },
        {
          id: 'kubernetes',
          name: 'Kubernetes',
          description: 'Deploy to any Kubernetes cluster',
          icon: 'kubernetes',
          category: 'container',
          requiresApiKey: false,
          configFields: [
            { name: 'kubeconfig', label: 'Kubeconfig', type: 'textarea', required: true },
            { name: 'context', label: 'Context', type: 'text', required: false },
            { name: 'namespace', label: 'Namespace', type: 'text', required: false, default: 'default' }
          ]
        }
      ]
    })
})
