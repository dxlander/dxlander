import { db, schema } from '@dxlander/database';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { homedir } from 'os';
import { DockerDeploymentExecutor, type PreFlightResult } from './executors/docker.executor';
import { ConfigIntegrationService } from './config-integration.service';
import type {
  DeploymentPlatform,
  DeploymentStatus,
  Deployment,
  DeploymentActivityLog,
} from '@dxlander/shared';

/**
 * Deployment creation options
 */
export interface CreateDeploymentOptions {
  userId: string;
  projectId: string;
  configSetId: string;
  platform: DeploymentPlatform;
  name?: string;
  environment?: string;
  notes?: string;
  onProgress?: (event: DeploymentProgressEvent) => void;
}

/**
 * Deployment progress event
 */
export interface DeploymentProgressEvent {
  phase: 'pre_flight' | 'build' | 'deploy' | 'complete' | 'error';
  status: DeploymentStatus;
  message: string;
  progress?: number;
  details?: Record<string, any>;
}

/**
 * Deployment Executor Service
 *
 * Orchestrates deployment operations across different platforms.
 * Currently supports Docker (local) with extensibility for Vercel, Railway, etc.
 */
export class DeploymentExecutorService {
  private dockerExecutor: DockerDeploymentExecutor;

  constructor() {
    this.dockerExecutor = new DockerDeploymentExecutor();
  }

