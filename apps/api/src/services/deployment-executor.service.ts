import { db, schema } from '@dxlander/database';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { homedir } from 'os';
import * as yaml from 'yaml';
import { getExecutorRegistry, initializeExecutors } from './executors';
import { ConfigServiceService } from './config-service.service';
import {
  validateDockerComposeImpl,
  type DeploymentPlatform,
  type DeploymentStatus,
  type Deployment,
  type DeploymentActivityLog,
  type PreFlightCheck,
} from '@dxlander/shared';
import type { PreFlightResult } from './executors/types';

// Initialize executors on module load
initializeExecutors();

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
 * Uses the executor registry to support multiple deployment targets.
 */
export class DeploymentExecutorService {
  /**
   * Create and execute a deployment using the appropriate executor
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

    // Get the executor for the requested platform
    const registry = getExecutorRegistry();
    const executor = registry.get(platform);

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

    const projectDir = path.dirname(path.dirname(config.localPath));
    const filesDir = path.join(projectDir, 'files');

    if (!fs.existsSync(filesDir)) {
      throw new Error('Project source files not found');
    }

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
    const composeProjectName = `dxlander-${deploymentId.substring(0, 12)}`;
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

    await this.logActivity(deploymentId, 'deployment_started', 'Starting deployment');

    onProgress?.({
      phase: 'pre_flight',
      status: 'pre_flight',
      message: 'Starting deployment...',
    });

    try {
      await this.updateDeploymentStatus(deploymentId, 'pre_flight');

      // Create build directory and copy files
      fs.mkdirSync(buildDir, { recursive: true });
      this.copyDirectorySync(filesDir, buildDir);
      fs.copyFileSync(dockerfilePath, path.join(buildDir, 'Dockerfile'));
      fs.copyFileSync(composeFilePath, path.join(buildDir, 'docker-compose.yml'));

      const dockerignorePath = path.join(config.localPath, '.dockerignore');
      if (fs.existsSync(dockerignorePath)) {
        fs.copyFileSync(dockerignorePath, path.join(buildDir, '.dockerignore'));
      }

      // Get config services to determine which services to keep/remove
      const configServices = await ConfigServiceService.getConfigServices(userId, configSetId);
      const provisionServiceNames = configServices
        .filter((s) => s.sourceMode === 'provision')
        .map((s) => s.composeServiceName)
        .filter(Boolean) as string[];

      // Run pre-flight checks
      const preFlightResult = await executor.runPreFlightChecks({
        configPath: buildDir,
        userId,
        configSetId,
        provisionServiceNames,
      });

      await this.logActivity(
        deploymentId,
        'pre_flight_complete',
        preFlightResult.passed ? 'Pre-flight checks passed' : 'Pre-flight checks failed',
        { checks: preFlightResult.checks }
      );

      if (!preFlightResult.passed) {
        const failedChecks = preFlightResult.checks.filter(
          (c: PreFlightCheck) => c.status === 'failed'
        );
        const errorMessage = failedChecks.map((c: PreFlightCheck) => c.message).join('; ');

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

      // Process docker-compose.yml based on config service modes
      // Simplified: keep AI-generated services for 'provision' mode, remove for 'external'/'none'
      const composePath = path.join(buildDir, 'docker-compose.yml');
      const composeContent = fs.readFileSync(composePath, 'utf-8');
      const composeDoc = yaml.parse(composeContent);

      if (!composeDoc.services) {
        composeDoc.services = {};
      }
      if (!composeDoc.volumes) {
        composeDoc.volumes = {};
      }

      // Find the main app service (has build context)
      let appServiceName = 'app';
      if (!composeDoc.services['app']) {
        appServiceName =
          Object.keys(composeDoc.services).find(
            (name) => composeDoc.services[name]?.build !== undefined
          ) ||
          Object.keys(composeDoc.services)[0] ||
          'app';
      }
      const appService = composeDoc.services[appServiceName];

      const removedServices: string[] = [];

      for (const configService of configServices) {
        const composeServiceName = configService.composeServiceName;

        if (configService.sourceMode === 'external' || configService.sourceMode === 'none') {
          // Remove the service - user provides external connection or skips
          if (
            composeServiceName &&
            composeDoc.services[composeServiceName] &&
            composeServiceName !== appServiceName
          ) {
            delete composeDoc.services[composeServiceName];

            // Remove from depends_on
            if (appService?.depends_on) {
              if (Array.isArray(appService.depends_on)) {
                appService.depends_on = appService.depends_on.filter(
                  (dep: string) => dep !== composeServiceName
                );
              } else if (typeof appService.depends_on === 'object') {
                delete appService.depends_on[composeServiceName];
              }
            }

            removedServices.push(composeServiceName);
          }
        }
        // For 'provision' mode: keep the AI-generated service as-is
      }

      // Clean up empty depends_on
      if (appService?.depends_on) {
        if (Array.isArray(appService.depends_on) && appService.depends_on.length === 0) {
          delete appService.depends_on;
        } else if (
          typeof appService.depends_on === 'object' &&
          Object.keys(appService.depends_on).length === 0
        ) {
          delete appService.depends_on;
        }
      }

      // Clean up unused volumes
      const usedVolumes = new Set<string>();
      for (const [, serviceConfig] of Object.entries(composeDoc.services)) {
        const svc = serviceConfig as any;
        if (Array.isArray(svc.volumes)) {
          for (const vol of svc.volumes) {
            if (typeof vol === 'string' && vol.includes(':')) {
              usedVolumes.add(vol.split(':')[0]);
            }
          }
        }
      }
      for (const volumeName of Object.keys(composeDoc.volumes || {})) {
        if (!usedVolumes.has(volumeName)) {
          delete composeDoc.volumes[volumeName];
        }
      }

      // Write updated docker-compose.yml
      const updatedComposeContent = yaml.stringify(composeDoc, { lineWidth: 0 });
      fs.writeFileSync(composePath, updatedComposeContent, 'utf-8');

      if (removedServices.length > 0) {
        await this.logActivity(
          deploymentId,
          'compose_updated',
          `Docker-compose updated: ${removedServices.length} service(s) removed (using external)`,
          { removed: removedServices }
        );

        // Validate modified compose file
        const validationResult = await validateDockerComposeImpl({ projectPath: buildDir });

        if (!validationResult.valid) {
          const errorMessage = `Docker-compose validation failed: ${validationResult.message}`;
          await this.updateDeploymentStatus(deploymentId, 'failed', errorMessage);

          onProgress?.({
            phase: 'error',
            status: 'failed',
            message: errorMessage,
          });

          return await this.getDeployment(deploymentId);
        }
      }

      // Get resolved environment variables
      const envVars = await ConfigServiceService.getResolvedEnvVars(userId, configSetId);

      // Validate env var names
      const envValidationErrors = this.validateEnvVarNames(envVars);
      if (envValidationErrors.length > 0) {
        const errorMessage = `Invalid environment variable names:\n${envValidationErrors.join('\n')}`;
        await this.updateDeploymentStatus(deploymentId, 'failed', errorMessage);

        onProgress?.({
          phase: 'error',
          status: 'failed',
          message: errorMessage,
        });

        return await this.getDeployment(deploymentId);
      }

      // Deploy
      await this.updateDeploymentStatus(deploymentId, 'building');

      onProgress?.({
        phase: 'build',
        status: 'building',
        message: 'Building and starting services...',
      });

      const deployResult = await executor.deploy({
        workDir: buildDir,
        projectName: composeProjectName,
        envVars,
        onProgress: (event) => {
          onProgress?.({
            phase: event.type === 'error' ? 'error' : 'build',
            status: event.type === 'error' ? 'failed' : 'building',
            message: event.message,
          });
        },
      });

      await this.logActivity(
        deploymentId,
        'deploy_complete',
        deployResult.success ? 'Deployment successful' : 'Deployment failed',
        { services: deployResult.services, success: deployResult.success }
      );

      if (!deployResult.success) {
        await this.updateDeploymentStatus(
          deploymentId,
          'failed',
          deployResult.errorMessage,
          deployResult.logs
        );

        onProgress?.({
          phase: 'error',
          status: 'failed',
          message: 'Deployment failed',
          details: { error: deployResult.errorMessage },
        });

        return await this.getDeployment(deploymentId);
      }

      // Success
      await db
        .update(schema.deployments)
        .set({
          status: 'running',
          buildLogs: deployResult.logs,
          deployUrl: deployResult.deployUrl,
          serviceUrls: deployResult.serviceUrls ? JSON.stringify(deployResult.serviceUrls) : null,
          completedAt: new Date(),
          updatedAt: new Date(),
          metadata: JSON.stringify({
            composeProjectName,
            buildDir,
            services: deployResult.services,
          }),
        })
        .where(eq(schema.deployments.id, deploymentId));

      onProgress?.({
        phase: 'complete',
        status: 'running',
        message: 'Deployment successful',
        details: {
          deployUrl: deployResult.deployUrl,
          serviceUrls: deployResult.serviceUrls,
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
    platform: DeploymentPlatform
  ): Promise<PreFlightResult> {
    const registry = getExecutorRegistry();
    const executor = registry.get(platform);

    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config || !config.localPath) {
      throw new Error('Config set not found or missing local path');
    }

    // Get provision service names for image validation
    const configServices = await ConfigServiceService.getConfigServices(userId, configSetId);
    const provisionServiceNames = configServices
      .filter((s) => s.sourceMode === 'provision')
      .map((s) => s.composeServiceName)
      .filter(Boolean) as string[];

    return await executor.runPreFlightChecks({
      configPath: config.localPath,
      userId,
      configSetId,
      provisionServiceNames,
    });
  }

  /**
   * Start a stopped deployment
   */
  async startDeployment(userId: string, deploymentId: string): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);
    const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

    const executor = getExecutorRegistry().get(deployment.platform);
    const result = await executor.start(buildDir, composeProjectName);

    if (!result.success) {
      throw new Error(result.errorMessage || 'Failed to start services');
    }

    await this.updateDeploymentStatus(deploymentId, 'running');
    await this.logActivity(deploymentId, 'services_started', 'Services started');
  }

  /**
   * Stop a running deployment
   */
  async stopDeployment(userId: string, deploymentId: string): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);
    const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

    const executor = getExecutorRegistry().get(deployment.platform);
    const result = await executor.stop(buildDir, composeProjectName);

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

    await this.logActivity(deploymentId, 'services_stopped', 'Services stopped');
  }

  /**
   * Restart a deployment
   */
  async restartDeployment(userId: string, deploymentId: string): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);
    const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

    const executor = getExecutorRegistry().get(deployment.platform);
    const result = await executor.restart(buildDir, composeProjectName);

    if (!result.success) {
      throw new Error(result.errorMessage || 'Failed to restart services');
    }

    await this.updateDeploymentStatus(deploymentId, 'running');
    await this.logActivity(deploymentId, 'services_restarted', 'Services restarted');
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
      const executor = getExecutorRegistry().get(deployment.platform);

      await executor.delete(buildDir, composeProjectName, {
        removeVolumes: true,
        removeImages: removeImages ? 'local' : undefined,
      });

      if (fs.existsSync(buildDir)) {
        try {
          fs.rmSync(buildDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Metadata may not exist
    }

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
        const executor = getExecutorRegistry().get(deployment.platform);

        result.runtimeLogs = await executor.getLogs(buildDir, composeProjectName, {
          tail: options.tail,
          service: options.service,
        });

        await db
          .update(schema.deployments)
          .set({
            runtimeLogs: result.runtimeLogs,
            updatedAt: new Date(),
          })
          .where(eq(schema.deployments.id, deploymentId));
      } catch {
        // Deployment may not exist
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
      const executor = getExecutorRegistry().get(deployment.platform);

      const status = await executor.getStatus(buildDir, composeProjectName);

      let newStatus: DeploymentStatus;
      if (status.services.length === 0) {
        newStatus = 'stopped';
      } else if (status.running) {
        const hasRestarting = status.services.some((s) => s.status === 'restarting');
        newStatus = hasRestarting ? 'failed' : 'running';
      } else {
        const hasExited = status.services.some((s) => s.status === 'exited');
        const hasRestarting = status.services.some((s) => s.status === 'restarting');
        if (hasRestarting) {
          newStatus = 'failed';
        } else if (hasExited) {
          newStatus = 'stopped';
        } else {
          newStatus = 'failed';
        }
      }

      if (newStatus !== deployment.status) {
        await this.updateDeploymentStatus(deploymentId, newStatus);
      }

      return newStatus;
    } catch {
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
          errors.push(`"${name}": Wildcard (*) is not allowed`);
        } else if (name.includes(' ')) {
          errors.push(`"${name}": Spaces are not allowed`);
        } else if (/^[0-9]/.test(name)) {
          errors.push(`"${name}": Cannot start with a number`);
        } else {
          errors.push(`"${name}": Contains invalid characters`);
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
      serviceUrls: deployment.serviceUrls ? JSON.parse(deployment.serviceUrls) : null,
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
