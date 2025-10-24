/**
 * AI Analysis Service
 *
 * Orchestrates AI-powered project analysis using configured providers.
 * Integrates with Claude Agent SDK, reads project files, and saves results.
 */

import { db, schema } from '@dxlander/database'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import {
  ClaudeAgentProvider,
  encryptionService,
  type ProjectAnalysisResult,
  type ProjectContext
} from '@dxlander/shared'
import * as fs from 'fs'
import * as path from 'path'

interface ProjectFile {
  path: string
  content: string
  size: number
  isDirectory: boolean
}

export class AIAnalysisService {
  /**
   * Start project analysis
   */
  static async analyzeProject(projectId: string, userId: string): Promise<string> {
    try {
      // Get project
      const project = await db.query.projects.findFirst({
        where: and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.userId, userId)
        )
      })

      if (!project) {
        throw new Error('Project not found')
      }

      // Get default AI provider
      const aiProvider = await db.query.aiProviders.findFirst({
        where: and(
          eq(schema.aiProviders.userId, userId),
          eq(schema.aiProviders.isDefault, true),
          eq(schema.aiProviders.isActive, true)
        )
      })

      if (!aiProvider) {
        throw new Error('No default AI provider configured. Please configure an AI provider in settings.')
      }

      // Decrypt API key (encryption service already initialized)
      let apiKey: string | undefined
      if (aiProvider.encryptedApiKey) {
        apiKey = encryptionService.decryptFromStorage(aiProvider.encryptedApiKey)
      }

      // Get latest analysis version
      const latestAnalysis = await db.query.analysisRuns.findFirst({
        where: eq(schema.analysisRuns.projectId, projectId),
        orderBy: [desc(schema.analysisRuns.version)]
      })

      const newVersion = (latestAnalysis?.version || 0) + 1

      // Create analysis run record
      const analysisId = randomUUID()
      await db.insert(schema.analysisRuns).values({
        id: analysisId,
        projectId,
        userId,
        version: newVersion,
        status: 'analyzing',
        progress: 0,
        aiModel: aiProvider.settings ? JSON.parse(aiProvider.settings).model : 'claude-sonnet-4-5-20250929',
        aiProvider: aiProvider.provider,
        startedAt: new Date(),
        createdAt: new Date()
      })

      // Update project status
      await db.update(schema.projects)
        .set({
          status: 'analyzing',
          updatedAt: new Date()
        })
        .where(eq(schema.projects.id, projectId))

      // Run analysis in background (don't await)
      this.runAnalysis(analysisId, project, aiProvider, apiKey)
        .catch(error => {
          console.error('Background analysis failed:', error)
        })

