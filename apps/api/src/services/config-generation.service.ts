/**
 * Config Generation Service
 *
 * Uses AI analysis results to generate deployment configuration files.
 * Always generates Docker + docker-compose.yml (universal deployment model).
 *
 * See: private_docs/deployment-restructure/00-OVERVIEW.md
 */

import { db, schema } from '@dxlander/database';
import {
  type DeploymentConfigRequest,
  type DeploymentConfigResult,
  type GenerateConfigOptions,
  getConfigDir,
  getProjectConfigsDir,
  isPathSafe,
} from '@dxlander/shared';
import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { AIProviderService } from './ai-provider.service';

export class ConfigGenerationService {
  /**
   * Generate configuration files based on AI analysis
   * Always generates Docker + docker-compose.yml
   */
  static async generateConfig(options: GenerateConfigOptions): Promise<string> {
    const { projectId, analysisId, userId } = options;

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)),
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const analysis = await db.query.analysisRuns.findFirst({
        where: eq(schema.analysisRuns.id, analysisId),
      });

      if (!analysis || !analysis.results) {
        throw new Error('Analysis results not found. Please run analysis first.');
      }

      if (analysis.status !== 'complete') {
        throw new Error(`Analysis is ${analysis.status}. Please wait for analysis to complete.`);
      }

      const aiProvider = await AIProviderService.getDefaultProvider(userId);

      if (!aiProvider) {
        throw new Error('No default AI provider configured');
      }

      const latestConfig = await db.query.configSets.findFirst({
        where: eq(schema.configSets.projectId, projectId),
        orderBy: [desc(schema.configSets.version)],
      });

      const newVersion = (latestConfig?.version || 0) + 1;

      const configSetId = randomUUID();
      const configName = `Docker Compose v${newVersion}`;

      const fs = await import('fs/promises');

      if (!project.localPath) {
        throw new Error('Project local path not found');
      }

      const configPath = getConfigDir(projectId, configSetId);
      const configsDir = getProjectConfigsDir(projectId);

      if (!isPathSafe(configsDir, configPath)) {
        throw new Error('Invalid config path detected. Configs must be in the configs directory.');
      }

      await fs.mkdir(configPath, { recursive: true });

      await db.insert(schema.configSets).values({
        id: configSetId,
        projectId,
        analysisRunId: analysisId,
        userId,
        name: configName,
        version: newVersion,
        localPath: configPath,
        generatedBy: aiProvider.provider,
        status: 'generating',
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.runConfigGeneration(configSetId, project, JSON.parse(analysis.results), userId).catch(
        (error) => {
          console.error('Background config generation failed:', error);
        }
      );

      return configSetId;
    } catch (error) {
      console.error('Failed to start config generation:', error);
      throw error;
    }
  }

  /**
   * Run the actual config generation (background task)
   */
  private static async runConfigGeneration(
    configSetId: string,
    project: any,
    analysisResults: any,
    userId: string
  ): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      const configSet = await db.query.configSets.findFirst({
        where: eq(schema.configSets.id, configSetId),
      });

      if (!configSet || !configSet.localPath) {
        throw new Error('Config set or localPath not found');
      }

      await this.logConfigActivity(
        configSetId,
        'start_generation',
        'Starting Docker + docker-compose.yml configuration generation'
      );

      const provider = await AIProviderService.getProvider({ userId });

      const request: DeploymentConfigRequest = {
        analysisResult: analysisResults,
        projectContext: {
          files: [],
          projectPath: configSet.localPath,
          readme: analysisResults.projectStructure.documentationFiles[0],
          onProgress: async (event) => {
            await this.logConfigActivity(
              configSetId,
              event.action || event.type,
              event.message || `${event.type}: ${event.action}`,
              event.details ? JSON.parse(event.details) : undefined
            );
          },
        },
        optimizeFor: 'speed' as const,
      };

      let configResult: DeploymentConfigResult | null = null;

      await this.logConfigActivity(
        configSetId,
        'ai_generation',
        'AI is generating Docker + docker-compose.yml configuration files'
      );

      try {
        configResult = await provider.generateDeploymentConfig(request);
        await this.logConfigActivity(
          configSetId,
          'ai_generation',
          `AI completed. Files: ${configResult.files.map((f) => f.fileName).join(', ')}`
        );
      } catch (error: any) {
        await this.logConfigActivity(
          configSetId,
          'ai_generation',
          `AI generation error: ${error.message}`
        );
        throw error;
      }

      if (configResult.files && configResult.files.length > 0) {
        // Deduplicate files by fileName - keep only the latest version of each file
        // This handles cases where AI writes the same file multiple times (e.g., validation loop)
        const fileMap = new Map<string, (typeof configResult.files)[0]>();
        for (const file of configResult.files) {
          const fileName = file.fileName || 'config.txt';
          fileMap.set(fileName, file); // Later entries overwrite earlier ones
        }
        const uniqueFiles = Array.from(fileMap.values());

        await this.logConfigActivity(
          configSetId,
          'save_files',
          `Saving ${uniqueFiles.length} unique files to database (${configResult.files.length} total writes)`
        );

        for (let i = 0; i < uniqueFiles.length; i++) {
          const file = uniqueFiles[i];
          const fileId = randomUUID();
          const fileName = file.fileName || 'config.txt';

          if (fileName === '_summary.json') {
            await this.logConfigActivity(
              configSetId,
              'skip_file',
              '_summary.json (kept on disk only)'
            );
            continue;
          }

          const fileExtension = fileName.split('.').pop() || 'txt';
          const fileType = fileExtension || 'text';

          if (!isPathSafe(configSet.localPath, fileName)) {
            await this.logConfigActivity(
              configSetId,
              'read_file',
              `Path traversal detected: ${fileName}`,
              { error: 'Path traversal detected' }
            );
            console.warn(`[Security] Blocked suspicious path: ${fileName}`);
            continue;
          }

          const filePath = path.join(configSet.localPath, fileName);
          let content = '';

          try {
            content = await fs.readFile(filePath, 'utf-8');
            await this.logConfigActivity(configSetId, 'read_file', `Read ${fileName}`, {
              size: content.length,
            });
          } catch (error) {
            console.warn(`Warning: Could not read ${fileName} from config folder`);
            await this.logConfigActivity(configSetId, 'read_file', `Failed to read ${fileName}`, {
              error: String(error),
            });
          }

          await db.insert(schema.configFiles).values({
            id: fileId,
            configSetId,
            fileName,
            fileType,
            content,
            description: file.description || null,
            order: i,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      const summaryPath = path.join(configSet.localPath, '_summary.json');
      try {
        await fs.access(summaryPath);
      } catch {
        await this.logConfigActivity(
          configSetId,
          'generation_failed',
          'AI failed to create _summary.json - required metadata file is missing'
        );
        throw new Error(
          'AI failed to create _summary.json. The model may not support tool calling or encountered an error. Please try a different model or provider.'
        );
      }

      const configSetFinal = await db.query.configSets.findFirst({
        where: eq(schema.configSets.id, configSetId),
      });

      const duration = configSetFinal?.startedAt
        ? Math.floor((new Date().getTime() - configSetFinal.startedAt.getTime()) / 1000)
        : 0;

      await db
        .update(schema.configSets)
        .set({
          status: 'complete',
          progress: 100,
          completedAt: new Date(),
          duration,
        })
        .where(eq(schema.configSets.id, configSetId));

      await this.logConfigActivity(
        configSetId,
        'generation_complete',
        `Configuration generated successfully in ${duration}s`
      );

      await db
        .update(schema.projects)
        .set({
          status: 'configured',
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, project.id));
    } catch (error: any) {
      await this.logConfigActivity(
        configSetId,
        'generation_failed',
        `Configuration generation failed: ${error.message}`
      );

      await db
        .update(schema.configSets)
        .set({
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        })
        .where(eq(schema.configSets.id, configSetId));
    }
  }

  /**
   * Get config set with all files
   */
  static async getConfigSet(configSetId: string, userId: string): Promise<any> {
    const configSet = await db.query.configSets.findFirst({
      where: eq(schema.configSets.id, configSetId),
    });

    if (!configSet) {
      return null;
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(schema.projects.id, configSet.projectId), eq(schema.projects.userId, userId)),
    });

    if (!project) {
      throw new Error('Unauthorized');
    }

    const files = await db.query.configFiles.findMany({
      where: eq(schema.configFiles.configSetId, configSetId),
      orderBy: [schema.configFiles.order],
    });

    let metadata = null;
    if (configSet.localPath) {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const summaryPath = path.join(configSet.localPath, '_summary.json');
        const summaryContent = await fs.readFile(summaryPath, 'utf-8');
        metadata = JSON.parse(summaryContent);
      } catch {
        // File doesn't exist or couldn't be read
      }
    }

    return {
      ...configSet,
      files,
      metadata,
    };
  }

  /**
   * List all config sets for a project
   */
  static async listConfigSets(projectId: string, userId: string): Promise<any[]> {
    const project = await db.query.projects.findFirst({
      where: and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const configSets = await db.query.configSets.findMany({
      where: eq(schema.configSets.projectId, projectId),
      orderBy: [desc(schema.configSets.createdAt)],
    });

    const configSetsWithCounts = await Promise.all(
      configSets.map(async (configSet) => {
        const files = await db.query.configFiles.findMany({
          where: eq(schema.configFiles.configSetId, configSet.id),
        });

        return {
          ...configSet,
          fileCount: files.length,
        };
      })
    );

    return configSetsWithCounts;
  }

  /**
   * Delete a config set
   */
  static async deleteConfigSet(configSetId: string, userId: string): Promise<void> {
    const configSet = await db.query.configSets.findFirst({
      where: eq(schema.configSets.id, configSetId),
    });

    if (!configSet) {
      throw new Error('Config set not found');
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(schema.projects.id, configSet.projectId), eq(schema.projects.userId, userId)),
    });

    if (!project) {
      throw new Error('Unauthorized');
    }

    await db.delete(schema.configFiles).where(eq(schema.configFiles.configSetId, configSetId));
    await db.delete(schema.configSets).where(eq(schema.configSets.id, configSetId));
  }

  /**
   * Log config generation activity
   */
  private static async logConfigActivity(
    configSetId: string,
    action: string,
    result?: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await db.insert(schema.configActivityLogs).values({
        id: randomUUID(),
        configSetId,
        action,
        result: result || null,
        details: details ? JSON.stringify(details) : null,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to log config activity:', error);
    }
  }

  /**
   * Get config generation progress and activity logs
   */
  static async getConfigProgress(configSetId: string): Promise<{
    status: string;
    progress: number;
    activityLog: Array<{
      id: string;
      action: string;
      result?: string;
      details?: any;
      timestamp: string;
    }>;
  }> {
    const configSet = await db.query.configSets.findFirst({
      where: eq(schema.configSets.id, configSetId),
    });

    if (!configSet) {
      throw new Error('Config set not found');
    }

    const logs = await db.query.configActivityLogs.findMany({
      where: eq(schema.configActivityLogs.configSetId, configSetId),
      orderBy: [desc(schema.configActivityLogs.timestamp)],
      limit: 50,
    });

    return {
      status: configSet.status,
      progress: configSet.progress || 0,
      activityLog: logs
        .map((log) => ({
          id: log.id,
          action: log.action,
          result: log.result || undefined,
          details: log.details ? JSON.parse(log.details) : undefined,
          timestamp: log.timestamp.toISOString(),
        }))
        .reverse(),
    };
  }
}