  /**
   * Create and execute a deployment using Docker Compose
   */
  async createDeployment(options: CreateDeploymentOptions): Promise<Deployment> {
    const {
      userId,
      projectId,
      configSetId,
      platform,
      name,
      environment = 'development',
      notes,
      onProgress,
    } = options;

    // Validate config exists and belongs to user
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    if (!config.localPath) {
      throw new Error('Config set does not have a local path');
    }

    // Get project
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Project structure:
    // - Config localPath: ~/.dxlander/projects/{projectId}/configs/{configId}/
    //   (contains Dockerfile, docker-compose.yml, .dockerignore, .env.example)
    // - Source files: ~/.dxlander/projects/{projectId}/files/ (contains actual project source code)
    //
    // For Docker Compose deployments:
    // - Create a persistent build directory for this deployment
    // - Combine source files + config files (Dockerfile, docker-compose.yml, .dockerignore)
    // - Use compose project name for isolation
    const projectDir = path.dirname(path.dirname(config.localPath));
    const filesDir = path.join(projectDir, 'files');

    if (!fs.existsSync(filesDir)) {
      throw new Error('Project source files not found');
    }

    // Check for required config files
    const dockerfilePath = path.join(config.localPath, 'Dockerfile');
    const composeFilePath = path.join(config.localPath, 'docker-compose.yml');

    if (!fs.existsSync(dockerfilePath)) {
      throw new Error('Dockerfile not found in config');
    }

    if (!fs.existsSync(composeFilePath)) {
      throw new Error('docker-compose.yml not found in config');
    }

    // Create deployment record
    const deploymentId = randomUUID();
    const now = new Date();
    const deploymentName = name || `${project.name}-${Date.now()}`;

    // Compose project name: sanitized, lowercase, no special chars
    const composeProjectName = `dxlander-${deploymentId.substring(0, 12)}`;

    // Persistent build directory for this deployment (needed for start/stop/restart/logs)
    const dxlanderHome = process.env.DXLANDER_HOME || path.join(homedir(), '.dxlander');
    const buildDir = path.join(dxlanderHome, 'deployments', deploymentId);

    await db.insert(schema.deployments).values({
      id: deploymentId,
      projectId,
      configSetId,
      userId,
      name: deploymentName,
      platform,
      environment,
      status: 'pending',
      notes,
      metadata: JSON.stringify({
        composeProjectName,
        buildDir,
      }),
      createdAt: now,
      updatedAt: now,
    });

    // Log deployment start
    await this.logActivity(
      deploymentId,
      'deployment_started',
      'Starting Docker Compose deployment'
    );

    onProgress?.({
      phase: 'pre_flight',
      status: 'pre_flight',
      message: 'Starting deployment...',
    });

    try {
      // Update status
      await this.updateDeploymentStatus(deploymentId, 'pre_flight');

      // Step 1: Create build directory with source files
      fs.mkdirSync(buildDir, { recursive: true });
      this.copyDirectorySync(filesDir, buildDir);

      // Step 2: Copy config files (Dockerfile, docker-compose.yml, .dockerignore)
      fs.copyFileSync(dockerfilePath, path.join(buildDir, 'Dockerfile'));
      fs.copyFileSync(composeFilePath, path.join(buildDir, 'docker-compose.yml'));

      const dockerignorePath = path.join(config.localPath, '.dockerignore');
      if (fs.existsSync(dockerignorePath)) {
        fs.copyFileSync(dockerignorePath, path.join(buildDir, '.dockerignore'));
      }

      // Run pre-flight checks for compose deployment
      const preFlightResult = await this.dockerExecutor.runComposePreFlightChecks(buildDir);

      await this.logActivity(
        deploymentId,
        'pre_flight_complete',
        preFlightResult.passed ? 'Pre-flight checks passed' : 'Pre-flight checks failed',
        { checks: preFlightResult.checks }
      );

      if (!preFlightResult.passed) {
        const failedChecks = preFlightResult.checks.filter((c) => c.status === 'failed');
        const errorMessage = failedChecks.map((c) => c.message).join('; ');

        await this.updateDeploymentStatus(deploymentId, 'failed', errorMessage);

        onProgress?.({
          phase: 'error',
          status: 'failed',
          message: 'Pre-flight checks failed',
          details: { checks: preFlightResult.checks },
        });

        return await this.getDeployment(deploymentId);
      }

      onProgress?.({
        phase: 'pre_flight',
        status: 'pre_flight',
        message: 'Pre-flight checks passed',
        details: { checks: preFlightResult.checks },
      });

      // Get resolved environment variables
      const envVars = await ConfigIntegrationService.getResolvedEnvVars(userId, configSetId);

      // Validate environment variable names before build
      const envValidationErrors = this.validateEnvVarNames(envVars);
      if (envValidationErrors.length > 0) {
        const errorMessage = `Invalid environment variable names:\n${envValidationErrors.join('\n')}`;

        await this.logActivity(
          deploymentId,
          'env_validation_failed',
          'Environment variable validation failed',
          { errors: envValidationErrors }
        );

        await this.updateDeploymentStatus(deploymentId, 'failed', errorMessage);

        onProgress?.({
          phase: 'error',
          status: 'failed',
          message: 'Environment variable validation failed',
          details: { errors: envValidationErrors },
        });

        return await this.getDeployment(deploymentId);
      }

      // Extract port mappings from env vars (any key containing 'PORT')
      // Creates 1:1 mappings e.g., PORT=3000 -> 3000:3000, DB_PORT=5432 -> 5432:5432
      const extractedPorts: Array<{ host: number; container: number; protocol: 'tcp' }> = [];
      for (const [key, value] of Object.entries(envVars)) {
        if (key.toUpperCase().includes('PORT') && value) {
          const portNum = parseInt(value, 10);
          if (!isNaN(portNum) && portNum > 0 && portNum <= 65535) {
            extractedPorts.push({ host: portNum, container: portNum, protocol: 'tcp' });
          }
        }
      }

      // Update deployment record with extracted ports
      if (extractedPorts.length > 0) {
        await db
          .update(schema.deployments)
          .set({ ports: JSON.stringify(extractedPorts) })
          .where(eq(schema.deployments.id, deploymentId));
      }

      // Build and deploy phase using docker compose
      await this.updateDeploymentStatus(deploymentId, 'building');

      onProgress?.({
        phase: 'build',
        status: 'building',
        message: 'Building and starting services with Docker Compose...',
      });

      const composeResult = await this.dockerExecutor.composeUp({
        workDir: buildDir,
        projectName: composeProjectName,
        envVars,
        build: true,
        detach: true,
        onProgress: (event) => {
          const phase = event.type === 'error' ? 'error' : 'build';
          onProgress?.({
            phase,
            status: event.type === 'error' ? 'failed' : 'building',
            message: event.message,
          });
        },
      });

      await this.logActivity(
        deploymentId,
        'compose_up_complete',
        composeResult.success
          ? 'Docker Compose deployment successful'
          : 'Docker Compose deployment failed',
        {
          projectName: composeProjectName,
          services: composeResult.services,
          success: composeResult.success,
        }
      );

      if (!composeResult.success) {
        await this.updateDeploymentStatus(
          deploymentId,
          'failed',
          composeResult.errorMessage,
          composeResult.logs
        );

        onProgress?.({
          phase: 'error',
          status: 'failed',
          message: 'Docker Compose deployment failed',
          details: { error: composeResult.errorMessage },
        });

        return await this.getDeployment(deploymentId);
      }

      // Get deploy URL from compose services
      const deployUrl = await this.dockerExecutor.getComposeDeployUrl(buildDir, composeProjectName);

      // Get compose project status for port info (available for future use)
      const _composeStatus = await this.dockerExecutor.composePs(buildDir, composeProjectName);

      // Success!
      await db
        .update(schema.deployments)
        .set({
          status: 'running',
          buildLogs: composeResult.logs,
          deployUrl,
          completedAt: new Date(),
          updatedAt: new Date(),
          metadata: JSON.stringify({
            composeProjectName,
            buildDir,
            services: composeResult.services,
          }),
        })
        .where(eq(schema.deployments.id, deploymentId));

      onProgress?.({
        phase: 'complete',
        status: 'running',
        message: 'Deployment successful',
        details: {
          projectName: composeProjectName,
          services: composeResult.services,
          deployUrl,
        },
      });

      return await this.getDeployment(deploymentId);
    } catch (error: any) {
      await this.logActivity(deploymentId, 'deployment_error', error.message);
      await this.updateDeploymentStatus(deploymentId, 'failed', error.message);

      onProgress?.({
        phase: 'error',
        status: 'failed',
        message: error.message,
      });

      return await this.getDeployment(deploymentId);
    }
  }

