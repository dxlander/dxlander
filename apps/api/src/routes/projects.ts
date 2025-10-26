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
} from '@dxlander/shared';
import { db, schema } from '@dxlander/database';
import { eq, and, desc } from 'drizzle-orm';
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

const ImportGitHubSchema = z.object({
  repoUrl: z.string().min(1, 'Repository URL is required'),
  branch: z.string().optional(),
  token: z.string().optional(),
  projectName: z.string().optional(),
});

export const projectsRouter = router({
  /**
   * List all projects for the current user
   */
  list: protectedProcedure.input(PaginationSchema).query(async ({ input, ctx }) => {
    try {
      // Get user ID from context (guaranteed by protectedProcedure)
      const userId = ctx.userId!;

      const projects = await db.query.projects.findMany({
        where: eq(schema.projects.userId, userId),
        orderBy: [desc(schema.projects.createdAt)],
        limit: input.limit,
        offset: (input.page - 1) * input.limit,
      });

      // Get total count
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

  /**
   * Get a single project by ID
   */
  get: protectedProcedure.input(IdSchema).query(async ({ input, ctx }) => {
    try {
      const userId = ctx.userId!;

      const project = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, input.id), eq(schema.projects.userId, userId)),
      });

      if (!project) {
        return null;
      }

      return project;
    } catch (error) {
      console.error('Failed to get project:', error);
      throw new Error('Failed to fetch project');
    }
  }),

  /**
   * Import project from GitHub
   */
  importFromGitHub: protectedProcedure
    .input(ImportGitHubSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;

        // Parse GitHub URL
        const parsed = parseGitHubUrl(input.repoUrl);
        if (!parsed) {
          throw new Error(
            'Invalid GitHub URL format. Use: owner/repo or https://github.com/owner/repo'
          );
        }

        // Initialize GitHub service
        const githubService = new GitHubService(input.token);

        // Fetch repository metadata
        console.log(`📦 Importing ${parsed.owner}/${parsed.repo}...`);
        const { repoInfo, files, fileTree } = await githubService.cloneRepoMetadata(
          input.repoUrl,
          input.branch,
          input.token
        );

        // Generate project name - use provided name or generate random one
        let projectName: string;

        if (!input.projectName || input.projectName.trim() === '') {
          projectName = generateRandomProjectName();
        } else {
          projectName = input.projectName.trim();
          // Validate provided project name
          const nameValidation = validateProjectName(projectName);
          if (!nameValidation.valid) {
            throw new Error(nameValidation.error);
          }
        }

        // Generate source hash for duplicate detection
        const sourceHash = generateSourceHash(input.repoUrl, repoInfo.branch);

        // Check for duplicates
        const existingProject = await db.query.projects.findFirst({
          where: and(
            eq(schema.projects.userId, userId),
            eq(schema.projects.sourceHash, sourceHash)
          ),
        });

        if (existingProject) {
          throw new Error(`This repository has already been imported as "${existingProject.name}"`);
        }

        // Create project ID
        const projectId = randomUUID();
        const sourceUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;

        // Save files to ~/.dxlander/projects/<project-id>/
        const { filesCount, totalSize, localPath } = saveProjectFiles(projectId, files);

        // Create project record in database
        const projectData = {
          id: projectId,
          userId,
          name: projectName,
          description: repoInfo.description || undefined,
          sourceType: 'github' as const,
          sourceUrl,
          sourceBranch: repoInfo.branch,
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

        console.log(
          `✅ Imported "${projectName}" - ${filesCount} files (${(totalSize / 1024 / 1024).toFixed(2)} MB)`
        );

        // Return project with metadata
        return {
          project: projectData,
          metadata: {
            repoInfo,
            filesCount,
            totalSize,
            localPath,
            fileTreeSize: fileTree.length,
          },
        };
      } catch (error: any) {
        console.error('GitHub import failed:', error);

        // Provide user-friendly error messages
        if (error.message.includes('not found')) {
          throw new Error(
            'Repository not found. Make sure the URL is correct and you have access.'
          );
        }
        if (error.message.includes('rate limit')) {
          throw new Error(
            'GitHub API rate limit exceeded. Please try again later or provide a personal access token.'
          );
        }
        if (error.message.includes('authentication')) {
          throw new Error(
            'Authentication failed. Please provide a valid GitHub personal access token for private repositories.'
          );
        }

        throw error;
      }
    }),

  /**
   * Create a project (generic)
   */
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

  /**
   * Analyze project with AI
   */
  analyze: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;

        // Start AI analysis using the service
        // This will automatically update project status and run in background
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
   * Delete a project
   */
  delete: protectedProcedure.input(IdSchema).mutation(async ({ input, ctx }) => {
    try {
      const userId = ctx.userId!;

      // Verify ownership
      const project = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, input.id), eq(schema.projects.userId, userId)),
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Delete project
      await db.delete(schema.projects).where(eq(schema.projects.id, input.id));

      // Also delete related deployments
      await db.delete(schema.deployments).where(eq(schema.deployments.projectId, input.id));

      return { success: true };
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw new Error('Failed to delete project');
    }
  }),
});
