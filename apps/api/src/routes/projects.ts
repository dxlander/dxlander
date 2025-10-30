import { z } from 'zod';
import {
  router,
  protectedProcedure,
  PaginationSchema,
  IdSchema,
  GitHubService,
  parseGitHubUrl,
  generateSourceHash,
  validateProjectName,
  generateRandomProjectName,
  saveProjectFiles,
  deleteProjectFiles,
} from '@dxlander/shared';
import { db, schema } from '@dxlander/database';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  sourceType: z.enum(['github', 'gitlab', 'bitbucket', 'zip', 'git']),
  sourceUrl: z.string().optional(),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
        size: z.number(),
      })
    )
    .optional(),
});

const ImportProjectSchema = z.discriminatedUnion('sourceType', [
  z.object({
    sourceType: z.literal('github'),
    repoUrl: z.string().url(),
    branch: z.string().optional(),
    token: z.string().optional(),
    projectName: z.string().optional(),
  }),
  z.object({
    sourceType: z.literal('gitlab'),
    gitlabUrl: z.string().url().optional(),
    gitlabToken: z.string(),
    gitlabProject: z.string(),
    gitlabBranch: z.string().optional(),
    projectName: z.string().optional(),
  }),
  z.object({
    sourceType: z.literal('bitbucket'),
    bitbucketUsername: z.string(),
    bitbucketPassword: z.string(),
    bitbucketWorkspace: z.string(),
    bitbucketRepo: z.string(),
    bitbucketBranch: z.string().optional(),
    projectName: z.string().optional(),
  }),
]);
export const projectsRouter = router({
  list: protectedProcedure.input(PaginationSchema).query(async ({ input, ctx }) => {
    try {
      const userId = ctx.userId!;

      const projects = await db.query.projects.findMany({
        where: eq(schema.projects.userId, userId),
        orderBy: [desc(schema.projects.createdAt)],
        limit: input.limit,
        offset: (input.page - 1) * input.limit,
      });

      const allProjects = await db.query.projects.findMany({
        where: eq(schema.projects.userId, userId),
      });

      return {
        projects,
        total: allProjects.length,
        page: input.page,
        limit: input.limit,
      };
    } catch (error) {
      console.error('Failed to list projects:', error);
      throw new Error('Failed to fetch projects');
    }
  }),

  get: protectedProcedure.input(IdSchema).query(async ({ input, ctx }) => {
    try {
      const userId = ctx.userId!;
      const project = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, input.id), eq(schema.projects.userId, userId)),
      });

      if (!project) return null;
      return project;
    } catch (error) {
      console.error('Failed to get project:', error);
      throw new Error('Failed to fetch project');
    }
  }),

  import: protectedProcedure.input(ImportProjectSchema).mutation(async ({ input, ctx }) => {
    try {
      const userId = ctx.userId!;
      let projectPath: string | undefined;
      let sourceUrl: string | undefined;
      let sourceBranch: string | undefined;

      if (input.sourceType === 'github') {
        if (!input.repoUrl?.trim()) {
          throw new Error('GitHub repository URL is required');
        }
        const parsed = parseGitHubUrl(input.repoUrl!);
        if (!parsed) throw new Error('Invalid GitHub URL format.');

        const githubService = new GitHubService(input.token);
        const { repoInfo, files, fileTree } = await githubService.cloneRepoMetadata(
          input.repoUrl!,
          input.branch,
          input.token
        );

        const projectName = input.projectName?.trim() || generateRandomProjectName();
        const nameValidation = validateProjectName(projectName);
        if (!nameValidation.valid) throw new Error(nameValidation.error);

        const sourceHash = generateSourceHash(input.repoUrl!, repoInfo.branch);
        const existingProject = await db.query.projects.findFirst({
          where: and(
            eq(schema.projects.userId, userId),
            eq(schema.projects.sourceHash, sourceHash)
          ),
        });
        if (existingProject)
          throw new Error(`This repository is already imported as "${existingProject.name}"`);

        const projectId = randomUUID();
        sourceUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
        sourceBranch = repoInfo.branch;
        const { filesCount, totalSize, localPath } = saveProjectFiles(projectId, files);

        const projectData = {
          id: projectId,
          userId,
          name: projectName,
          description: repoInfo.description || undefined,
          sourceType: 'github' as const,
          sourceUrl,
          sourceBranch,
          sourceHash,
          localPath,
          filesCount,
          projectSize: totalSize,
          language: repoInfo.language || undefined,
          status: 'imported' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.insert(schema.projects).values(projectData);

        return {
          project: projectData,
          metadata: { repoInfo, filesCount, totalSize, localPath, fileTreeSize: fileTree.length },
        };
      }

      if (input.sourceType === 'gitlab') {
        const { importFromGitLab } = await import('@dxlander/shared');

        const result = await importFromGitLab(
          {
            url: input.gitlabUrl,
            token: input.gitlabToken!,
          },
          input.gitlabProject!,
          input.gitlabBranch
        );

        projectPath = result.extractPath;
        sourceUrl = result.repoInfo.url;
        sourceBranch = result.branch;
      }

      if (input.sourceType === 'bitbucket') {
        const { importFromBitbucket } = await import('@dxlander/shared');

        const result = await importFromBitbucket(
          {
            username: input.bitbucketUsername!,
            appPassword: input.bitbucketPassword!,
          },
          input.bitbucketWorkspace!,
          input.bitbucketRepo!,
          input.bitbucketBranch
        );

        projectPath = result.extractPath;
        sourceUrl = result.repoInfo.url;
        sourceBranch = result.branch;
      }

      if (input.sourceType === 'gitlab' || input.sourceType === 'bitbucket') {
        const projectId = randomUUID();
        const projectName = input.projectName?.trim() || generateRandomProjectName();

        const nameValidation = validateProjectName(projectName);
        if (!nameValidation.valid) throw new Error(nameValidation.error);

        const sourceHash = generateSourceHash(sourceUrl!, sourceBranch!);

        const existingProject = await db.query.projects.findFirst({
          where: and(
            eq(schema.projects.userId, userId),
            eq(schema.projects.sourceHash, sourceHash)
          ),
        });
        if (existingProject)
          throw new Error(`This repository is already imported as "${existingProject.name}"`);

        // Calculate filesCount and projectSize from extracted directory
        let filesCount = 0;
        let totalSize = 0;
        if (projectPath) {
          const fs = await import('fs');
          const path = await import('path');
          const traverse = (currentPath: string) => {
            const entries = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(currentPath, entry.name);
              if (entry.isDirectory()) {
                traverse(fullPath);
              } else {
                filesCount++;
                totalSize += fs.statSync(fullPath).size;
              }
            }
          };
          traverse(projectPath);
        }

        const projectData = {
          id: projectId,
          userId,
          name: projectName,
          description: undefined,
          sourceType: input.sourceType,
          sourceUrl,
          sourceBranch,
          sourceHash,
          localPath: projectPath,
          filesCount,
          projectSize: totalSize,
          language: undefined,
          status: 'imported' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.insert(schema.projects).values(projectData);
        return { project: projectData, metadata: { localPath: projectPath } };
      }

      throw new Error('Unsupported source type');
    } catch (error: any) {
      console.error('Import failed:', error);
      throw new Error(error.message || 'Failed to import project');
    }
  }),

  create: protectedProcedure.input(CreateProjectSchema).mutation(async ({ input, ctx }) => {
    try {
      const userId = ctx.userId!;
      const projectId = randomUUID();
      const sourceHash = generateSourceHash(input.sourceUrl || `upload-${projectId}`, 'default');

      const projectData = {
        id: projectId,
        userId,
        name: input.name,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        sourceHash,
        status: 'imported' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(schema.projects).values(projectData);
      return projectData;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw new Error('Failed to create project');
    }
  }),

  analyze: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;
        const { AIAnalysisService } = await import('../services/ai-analysis.service');
        const analysisId = await AIAnalysisService.analyzeProject(input.projectId, userId);

        return {
          analysisId,
          projectId: input.projectId,
          status: 'analyzing',
          message: 'AI analysis started in background',
        };
      } catch (error: any) {
        console.error('Failed to start analysis:', error);
        throw new Error(error.message || 'Failed to start project analysis');
      }
    }),

  /**
   * Delete a project and all associated data
   */
  delete: protectedProcedure.input(IdSchema).mutation(async ({ input, ctx }) => {
    const projectId = input.id;
    const userId = ctx.userId;
    if (!userId) throw new Error('Unauthorized');

    try {
      // Verify ownership
      const project = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)),
      });

      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Perform deletion in a transaction for data consistency
      await db.transaction(async (tx) => {
        // First, get all config sets for this project to delete related records
        const configSetsToDelete = await tx
          .select({ id: schema.configSets.id })
          .from(schema.configSets)
          .where(eq(schema.configSets.projectId, projectId));

        const configSetIds = configSetsToDelete.map((cs) => cs.id);

        // 1. Delete config activity logs (child records)
        if (configSetIds.length > 0) {
          await tx
            .delete(schema.configActivityLogs)
            .where(inArray(schema.configActivityLogs.configSetId, configSetIds));

          // 2. Delete config files
          await tx
            .delete(schema.configFiles)
            .where(inArray(schema.configFiles.configSetId, configSetIds));
        }

        // 3. Delete config sets
        await tx.delete(schema.configSets).where(eq(schema.configSets.projectId, projectId));

        // 4. Delete build runs
        await tx.delete(schema.buildRuns).where(eq(schema.buildRuns.projectId, projectId));

        // 5. Delete analysis runs
        await tx.delete(schema.analysisRuns).where(eq(schema.analysisRuns.projectId, projectId));

        // 6. Delete deployments
        await tx.delete(schema.deployments).where(eq(schema.deployments.projectId, projectId));

        // 7. Finally delete the project
        await tx.delete(schema.projects).where(eq(schema.projects.id, projectId));
      });

      // Clean up file system (outside transaction)
      try {
        deleteProjectFiles(projectId);
        console.log(`[DELETE] Cleaned up project files: ${projectId}`);
      } catch (fileError) {
        console.error(`[DELETE] Failed to clean up project files: ${projectId}`, fileError);
        // Don't fail the operation, but log the error for monitoring
      }

      // Log successful deletion for audit purposes
      console.log(`[DELETE] Project deleted: ${projectId} by user: ${userId}`);

      return {
        success: true,
        deletedProject: {
          id: projectId,
          name: project.name,
        },
      };
    } catch (error) {
      console.error('Failed to delete project:', {
        projectId,
        userId,
        error: error instanceof Error ? error.message : error,
      });

      if (error instanceof Error) {
        // Provide more specific error messages
        if (error.message.includes('Project not found')) {
          throw new Error('Project not found or access denied');
        }
      }

      throw new Error('Failed to delete project. Please try again later.');
    }
  }),
});
