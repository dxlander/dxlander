import { z } from 'zod';
import { router, protectedProcedure, IdSchema, resolveProjectPath } from '@dxlander/shared';
import { ConfigGenerationService } from '../services/config-generation.service';

const GenerateConfigSchema = z.object({
  projectId: z.string(),
  analysisId: z.string().optional(),
});

export const configsRouter = router({
  /**
   * Generate new configuration files (Docker + docker-compose.yml)
   */
  generate: protectedProcedure.input(GenerateConfigSchema).mutation(async ({ input, ctx }) => {
    try {
      const { userId } = ctx;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      let analysisId = input.analysisId;
      if (!analysisId) {
        const { db, schema } = await import('@dxlander/database');
        const { eq, and, desc } = await import('drizzle-orm');

        const latestAnalysis = await db.query.analysisRuns.findFirst({
          where: and(
            eq(schema.analysisRuns.projectId, input.projectId),
            eq(schema.analysisRuns.userId, userId),
            eq(schema.analysisRuns.status, 'complete')
          ),
          orderBy: [desc(schema.analysisRuns.version)],
        });

        if (!latestAnalysis) {
          throw new Error(
            'No completed analysis found for this project. Please run analysis first.'
          );
        }

        analysisId = latestAnalysis.id;
      }

      const configSetId = await ConfigGenerationService.generateConfig({
        projectId: input.projectId,
        analysisId,
        userId,
      });

      return {
        configSetId,
        status: 'generating',
        message: 'Configuration generation started',
      };
    } catch (error) {
      console.error('Failed to generate config:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to generate configuration');
    }
  }),

  /**
   * List all config sets for a project
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { userId } = ctx;
        if (!userId) {
          throw new Error('User not authenticated');
        }

        const configSets = await ConfigGenerationService.listConfigSets(input.projectId, userId);

        return configSets;
      } catch (error) {
        console.error('Failed to list configs:', error);
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error('Failed to list configurations');
      }
    }),

  /**
   * Get a specific config set with all files
   */
  get: protectedProcedure.input(IdSchema).query(async ({ input, ctx }) => {
    try {
      const { userId } = ctx;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const configSet = await ConfigGenerationService.getConfigSet(input.id, userId);

      if (!configSet) {
        return null;
      }

      return configSet;
    } catch (error) {
      console.error('Failed to get config:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to retrieve configuration');
    }
  }),

  /**
   * Delete a config set
   */
  delete: protectedProcedure.input(IdSchema).mutation(async ({ input, ctx }) => {
    try {
      const { userId } = ctx;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      await ConfigGenerationService.deleteConfigSet(input.id, userId);

      return { success: true };
    } catch (error) {
      console.error('Failed to delete config:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to delete configuration');
    }
  }),

  /**
   * Update a config file
   */
  updateFile: protectedProcedure
    .input(
      z.object({
        configId: z.string(),
        fileName: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId } = ctx;
        if (!userId) {
          throw new Error('User not authenticated');
        }
        const { db, schema } = await import('@dxlander/database');
        const { eq, and } = await import('drizzle-orm');

        const configSet = await db.query.configSets.findFirst({
          where: and(
            eq(schema.configSets.id, input.configId),
            eq(schema.configSets.userId, userId)
          ),
        });

        if (!configSet) {
          throw new Error('Configuration not found or access denied');
        }

        await db
          .update(schema.configFiles)
          .set({
            content: input.content,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.configFiles.configSetId, input.configId),
              eq(schema.configFiles.fileName, input.fileName)
            )
          );

        return { success: true, message: 'File updated successfully' };
      } catch (error) {
        console.error('Failed to update file:', error);
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error('Failed to update file');
      }
    }),

  /**
   * Update deployment notes for a config
   */
  updateNotes: protectedProcedure
    .input(
      z.object({
        configId: z.string(),
        notes: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId } = ctx;
        if (!userId) {
          throw new Error('User not authenticated');
        }
        const { db, schema } = await import('@dxlander/database');
        const { eq, and } = await import('drizzle-orm');

        await db
          .update(schema.configSets)
          .set({
            notes: input.notes,
            updatedAt: new Date(),
          })
          .where(
            and(eq(schema.configSets.id, input.configId), eq(schema.configSets.userId, userId))
          );

        return { success: true, message: 'Notes updated successfully' };
      } catch (error) {
        console.error('Failed to update notes:', error);
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error('Failed to update notes');
      }
    }),

  /**
   * Get config generation logs
   */
  getLogs: protectedProcedure.input(IdSchema).query(async ({ input, ctx }) => {
    try {
      const { userId } = ctx;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { db, schema } = await import('@dxlander/database');
      const { eq } = await import('drizzle-orm');

      const configSet = await db.query.configSets.findFirst({
        where: eq(schema.configSets.id, input.id),
      });

      if (!configSet) {
        throw new Error('Configuration not found');
      }

      if (configSet.userId !== userId) {
        throw new Error('Unauthorized: You do not have access to this configuration');
      }

      const logs = await ConfigGenerationService.getConfigProgress(input.id);

      return logs;
    } catch (error) {
      console.error('Failed to get config logs:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to retrieve configuration logs');
    }
  }),

  /**
   * Update config metadata (environment variables, integrations, etc.)
   */
  updateMetadata: protectedProcedure
    .input(
      z.object({
        configId: z.string(),
        metadata: z.record(z.any()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId } = ctx;
        if (!userId) {
          throw new Error('User not authenticated');
        }
        const { db, schema } = await import('@dxlander/database');
        const { eq, and } = await import('drizzle-orm');
        const fs = await import('fs/promises');
        const path = await import('path');

        const configSet = await db.query.configSets.findFirst({
          where: and(
            eq(schema.configSets.id, input.configId),
            eq(schema.configSets.userId, userId)
          ),
        });

        if (!configSet) {
          throw new Error('Configuration not found or access denied');
        }

        if (!configSet.localPath) {
          throw new Error('Configuration local path not found');
        }

        const resolvedPath = resolveProjectPath(configSet.localPath);
        if (!resolvedPath) {
          throw new Error('Could not resolve configuration path');
        }

        const summaryPath = path.join(resolvedPath, '_summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(input.metadata, null, 2), 'utf-8');

        await db
          .update(schema.configSets)
          .set({ updatedAt: new Date() })
          .where(eq(schema.configSets.id, input.configId));

        return { success: true, message: 'Metadata updated successfully' };
      } catch (error) {
        console.error('Failed to update metadata:', error);
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error('Failed to update metadata');
      }
    }),
});
