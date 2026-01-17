import { z } from 'zod';
import { router, protectedProcedure, StartRecoverySessionSchema } from '@dxlander/shared';
import { DeploymentAgentService } from '../services/deployment-agent.service';
import { db, schema } from '@dxlander/database';
import { eq, and } from 'drizzle-orm';

/**
 * Sessions Router
 *
 * Manages AI-assisted deployment recovery sessions including:
 * - Starting new recovery sessions
 * - Getting session status and activity
 * - Cancelling active sessions
 */
export const sessionsRouter = router({
  /**
   * Start a new recovery session
   *
   * This initiates an AI-powered recovery session for a failed deployment.
   * The session runs asynchronously and progress can be tracked via SSE.
   */
  start: protectedProcedure.input(StartRecoverySessionSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    const { deploymentId, maxAttempts } = input;

    // Verify deployment exists and belongs to user
    const deployment = await db.query.deployments.findFirst({
      where: and(eq(schema.deployments.id, deploymentId), eq(schema.deployments.userId, userId)),
    });

    if (!deployment) {
      throw new Error('Deployment not found or access denied');
    }

    if (deployment.status !== 'failed') {
      throw new Error('Recovery can only be started for failed deployments');
    }

    // Check for existing active session
    const existingSession = await db.query.deploymentSessions.findFirst({
      where: and(
        eq(schema.deploymentSessions.deploymentId, deploymentId),
        eq(schema.deploymentSessions.status, 'active')
      ),
    });

    if (existingSession) {
      throw new Error('An active recovery session already exists for this deployment');
    }

    // Create agent service instance
    const agentService = new DeploymentAgentService();

    // Start the session
    const sessionId = await agentService.startRecoverySession({
      deploymentId,
      userId,
      maxAttempts,
    });

    // Run the agent loop in the background (don't await)
    // The client will track progress via SSE
    agentService.runAgentLoop().catch((error) => {
      console.error('Agent loop error:', error);
    });

    return {
      sessionId,
      message: 'Recovery session started. Track progress via SSE endpoint.',
    };
  }),

  /**
   * Get a session by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { sessionId } = input;

      const session = await DeploymentAgentService.getSession(sessionId, userId);

      if (!session) {
        throw new Error('Session not found or access denied');
      }

      // Parse JSON fields
      const fileChanges = session.fileChanges ? JSON.parse(session.fileChanges) : [];
      const agentContext = session.agentContext ? JSON.parse(session.agentContext) : undefined;
      const agentMessages = session.agentMessages ? JSON.parse(session.agentMessages) : undefined;

      return {
        ...session,
        fileChanges,
        agentContext,
        agentMessages,
        startedAt: session.startedAt?.toISOString(),
        completedAt: session.completedAt?.toISOString(),
        createdAt: session.createdAt?.toISOString(),
        updatedAt: session.updatedAt?.toISOString(),
      };
    }),

  /**
   * List sessions for a deployment
   */
  listForDeployment: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { deploymentId } = input;

      const sessions = await DeploymentAgentService.getSessionsForDeployment(deploymentId, userId);

      return sessions.map((session) => ({
        ...session,
        fileChanges: session.fileChanges ? JSON.parse(session.fileChanges) : [],
        startedAt: session.startedAt?.toISOString(),
        completedAt: session.completedAt?.toISOString(),
        createdAt: session.createdAt?.toISOString(),
        updatedAt: session.updatedAt?.toISOString(),
      }));
    }),

  /**
   * Get session activity log
   */
  getActivity: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { sessionId } = input;

      // Verify access
      const session = await DeploymentAgentService.getSession(sessionId, userId);

      if (!session) {
        throw new Error('Session not found or access denied');
      }

      const activity = await DeploymentAgentService.getSessionActivity(sessionId);

      return activity.map((log) => ({
        ...log,
        input: log.input ? JSON.parse(log.input) : undefined,
        output: log.output ? JSON.parse(log.output) : undefined,
        timestamp: log.timestamp?.toISOString(),
      }));
    }),

  /**
   * Cancel an active session
   */
  cancel: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { sessionId } = input;

      await DeploymentAgentService.cancelSession(sessionId, userId);

      return { success: true, message: 'Session cancelled' };
    }),
});
