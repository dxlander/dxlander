import { z } from 'zod';
import {
  router,
  protectedProcedure,
  PaginationSchema,
  CreateDeploymentSchema,
} from '@dxlander/shared';
import { DeploymentExecutorService } from '../services/deployment-executor.service';
import { db, schema } from '@dxlander/database';
import { eq, and } from 'drizzle-orm';

const deploymentExecutor = new DeploymentExecutorService();

/**
 * Deployments Router
 *
 * Manages deployment lifecycle including:
 * - Creating and running deployments
 * - Starting, stopping, restarting containers
 * - Viewing logs and status
 * - Managing deployment notes
 */
export const deploymentsRouter = router({
  /**
   * List deployments
   * Can filter by project, config, or status
   */
  list: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().optional(),
          configSetId: z.string().optional(),
          status: z
            .enum([
              'pending',
              'pre_flight',
              'building',
              'deploying',
              'running',
              'stopped',
              'failed',
              'terminated',
            ])
            .optional(),
        })
        .merge(PaginationSchema)
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { projectId, configSetId, status, page, limit } = input;

      const offset = (page - 1) * limit;

      const deployments = await deploymentExecutor.listDeployments(userId, {
        projectId,
        configSetId,
        status,
        limit,
        offset,
      });

      return {
        deployments: deployments.map((d) => ({
          ...d,
          createdAt: d.createdAt?.toISOString(),
          updatedAt: d.updatedAt?.toISOString(),
          startedAt: d.startedAt?.toISOString(),
          completedAt: d.completedAt?.toISOString(),
          stoppedAt: d.stoppedAt?.toISOString(),
        })),
        total: deployments.length,
        page,
        limit,
      };
    }),

  /**
   * Get a single deployment by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { deploymentId } = input;

      const deployment = await db.query.deployments.findFirst({
        where: and(eq(schema.deployments.id, deploymentId), eq(schema.deployments.userId, userId)),
      });

      if (!deployment) {
        throw new Error('Deployment not found or access denied');
      }

      return {
        ...deployment,
        ports: deployment.ports ? JSON.parse(deployment.ports) : null,
        exposedPorts: deployment.exposedPorts ? JSON.parse(deployment.exposedPorts) : null,
        metadata: deployment.metadata ? JSON.parse(deployment.metadata) : null,
        createdAt: deployment.createdAt?.toISOString(),
        updatedAt: deployment.updatedAt?.toISOString(),
        startedAt: deployment.startedAt?.toISOString(),
        completedAt: deployment.completedAt?.toISOString(),
        stoppedAt: deployment.stoppedAt?.toISOString(),
      };
    }),

  /**
   * Create and start a new deployment (AI-only)
   */
  create: protectedProcedure.input(CreateDeploymentSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;

    const deployment = await deploymentExecutor.createDeployment({
      userId,
      projectId: input.projectId,
      configSetId: input.configSetId,
      platform: input.platform,
      name: input.name,
      environment: input.environment,
      notes: input.notes,
      customInstructions: input.customInstructions,
      maxAttempts: input.maxAttempts,
    });

    return {
      ...deployment,
      createdAt: deployment.createdAt?.toISOString(),
      updatedAt: deployment.updatedAt?.toISOString(),
      startedAt: deployment.startedAt?.toISOString(),
      completedAt: deployment.completedAt?.toISOString(),
      stoppedAt: deployment.stoppedAt?.toISOString(),
    };
  }),

  /**
   * Start a stopped deployment
   */
  start: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { deploymentId } = input;

      await deploymentExecutor.startDeployment(userId, deploymentId);

      return { success: true };
    }),

  /**
   * Stop a running deployment
   */
  stop: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { deploymentId } = input;

      await deploymentExecutor.stopDeployment(userId, deploymentId);

      return { success: true };
    }),

  /**
   * Restart a deployment
   */
  restart: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { deploymentId } = input;

      await deploymentExecutor.restartDeployment(userId, deploymentId);

      return { success: true };
    }),

  /**
   * Delete a deployment
   */
  delete: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().min(1),
        removeImage: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { deploymentId, removeImage } = input;

      await deploymentExecutor.deleteDeployment(userId, deploymentId, removeImage);

      return { success: true };
    }),

  /**
   * Get deployment logs (build and/or runtime)
   */
  getLogs: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().min(1),
        type: z.enum(['build', 'runtime', 'all']).optional().default('all'),
        tail: z.number().optional().default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { deploymentId, type, tail } = input;

      const logs = await deploymentExecutor.getLogs(userId, deploymentId, {
        type,
        tail,
      });

      return logs;
    }),

  /**
   * Get deployment activity logs
   */
  getActivityLogs: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { deploymentId } = input;

      const logs = await deploymentExecutor.getActivityLogs(userId, deploymentId);

      return {
        logs: logs.map((log) => ({
          ...log,
          timestamp: log.timestamp?.toISOString(),
        })),
      };
    }),

  /**
   * Get current deployment status
   */
  getStatus: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { deploymentId } = input;

      const status = await deploymentExecutor.getDeploymentStatus(userId, deploymentId);

      return { status };
    }),

  /**
   * Run pre-flight checks before deployment
   */
  runPreFlightChecks: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
        platform: z.enum(['docker', 'vercel', 'railway']).default('docker'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { configSetId, platform } = input;

      const result = await deploymentExecutor.runPreFlightChecks(userId, configSetId, platform);

      return result;
    }),

  /**
   * Update deployment notes
   */
  updateNotes: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().min(1),
        notes: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { deploymentId, notes } = input;

      const deployment = await db.query.deployments.findFirst({
        where: and(eq(schema.deployments.id, deploymentId), eq(schema.deployments.userId, userId)),
      });

      if (!deployment) {
        throw new Error('Deployment not found or access denied');
      }

      await db
        .update(schema.deployments)
        .set({
          notes,
          updatedAt: new Date(),
        })
        .where(eq(schema.deployments.id, deploymentId));

      return { success: true };
    }),
});