      return analysisId
    } catch (error) {
      console.error('Failed to start analysis:', error)
      throw error
    }
  }

  /**
   * Run the actual AI analysis (background task)
   */
  private static async runAnalysis(
    analysisId: string,
    project: any,
    aiProvider: any,
    apiKey: string | undefined
  ): Promise<void> {
    try {
      // Log: Reading project files
      await this.logActivity(analysisId, 'read_files', 'in_progress', 'Reading project files from disk')

      // Read project files from local storage
      const projectFiles = await this.readProjectFiles(project.localPath)

      await this.logActivity(analysisId, 'read_files', 'complete', `Read ${projectFiles.length} files`, {
        fileCount: projectFiles.length
      })

      // Update progress
      await this.updateProgress(analysisId, 20)

      // Prepare project context with progress callback
      const context: ProjectContext = {
        files: projectFiles,
        projectPath: project.localPath, // Add absolute path to project root
        readme: projectFiles.find(f => f.path.toLowerCase().includes('readme'))?.content,
        packageJson: projectFiles.find(f => f.path === 'package.json')
          ? JSON.parse(projectFiles.find(f => f.path === 'package.json')!.content)
          : undefined,
        onProgress: async (event: { type: string; action?: string; details?: string; message?: string }) => {
          // Log real-time progress to database
          const action = event.action || event.type
          const result = event.message || event.details || 'Processing...'

          await this.logActivity(
            analysisId,
            action,
            'in_progress',
            result
          )

          // Update progress incrementally (30% to 90%)
          const currentProgress = await db.query.analysisRuns.findFirst({
            where: eq(schema.analysisRuns.id, analysisId)
          })

          if (currentProgress && currentProgress.progress !== null && currentProgress.progress < 90) {
            // Increment progress by small amounts
            const newProgress = Math.min(currentProgress.progress + 2, 89)
            await this.updateProgress(analysisId, newProgress)
          }
        }
      }

      // Log: Initializing AI provider
      await this.logActivity(analysisId, 'init_ai', 'in_progress', `Initializing ${aiProvider.provider}`)

      // Initialize AI provider
      const provider = new ClaudeAgentProvider()
      const settings = aiProvider.settings ? JSON.parse(aiProvider.settings) : {}

      await provider.initialize({
        provider: aiProvider.provider,
        apiKey,
        model: settings.model || 'claude-sonnet-4-5-20250929',
        settings
      })

      await this.logActivity(analysisId, 'init_ai', 'complete', 'AI provider initialized successfully')
      await this.updateProgress(analysisId, 30)

      // Log: Running AI analysis
      await this.logActivity(analysisId, 'ai_analysis', 'in_progress', 'AI is analyzing project structure...')

      // Run AI analysis
      const analysisResult: ProjectAnalysisResult = await provider.analyzeProject(context)

      await this.logActivity(analysisId, 'ai_analysis', 'complete', 'AI analysis completed', {
        frameworks: analysisResult.frameworks.map(f => f.name),
        language: analysisResult.language.primary
      })
      await this.updateProgress(analysisId, 90)

      // Save results
      await db.update(schema.analysisRuns)
        .set({
          status: 'complete',
          progress: 100,
          results: JSON.stringify(analysisResult),
          confidence: analysisResult.frameworks[0]?.confidence || 0,
          completedAt: new Date(),
          duration: Math.floor((Date.now() - (await db.query.analysisRuns.findFirst({
            where: eq(schema.analysisRuns.id, analysisId)
          }))!.startedAt!.getTime()) / 1000)
        })
        .where(eq(schema.analysisRuns.id, analysisId))

      // Update project status
      await db.update(schema.projects)
        .set({
          status: 'analyzed',
          language: analysisResult.language.primary,
          updatedAt: new Date()
        })
        .where(eq(schema.projects.id, project.id))

      await this.logActivity(analysisId, 'save_results', 'complete', 'Analysis results saved successfully')

      console.log(`✅ Analysis completed for project: ${project.name} (v${(await db.query.analysisRuns.findFirst({
        where: eq(schema.analysisRuns.id, analysisId)
      }))!.version})`)

    } catch (error: any) {
      console.error('Analysis execution failed:', error)

      // Log error
      await this.logActivity(analysisId, 'error', 'error', error.message)

      // Update analysis run with error
      await db.update(schema.analysisRuns)
        .set({
          status: 'failed',
          errorMessage: error.message,
          errorDetails: error.stack,
          completedAt: new Date()
        })
        .where(eq(schema.analysisRuns.id, analysisId))

      // Update project status
      await db.update(schema.projects)
        .set({
          status: 'failed',
          updatedAt: new Date()
        })
        .where(eq(schema.projects.id, project.id))
    }
  }

  /**
   * Read project files from disk
   */
  private static async readProjectFiles(localPath: string): Promise<ProjectFile[]> {
    const files: ProjectFile[] = []

    const readDir = async (dirPath: string, basePath: string = '') => {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.join(basePath, entry.name)

        // Skip common directories to ignore
        const ignorePatterns = ['node_modules', '.git', '.next', 'dist', 'build', '.turbo', 'coverage']
        if (entry.isDirectory() && ignorePatterns.some(p => entry.name === p)) {
          continue
        }

        if (entry.isDirectory()) {
          await readDir(fullPath, relativePath)
        } else {
          // Read file content (skip binary files)
          const ext = path.extname(entry.name).toLowerCase()
          const textExtensions = ['.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml', '.toml', '.env', '.gitignore', '.py', '.go', '.rs', '.java', '.php', '.rb', '.css', '.scss', '.html', '.vue', '.svelte']

          if (textExtensions.includes(ext) || entry.name.startsWith('.')) {
            try {
              const content = await fs.promises.readFile(fullPath, 'utf-8')
              const stats = await fs.promises.stat(fullPath)

              files.push({
                path: relativePath.replace(/\\/g, '/'), // Normalize path
                content,
                size: stats.size,
                isDirectory: false
              })
            } catch (error) {
              // Skip files that can't be read
              console.warn(`Could not read file: ${relativePath}`)
            }
          }
        }
      }
    }

    await readDir(localPath)
    return files
  }

  /**
   * Log analysis activity
   */
  private static async logActivity(
    analysisRunId: string,
    action: string,
    status: string,
    result: string,
    details?: any
  ): Promise<void> {
    const logId = randomUUID()

    await db.insert(schema.analysisActivityLogs).values({
      id: logId,
      analysisRunId,
      timestamp: new Date(),
      action,
      status,
      result,
      details: details ? JSON.stringify(details) : null,
      createdAt: new Date()
    })
  }

  /**
   * Update analysis progress
   */
  private static async updateProgress(analysisId: string, progress: number): Promise<void> {
    await db.update(schema.analysisRuns)
      .set({ progress })
      .where(eq(schema.analysisRuns.id, analysisId))
  }

  /**
   * Get analysis progress
   */
  static async getAnalysisProgress(analysisId: string): Promise<any> {
    const analysis = await db.query.analysisRuns.findFirst({
      where: eq(schema.analysisRuns.id, analysisId)
    })

    if (!analysis) {
      return null
    }

    // Get activity logs (ordered by timestamp DESC to get most recent first)
    const logs = await db.query.analysisActivityLogs.findMany({
      where: eq(schema.analysisActivityLogs.analysisRunId, analysisId),
      orderBy: [desc(schema.analysisActivityLogs.timestamp)],
      limit: 50 // Limit to last 50 logs for performance
    })

    // Map logs to expected frontend format
    const activityLog = logs.map(log => ({
      id: log.id,
      action: log.action,
      status: log.status,
      result: log.result || undefined,
      details: log.details ? (typeof log.details === 'string' ? JSON.parse(log.details) : log.details) : undefined,
      timestamp: log.timestamp.toISOString(),
      duration: undefined // TODO: Calculate duration if needed
    }))

    return {
      id: analysis.id,
      status: analysis.status,
      progress: analysis.progress || 0,
      currentAction: logs[0]?.action || 'Starting...',
      currentResult: logs[0]?.result || 'Initializing analysis',
      activityLog: activityLog.reverse(), // Reverse to show oldest first in UI
      results: analysis.results ? JSON.parse(analysis.results) : null,
      error: analysis.errorMessage
    }
  }

  /**
   * Get analysis results
   */
  static async getAnalysisResults(analysisId: string): Promise<ProjectAnalysisResult | null> {
    const analysis = await db.query.analysisRuns.findFirst({
      where: eq(schema.analysisRuns.id, analysisId)
    })

    if (!analysis || !analysis.results) {
      return null
    }

    return JSON.parse(analysis.results)
  }
}