  /**
   * Run pre-flight checks for a deployment
   */
  async runPreFlightChecks(
    userId: string,
    configSetId: string,
    platform: DeploymentPlatform,
    _requestedPorts?: number[]
  ): Promise<PreFlightResult> {
    if (platform !== 'docker') {
      throw new Error(`Platform ${platform} is not yet supported`);
    }

    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config || !config.localPath) {
      throw new Error('Config set not found or missing local path');
    }

    // Use compose pre-flight checks
    return await this.dockerExecutor.runComposePreFlightChecks(config.localPath);
  }

  /**
   * Detect exposed ports from Dockerfile
   */
  async detectPorts(userId: string, configSetId: string): Promise<number[]> {
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config || !config.localPath) {
      throw new Error('Config set not found or missing local path');
    }

    return await this.dockerExecutor.parseDockerfilePorts(
      path.join(config.localPath, 'Dockerfile')
    );
  }

  /**
   * Start a stopped deployment
   */
  async startDeployment(userId: string, deploymentId: string): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);
    const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

    const result = await this.dockerExecutor.composeStart(buildDir, composeProjectName);
    if (!result.success) {
      throw new Error(result.errorMessage || 'Failed to start services');
    }

    await this.updateDeploymentStatus(deploymentId, 'running');
    await this.logActivity(deploymentId, 'services_started', 'Compose services started');
  }

  /**
   * Stop a running deployment
   */
  async stopDeployment(userId: string, deploymentId: string): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);
    const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

    const result = await this.dockerExecutor.composeStop(buildDir, composeProjectName);
    if (!result.success) {
      throw new Error(result.errorMessage || 'Failed to stop services');
    }

    await db
      .update(schema.deployments)
      .set({
        status: 'stopped',
        stoppedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deploymentId));

    await this.logActivity(deploymentId, 'services_stopped', 'Compose services stopped');
  }

  /**
   * Restart a deployment
   */
  async restartDeployment(userId: string, deploymentId: string): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);
    const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

    const result = await this.dockerExecutor.composeRestart(buildDir, composeProjectName);
    if (!result.success) {
      throw new Error(result.errorMessage || 'Failed to restart services');
    }

    await this.updateDeploymentStatus(deploymentId, 'running');
    await this.logActivity(deploymentId, 'services_restarted', 'Compose services restarted');
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(
    userId: string,
    deploymentId: string,
    removeImages = false
  ): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);

    try {
      const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

      // Use compose down to stop and remove containers
      await this.dockerExecutor.composeDown(buildDir, composeProjectName, {
        removeVolumes: true,
        removeImages: removeImages ? 'local' : undefined,
      });

      // Clean up build directory
      if (fs.existsSync(buildDir)) {
        try {
          fs.rmSync(buildDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Compose metadata may not exist for old deployments
    }

    // Update status to terminated
    await db
      .update(schema.deployments)
      .set({
        status: 'terminated',
        updatedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deploymentId));

    await this.logActivity(deploymentId, 'deployment_deleted', 'Deployment deleted');
  }

  /**
   * Get deployment logs
   */
  async getLogs(
    userId: string,
    deploymentId: string,
    options: { type?: 'build' | 'runtime' | 'all'; tail?: number; service?: string } = {}
  ): Promise<{ buildLogs?: string; runtimeLogs?: string }> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);

    const result: { buildLogs?: string; runtimeLogs?: string } = {};

    if (options.type === 'build' || options.type === 'all' || !options.type) {
      result.buildLogs = deployment.buildLogs ?? undefined;
    }

    if (options.type === 'runtime' || options.type === 'all' || !options.type) {
      try {
        const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

        result.runtimeLogs = await this.dockerExecutor.composeLogs(buildDir, composeProjectName, {
          tail: options.tail,
          service: options.service,
        });

        // Update runtime logs in DB
        await db
          .update(schema.deployments)
          .set({
            runtimeLogs: result.runtimeLogs,
            updatedAt: new Date(),
          })
          .where(eq(schema.deployments.id, deploymentId));
      } catch {
        // Compose project may not exist
      }
    }

    return result;
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(userId: string, deploymentId: string): Promise<DeploymentStatus> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);

    try {
      const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

      // Check compose project status
      const composeStatus = await this.dockerExecutor.composePs(buildDir, composeProjectName);

      let newStatus: DeploymentStatus;
      if (composeStatus.services.length === 0) {
        newStatus = 'stopped';
      } else if (composeStatus.running) {
        newStatus = 'running';
      } else {
        // Some services exist but not running
        const hasExited = composeStatus.services.some((s) => s.status === 'exited');
        newStatus = hasExited ? 'stopped' : 'failed';
      }

      // Update DB if status changed
      if (newStatus !== deployment.status) {
        await this.updateDeploymentStatus(deploymentId, newStatus);
      }

      return newStatus;
    } catch {
      // Compose metadata may not exist
      return deployment.status as DeploymentStatus;
    }
  }

  /**
   * Get activity logs for a deployment
   */
  async getActivityLogs(userId: string, deploymentId: string): Promise<DeploymentActivityLog[]> {
    await this.getDeploymentWithAuth(userId, deploymentId);

    const logs = await db.query.deploymentActivityLogs.findMany({
      where: eq(schema.deploymentActivityLogs.deploymentId, deploymentId),
      orderBy: (dal, { asc }) => [asc(dal.timestamp)],
    });

    return logs.map((log) => ({
      id: log.id,
      deploymentId: log.deploymentId,
      action: log.action,
      result: log.result,
      details: log.details ? JSON.parse(log.details) : null,
      timestamp: log.timestamp,
    }));
  }

  /**
   * List deployments
   */
  async listDeployments(
    userId: string,
    options: {
      projectId?: string;
      configSetId?: string;
      status?: DeploymentStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Deployment[]> {
    const { projectId, configSetId, status, limit = 20, offset = 0 } = options;

    // Build conditions array
    const conditions = [eq(schema.deployments.userId, userId)];

    if (projectId) {
      conditions.push(eq(schema.deployments.projectId, projectId));
    }

    if (configSetId) {
      conditions.push(eq(schema.deployments.configSetId, configSetId));
    }

    if (status) {
      conditions.push(eq(schema.deployments.status, status));
    }

    const deployments = await db
      .select()
      .from(schema.deployments)
      .where(and(...conditions))
      .orderBy(desc(schema.deployments.createdAt))
      .limit(limit)
      .offset(offset);

    return deployments.map(this.formatDeployment);
  }

  /**
   * Get a single deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = await db.query.deployments.findFirst({
      where: eq(schema.deployments.id, deploymentId),
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    return this.formatDeployment(deployment);
  }

  /**
   * Get deployment with auth check
   */
  private async getDeploymentWithAuth(userId: string, deploymentId: string): Promise<Deployment> {
    const deployment = await db.query.deployments.findFirst({
      where: and(eq(schema.deployments.id, deploymentId), eq(schema.deployments.userId, userId)),
    });

    if (!deployment) {
      throw new Error('Deployment not found or access denied');
    }

    return this.formatDeployment(deployment);
  }

  /**
   * Get compose metadata from deployment
   */
  private getComposeMetadata(deployment: Deployment): {
    composeProjectName: string;
    buildDir: string;
  } {
    if (!deployment.metadata) {
      throw new Error('Deployment metadata not found');
    }

    const metadata =
      typeof deployment.metadata === 'string'
        ? JSON.parse(deployment.metadata)
        : deployment.metadata;

    if (!metadata.composeProjectName || !metadata.buildDir) {
      throw new Error('Compose project metadata not found');
    }

    return {
      composeProjectName: metadata.composeProjectName,
      buildDir: metadata.buildDir,
    };
  }

  /**
   * Update deployment status
   */
  private async updateDeploymentStatus(
    deploymentId: string,
    status: DeploymentStatus,
    errorMessage?: string,
    buildLogs?: string
  ): Promise<void> {
    const updates: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    if (buildLogs) {
      updates.buildLogs = buildLogs;
    }

    if (status === 'building' || status === 'pre_flight' || status === 'deploying') {
      updates.startedAt = new Date();
    }

    await db.update(schema.deployments).set(updates).where(eq(schema.deployments.id, deploymentId));
  }

  /**
   * Log deployment activity
   */
  private async logActivity(
    deploymentId: string,
    action: string,
    result: string,
    details?: Record<string, any>
  ): Promise<void> {
    await db.insert(schema.deploymentActivityLogs).values({
      id: randomUUID(),
      deploymentId,
      action,
      result,
      details: details ? JSON.stringify(details) : null,
      timestamp: new Date(),
    });
  }

  /**
   * Copy a directory recursively
   */
  private copyDirectorySync(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectorySync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Validate environment variable names
   * Returns array of error messages for invalid variable names
   */
  private validateEnvVarNames(envVars: Record<string, string>): string[] {
    const errors: string[] = [];
    const validNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

    for (const name of Object.keys(envVars)) {
      if (!name) {
        errors.push('Empty environment variable name found');
        continue;
      }

      if (!validNameRegex.test(name)) {
        if (name.includes('*')) {
          errors.push(`"${name}": Wildcard (*) is not allowed in variable names`);
        } else if (name.includes(' ')) {
          errors.push(`"${name}": Spaces are not allowed in variable names`);
        } else if (/^[0-9]/.test(name)) {
          errors.push(`"${name}": Variable names cannot start with a number`);
        } else {
          errors.push(
            `"${name}": Contains invalid characters (only letters, numbers, and underscores allowed)`
          );
        }
      }
    }

    return errors;
  }

  /**
   * Format deployment from database
   */
  private formatDeployment(deployment: any): Deployment {
    return {
      id: deployment.id,
      projectId: deployment.projectId,
      configSetId: deployment.configSetId,
      buildRunId: deployment.buildRunId,
      userId: deployment.userId,
      name: deployment.name,
      platform: deployment.platform as DeploymentPlatform,
      environment: deployment.environment,
      status: deployment.status as DeploymentStatus,
      containerId: deployment.containerId,
      imageId: deployment.imageId,
      imageTag: deployment.imageTag,
      ports: deployment.ports ? JSON.parse(deployment.ports) : null,
      exposedPorts: deployment.exposedPorts ? JSON.parse(deployment.exposedPorts) : null,
      deployUrl: deployment.deployUrl,
      previewUrl: deployment.previewUrl,
      buildLogs: deployment.buildLogs,
      runtimeLogs: deployment.runtimeLogs,
      errorMessage: deployment.errorMessage,
      environmentVariables: deployment.environmentVariables,
      notes: deployment.notes,
      metadata: deployment.metadata ? JSON.parse(deployment.metadata) : null,
      startedAt: deployment.startedAt,
      completedAt: deployment.completedAt,
      stoppedAt: deployment.stoppedAt,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
    };
  }
}
