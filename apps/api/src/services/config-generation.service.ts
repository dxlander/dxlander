/**
 * Config Generation Service
 *
 * Uses AI analysis results to generate deployment configuration files.
 * Supports Docker, Docker Compose, Kubernetes, and Bash scripts.
 */

import { db, schema } from '@dxlander/database'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import * as path from 'path'
import {
  type DeploymentConfigRequest,
  type DeploymentConfigResult,
  getConfigDir
} from '@dxlander/shared'
import { AIProviderService } from './ai-provider.service'

export type ConfigType = 'docker' | 'docker-compose' | 'kubernetes' | 'bash'

interface GenerateConfigOptions {
  projectId: string
  analysisId: string
  configType: ConfigType
  userId: string
}

export class ConfigGenerationService {
  /**
   * Generate configuration files based on AI analysis
   */
  static async generateConfig(options: GenerateConfigOptions): Promise<string> {
    const { projectId, analysisId, configType, userId } = options

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

      // Get analysis results
      const analysis = await db.query.analysisRuns.findFirst({
        where: eq(schema.analysisRuns.id, analysisId)
      })

      if (!analysis || !analysis.results) {
        throw new Error('Analysis results not found. Please run analysis first.')
      }

      if (analysis.status !== 'complete') {
        throw new Error(`Analysis is ${analysis.status}. Please wait for analysis to complete.`)
      }

      // Get default AI provider info for tracking
      const aiProvider = await AIProviderService.getDefaultProvider(userId)

      if (!aiProvider) {
        throw new Error('No default AI provider configured')
      }

      // Get latest config version
      const latestConfig = await db.query.configSets.findFirst({
        where: eq(schema.configSets.projectId, projectId),
        orderBy: [desc(schema.configSets.version)]
      })

      const newVersion = (latestConfig?.version || 0) + 1

      // Create config set record
      const configSetId = randomUUID()
      const configName = `${this.getTargetPlatform(configType)} v${newVersion}`

      // Create separate folder for this config
      // Structure: ~/.dxlander/projects/{projectId}/configs/{configId}/
      const fs = await import('fs/promises')
      
      if (!project.localPath) {
        throw new Error('Project local path not found')
      }
      
      // Use helper function to get config directory
      const configPath = getConfigDir(projectId, configSetId)
      
      // Ensure config directory exists
      await fs.mkdir(configPath, { recursive: true })

      await db.insert(schema.configSets).values({
        id: configSetId,
        projectId,
        analysisRunId: analysisId,
        userId,
        name: configName,
        version: newVersion,
        type: configType,
        localPath: configPath, // Store the config folder path
        generatedBy: aiProvider.provider,
        status: 'generating',
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Run config generation in background
      this.runConfigGeneration(
        configSetId,
        project,
        JSON.parse(analysis.results),
        configType,
        userId
      ).catch(error => {
        console.error('Background config generation failed:', error)
      })

      return configSetId
    } catch (error) {
      console.error('Failed to start config generation:', error)
      throw error
    }
  }

  /**
   * Run the actual config generation (background task)
   */
  private static async runConfigGeneration(
    configSetId: string,
    project: any,
    analysisResults: any,
    configType: ConfigType,
    userId: string
  ): Promise<void> {
    const fs = await import('fs/promises')
    const path = await import('path')

    try {
      // Get the config set to access localPath
      const configSet = await db.query.configSets.findFirst({
        where: eq(schema.configSets.id, configSetId)
      })

      if (!configSet || !configSet.localPath) {
        throw new Error('Config set or localPath not found')
      }

      console.log(`📂 Config folder path: ${configSet.localPath}`)
      console.log(`📂 Project files path: ${project.localPath}`)

      // Log activity: starting
      await this.logConfigActivity(configSetId, 'start_generation', 'started', `Starting ${configType} configuration generation`)

      // Get AI provider instance (handles encryption, credentials, etc.)
      const provider = await AIProviderService.getProvider({ userId })

      // Prepare config generation request - use config folder as project path
      const request: DeploymentConfigRequest = {
        analysisResult: analysisResults,
        projectContext: {
          files: [], // Files already analyzed
          projectPath: configSet.localPath, // Use config folder, not project folder!
          readme: analysisResults.projectStructure.documentationFiles[0]
        },
        configType,
        optimizeFor: 'speed' as const
      }

      console.log(`🤖 AI will use cwd: ${request.projectContext.projectPath}`)

      let configResult: DeploymentConfigResult | null = null

      await this.logConfigActivity(configSetId, 'ai_generation', 'started', `AI is generating ${configType} configuration files`)

      try {
        // Generate config (AI writes files directly to config folder)
        configResult = await provider.generateDeploymentConfig(request)
        await this.logConfigActivity(configSetId, 'ai_generation', 'completed', `AI completed. Files: ${configResult.files.map(f => f.fileName).join(', ')}`)
      } catch (error: any) {
        await this.logConfigActivity(configSetId, 'ai_generation', 'failed', `AI generation error: ${error.message}`)
        throw error
      }

      // Save config file metadata and read content from disk
      if (configResult.files && configResult.files.length > 0) {
        await this.logConfigActivity(configSetId, 'save_files', 'started', `Saving ${configResult.files.length} files to database`)

        for (let i = 0; i < configResult.files.length; i++) {
          const file = configResult.files[i]
          const fileId = randomUUID()

          // Determine file type from extension
          const fileName = file.fileName || 'config.txt'
          
          // Skip _summary.json - it stays on disk only, we'll read it when needed
          if (fileName === '_summary.json') {
            await this.logConfigActivity(configSetId, 'skip_file', 'completed', '_summary.json (kept on disk only)')
            continue
          }

          const fileExtension = fileName.split('.').pop() || 'txt'
          const fileType = fileExtension || 'text'

          // Read file content from disk (AI wrote it in config folder)
          const filePath = path.join(configSet.localPath, fileName)
          let content = ''

          try {
            content = await fs.readFile(filePath, 'utf-8')
            await this.logConfigActivity(configSetId, 'read_file', 'completed', fileName, { size: content.length })
          } catch (error) {
            console.warn(`Warning: Could not read ${fileName} from config folder`)
            await this.logConfigActivity(configSetId, 'read_file', 'failed', fileName, { error: String(error) })
          }

          await db.insert(schema.configFiles).values({
            id: fileId,
            configSetId,
            fileName,
            fileType,
            content, // Read from disk
            description: file.description || null,
            order: i,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      }

      const configSetFinal = await db.query.configSets.findFirst({
        where: eq(schema.configSets.id, configSetId)
      })

      const duration = configSetFinal?.startedAt 
        ? Math.floor((new Date().getTime() - configSetFinal.startedAt.getTime()) / 1000)
        : 0

      // Update config set status (no metadata field needed - summary stays on disk)
      await db.update(schema.configSets)
        .set({
          status: 'complete',
          progress: 100,
          completedAt: new Date(),
          duration
        })
        .where(eq(schema.configSets.id, configSetId))

      await this.logConfigActivity(configSetId, 'generation_complete', 'completed', `Configuration generated successfully in ${duration}s`)

      // Update project status to 'configured'
      await db.update(schema.projects)
        .set({
          status: 'configured',
          updatedAt: new Date()
        })
        .where(eq(schema.projects.id, project.id))

      console.log(`✅ Config generation completed for project: ${project.name} (${configType} v${configSetFinal!.version})`)

    } catch (error: any) {
      console.error('Config generation failed:', error)

      await this.logConfigActivity(configSetId, 'generation_failed', 'failed', `Configuration generation failed: ${error.message}`)

      // Update config set with error
      await db.update(schema.configSets)
        .set({
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date()
        })
        .where(eq(schema.configSets.id, configSetId))
    }
  }

  /**
   * Get target platform name based on config type
   */
  private static getTargetPlatform(configType: ConfigType): string {
    const platformMap: Record<ConfigType, string> = {
      'docker': 'Docker',
      'docker-compose': 'Docker Compose',
      'kubernetes': 'Kubernetes',
      'bash': 'Bash Script'
    }
    return platformMap[configType] || 'Generic'
  }

  /**
   * Get config set with all files
   */
  static async getConfigSet(configSetId: string, userId: string): Promise<any> {
    // Get config set
    const configSet = await db.query.configSets.findFirst({
      where: eq(schema.configSets.id, configSetId)
    })

    if (!configSet) {
      return null
    }

    // Verify user owns the project
    const project = await db.query.projects.findFirst({
      where: and(
        eq(schema.projects.id, configSet.projectId),
        eq(schema.projects.userId, userId)
      )
    })

    if (!project) {
      throw new Error('Unauthorized')
    }

    // Get config files
    const files = await db.query.configFiles.findMany({
      where: eq(schema.configFiles.configSetId, configSetId),
      orderBy: [schema.configFiles.order]
    })

    // Read _summary.json from disk if it exists
    let metadata = null
    if (configSet.localPath) {
      try {
        const fs = await import('fs/promises')
        const path = await import('path')
        const summaryPath = path.join(configSet.localPath, '_summary.json')
        const summaryContent = await fs.readFile(summaryPath, 'utf-8')
        metadata = JSON.parse(summaryContent)
      } catch (error) {
        // File doesn't exist or couldn't be read - that's okay
        console.log('_summary.json not found or unreadable for config:', configSetId)
      }
    }

    return {
      ...configSet,
      files,
      metadata // Add the summary data from disk
    }
  }

  /**
   * List all config sets for a project
   */
  static async listConfigSets(projectId: string, userId: string): Promise<any[]> {
    // Verify user owns the project
    const project = await db.query.projects.findFirst({
      where: and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, userId)
      )
    })

    if (!project) {
      throw new Error('Project not found')
    }

    // Get all config sets
    const configSets = await db.query.configSets.findMany({
      where: eq(schema.configSets.projectId, projectId),
      orderBy: [desc(schema.configSets.createdAt)]
    })

    // Get file counts for each config set
    const configSetsWithCounts = await Promise.all(
      configSets.map(async (configSet) => {
        const files = await db.query.configFiles.findMany({
          where: eq(schema.configFiles.configSetId, configSet.id)
        })

        return {
          ...configSet,
          fileCount: files.length
        }
      })
    )

    return configSetsWithCounts
  }

  /**
   * Delete a config set
   */
  static async deleteConfigSet(configSetId: string, userId: string): Promise<void> {
    // Get config set
    const configSet = await db.query.configSets.findFirst({
      where: eq(schema.configSets.id, configSetId)
    })

    if (!configSet) {
      throw new Error('Config set not found')
    }

    // Verify user owns the project
    const project = await db.query.projects.findFirst({
      where: and(
        eq(schema.projects.id, configSet.projectId),
        eq(schema.projects.userId, userId)
      )
    })

    if (!project) {
      throw new Error('Unauthorized')
    }

    // Delete config files first
    await db.delete(schema.configFiles).where(
      eq(schema.configFiles.configSetId, configSetId)
    )

    // Delete config set
    await db.delete(schema.configSets).where(
      eq(schema.configSets.id, configSetId)
    )
  }

  /**
   * Log config generation activity
   */
  private static async logConfigActivity(
    configSetId: string,
    action: string,
    status: 'started' | 'completed' | 'failed',
    result?: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await db.insert(schema.configActivityLogs).values({
        id: randomUUID(),
        configSetId,
        action,
        status,
        result: result || null,
        details: details ? JSON.stringify(details) : null,
        timestamp: new Date()
      })
    } catch (error) {
      // Don't fail the whole operation if logging fails
      console.error('Failed to log config activity:', error)
    }
  }

  /**
   * Get config generation progress and activity logs
   */
  static async getConfigProgress(configSetId: string): Promise<{
    status: string
    progress: number
    activityLog: Array<{
      id: string
      action: string
      status: string
      result?: string
      details?: any
      timestamp: string
    }>
  }> {
    const configSet = await db.query.configSets.findFirst({
      where: eq(schema.configSets.id, configSetId)
    })

    if (!configSet) {
      throw new Error('Config set not found')
    }

    // Get activity logs
    const logs = await db.query.configActivityLogs.findMany({
      where: eq(schema.configActivityLogs.configSetId, configSetId),
      orderBy: [desc(schema.configActivityLogs.timestamp)],
      limit: 50
    })

    return {
      status: configSet.status,
      progress: configSet.progress || 0,
      activityLog: logs.map(log => ({
        id: log.id,
        action: log.action,
        status: log.status,
        result: log.result || undefined,
        details: log.details ? JSON.parse(log.details) : undefined,
        timestamp: log.timestamp.toISOString()
      })).reverse() // Oldest first
    }
  }
}

