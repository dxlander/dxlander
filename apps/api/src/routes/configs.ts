import { z } from 'zod';
import { router, protectedProcedure, IdSchema } from '@dxlander/shared';
import { ConfigGenerationService, type ConfigType } from '../services/config-generation.service';

const GenerateConfigSchema = z.object({
  projectId: z.string(),
  analysisId: z.string().optional(), // If not provided, use latest analysis
  configType: z.enum(['docker', 'docker-compose', 'kubernetes', 'bash']),
});

export const configsRouter = router({
  /**
   * Generate new configuration files
   */
  generate: protectedProcedure.input(GenerateConfigSchema).mutation(async ({ input, ctx }) => {
    try {
      const { userId } = ctx;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // If no analysisId provided, get the latest one for this project
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

      // Generate config
      const configSetId = await ConfigGenerationService.generateConfig({
        projectId: input.projectId,
        analysisId,
        configType: input.configType as ConfigType,
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

        // Verify config belongs to user
        const configSet = await db.query.configSets.findFirst({
          where: and(
            eq(schema.configSets.id, input.configId),
            eq(schema.configSets.userId, userId)
          ),
        });

        if (!configSet) {
          throw new Error('Configuration not found or access denied');
        }

        // Update the file content
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

        // Verify config belongs to user and update
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
   * Update config metadata (environment variables, integrations, etc.)
   * This updates the _summary.json file on disk
   */
  updateMetadata: protectedProcedure
    .input(
      z.object({
        configId: z.string(),
        metadata: z.record(z.any()), // Flexible metadata object
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

        // Verify config belongs to user
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

        // Write updated metadata to _summary.json on disk
        const summaryPath = path.join(configSet.localPath, '_summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(input.metadata, null, 2), 'utf-8');

        // Update the configSet's updatedAt timestamp
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
