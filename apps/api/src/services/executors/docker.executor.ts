import Docker from 'dockerode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  validateDockerComposeImpl,
  type PreFlightCheck,
  type DeploymentPlatform,
} from '@dxlander/shared';
import type {
  IDeploymentExecutor,
  PreFlightOptions,
  PreFlightResult,
  DeployOptions,
  DeployResult,
  DeleteOptions,
  LogOptions,
} from './types';

const execAsync = promisify(exec);

/**
 * Docker Compose service status
 */
interface ComposeServiceStatus {
  name: string;
  status: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created' | 'unknown';
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
  ports: string[];
  containerId?: string;
}

/**
 * Docker Deployment Executor
 *
 * Handles Docker Compose deployments including:
 * - Pre-flight checks (Docker, Compose, images validation)
 * - Deployment via docker compose up
 * - Lifecycle management (start, stop, restart, delete)
 * - Log retrieval
 *
 * Implements IDeploymentExecutor for the pluggable executor architecture.
 */
export class DockerDeploymentExecutor implements IDeploymentExecutor {
  readonly platform: DeploymentPlatform = 'docker';
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  /**
   * Validate project name to prevent command injection.
   * Docker Compose project names must be lowercase alphanumeric with hyphens/underscores.
   */
  private validateProjectName(name: string): string {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
      throw new Error(
        `Invalid project name: ${name}. Must be lowercase alphanumeric with hyphens/underscores.`
      );
    }
    return name;
  }

  /**
   * Validate service name for use in shell commands.
   */
  private validateServiceName(name: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
      throw new Error(`Invalid service name: ${name}`);
    }
    return name;
  }

  // ============================================================
  // IDeploymentExecutor Interface Implementation
  // ============================================================

  async runPreFlightChecks(options: PreFlightOptions): Promise<PreFlightResult> {
    const checks: PreFlightCheck[] = [];

    checks.push(await this.checkDockerInstalled());
    checks.push(await this.checkDockerRunning());
    checks.push(await this.checkDockerComposeInstalled());
    checks.push(await this.checkComposeFileExists(options.configPath));
    checks.push(await this.validateComposeFile(options.configPath));
    checks.push(
      await this.checkImagesExist(options.configPath, options.provisionServiceNames || [])
    );
    checks.push(await this.checkDiskSpace());

    const passed = checks.every((c) => c.status !== 'failed');

    return { passed, checks };
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { workDir, projectName, envVars, onProgress } = options;
    this.validateProjectName(projectName);
    let logs = '';

    try {
      onProgress?.({ type: 'info', message: 'Starting Docker Compose deployment...' });

      if (envVars && Object.keys(envVars).length > 0) {
        const envPath = path.join(workDir, '.env');
        this.writeEnvFile(envVars, envPath);
        onProgress?.({ type: 'info', message: 'Environment variables written to .env file' });
      }

      let cmd = `docker compose -p "${projectName}"`;
      cmd += ` -f "${path.join(workDir, 'docker-compose.yml')}"`;
      cmd += ' up --build -d';

      onProgress?.({ type: 'info', message: 'Building and starting services...' });

      const { stdout, stderr } = await execAsync(cmd, {
        cwd: workDir,
        maxBuffer: 50 * 1024 * 1024,
        timeout: 30 * 60 * 1000, // 30 minute timeout for builds
        env: { ...process.env, ...envVars },
      });

      logs = stdout + (stderr ? `\n${stderr}` : '');

      const services = await this.getComposeServices(workDir, projectName);
      const serviceUrls = await this.getDeployUrls(workDir, projectName, envVars);

      onProgress?.({ type: 'success', message: `Services started: ${services.join(', ')}` });

      return {
        success: true,
        services,
        logs,
        deployUrl: serviceUrls[0]?.url,
        serviceUrls,
      };
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || error.message;
      logs += errorOutput;

      onProgress?.({ type: 'error', message: 'Docker Compose deployment failed' });

      return {
        success: false,
        services: [],
        errorMessage: error.message,
        logs,
      };
    }
  }

  async start(
    workDir: string,
    projectName: string
  ): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      this.validateProjectName(projectName);
      const cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" start`;
      await execAsync(cmd, { cwd: workDir, timeout: 60000 });
      return { success: true };
    } catch (error: any) {
      return { success: false, errorMessage: error.message };
    }
  }

  async stop(
    workDir: string,
    projectName: string
  ): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      this.validateProjectName(projectName);
      const cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" stop`;
      await execAsync(cmd, { cwd: workDir, timeout: 60000 });
      return { success: true };
    } catch (error: any) {
      return { success: false, errorMessage: error.message };
    }
  }

  async restart(
    workDir: string,
    projectName: string
  ): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      this.validateProjectName(projectName);
      const cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" restart`;
      await execAsync(cmd, { cwd: workDir, timeout: 60000 });
      return { success: true };
    } catch (error: any) {
      return { success: false, errorMessage: error.message };
    }
  }

  async delete(workDir: string, projectName: string, options?: DeleteOptions): Promise<void> {
    this.validateProjectName(projectName);
    let cmd = `docker compose -p "${projectName}"`;
    cmd += ` -f "${path.join(workDir, 'docker-compose.yml')}"`;
    cmd += ' down';
    if (options?.removeVolumes) cmd += ' -v';
    if (options?.removeImages) {
      const rmiValue = options.removeImages === true ? 'all' : options.removeImages;
      cmd += ` --rmi ${rmiValue}`;
    }

    await execAsync(cmd, { cwd: workDir, timeout: 300000 });
  }

  async getLogs(workDir: string, projectName: string, options?: LogOptions): Promise<string> {
    try {
      this.validateProjectName(projectName);
      let cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" logs`;
      if (options?.tail) cmd += ` --tail ${Math.floor(Number(options.tail)) || 100}`;
      if (options?.service) cmd += ` ${this.validateServiceName(options.service)}`;

      const { stdout, stderr } = await execAsync(cmd, {
        cwd: workDir,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });

      return stdout + (stderr || '');
    } catch (error: any) {
      return `Error getting logs: ${error.message}`;
    }
  }

  async getStatus(
    workDir: string,
    projectName: string
  ): Promise<{
    running: boolean;
    services: Array<{ name: string; status: string; ports?: string[] }>;
  }> {
    try {
      this.validateProjectName(projectName);
      const cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" ps --format json`;
      const { stdout } = await execAsync(cmd, { cwd: workDir, timeout: 30000 });

      const services: ComposeServiceStatus[] = [];

      const lines = stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          services.push({
            name: data.Service || data.Name || 'unknown',
            status: this.parseComposeStatus(data.State || data.Status),
            health: data.Health || 'none',
            ports: data.Publishers?.map((p: any) => `${p.PublishedPort}:${p.TargetPort}`) || [],
            containerId: data.ID,
          });
        } catch {
          continue;
        }
      }

      const running = services.length > 0 && services.some((s) => s.status === 'running');

      return {
        running,
        services: services.map((s) => ({
          name: s.name,
          status: s.status,
          ports: s.ports,
        })),
      };
    } catch {
      return { running: false, services: [] };
    }
  }

  async getDeployUrls(
    workDir: string,
    projectName: string,
    envVars?: Record<string, string>
  ): Promise<Array<{ service: string; url: string }>> {
    const serviceUrls: { service: string; url: string }[] = [];
    const foundServices = new Set<string>();

    const status = await this.getStatus(workDir, projectName);

    for (const service of status.services) {
      if (service.ports && service.ports.length > 0) {
        for (const portMapping of service.ports) {
          const hostPort = portMapping.split(':')[0];
          if (hostPort && hostPort !== '0' && /^\d+$/.test(hostPort)) {
            serviceUrls.push({
              service: service.name,
              url: `http://localhost:${hostPort}`,
            });
            foundServices.add(service.name);
            break;
          }
        }
      }
    }

    try {
      const composePath = path.join(workDir, 'docker-compose.yml');
      const composeContent = fs.readFileSync(composePath, 'utf-8');
      const composeDoc = yaml.parse(composeContent);

      if (composeDoc.services) {
        for (const [serviceName, serviceConfig] of Object.entries(composeDoc.services)) {
          if (foundServices.has(serviceName)) continue;

          const svc = serviceConfig as any;
          if (svc.ports && Array.isArray(svc.ports) && svc.ports.length > 0) {
            const hostPort = this.resolvePortConfig(svc.ports[0], envVars);
            if (hostPort) {
              serviceUrls.push({
                service: serviceName,
                url: `http://localhost:${hostPort}`,
              });
            }
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }

    return serviceUrls;
  }

  // ============================================================
  // Pre-flight Check Methods
  // ============================================================

  private async checkDockerInstalled(): Promise<PreFlightCheck> {
    try {
      await execAsync('docker --version');
      return {
        name: 'Docker Installed',
        status: 'passed',
        message: 'Docker is installed on this system',
      };
    } catch {
      return {
        name: 'Docker Installed',
        status: 'failed',
        message: 'Docker is not installed on this system',
        fix: 'Install Docker from https://docs.docker.com/get-docker/',
      };
    }
  }

  private async checkDockerRunning(): Promise<PreFlightCheck> {
    try {
      await this.docker.ping();
      return {
        name: 'Docker Daemon Running',
        status: 'passed',
        message: 'Docker daemon is running',
      };
    } catch {
      return {
        name: 'Docker Daemon Running',
        status: 'failed',
        message: 'Docker daemon is not running',
        fix: 'Start Docker Desktop or run "sudo systemctl start docker"',
      };
    }
  }

  private async checkDockerComposeInstalled(): Promise<PreFlightCheck> {
    try {
      const { stdout } = await execAsync('docker compose version');
      const versionMatch = stdout.match(/v?(\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      return {
        name: 'Docker Compose',
        status: 'passed',
        message: `Docker Compose v${version} is available`,
      };
    } catch {
      return {
        name: 'Docker Compose',
        status: 'failed',
        message: 'Docker Compose is not available',
        fix: 'Install Docker Compose plugin or upgrade to Docker Desktop 3.4+',
      };
    }
  }

  private async checkComposeFileExists(workDir: string): Promise<PreFlightCheck> {
    const composeFile = path.join(workDir, 'docker-compose.yml');
    const composeYamlFile = path.join(workDir, 'docker-compose.yaml');

    if (fs.existsSync(composeFile) || fs.existsSync(composeYamlFile)) {
      return {
        name: 'Compose File',
        status: 'passed',
        message: 'docker-compose.yml found',
      };
    }

    return {
      name: 'Compose File',
      status: 'failed',
      message: 'docker-compose.yml not found in deployment directory',
      fix: 'Generate a docker-compose.yml configuration for this project',
    };
  }

  private async validateComposeFile(workDir: string): Promise<PreFlightCheck> {
    const composeFile = path.join(workDir, 'docker-compose.yml');
    const composeYamlFile = path.join(workDir, 'docker-compose.yaml');

    if (!fs.existsSync(composeFile) && !fs.existsSync(composeYamlFile)) {
      return {
        name: 'Compose Validation',
        status: 'warning',
        message: 'No compose file to validate',
      };
    }

    try {
      const result = await validateDockerComposeImpl({ projectPath: workDir });

      if (result.valid) {
        const warningCount = result.warnings.length;
        return {
          name: 'Compose Validation',
          status: warningCount > 0 ? 'warning' : 'passed',
          message:
            warningCount > 0
              ? `docker-compose.yml valid with ${warningCount} warning(s)`
              : 'docker-compose.yml syntax is valid',
        };
      }

      const firstError = result.errors[0];
      let fix = 'Review and fix the docker-compose.yml file';

      if (
        firstError?.message.includes('Kubernetes') ||
        firstError?.message.includes('Invalid property')
      ) {
        fix = firstError.message;
      } else if (firstError?.message.includes('read_only_root_filesystem')) {
        fix = 'Replace "read_only_root_filesystem" with "read_only" (Docker Compose property)';
      }

      return {
        name: 'Compose Validation',
        status: 'failed',
        message: `Invalid docker-compose.yml: ${firstError?.message || 'Unknown error'}`,
        fix,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        name: 'Compose Validation',
        status: 'failed',
        message: `Validation error: ${errorMessage}`,
        fix: 'Check if the docker-compose.yml file is valid YAML',
      };
    }
  }

  private async checkImagesExist(
    workDir: string,
    provisionServiceNames: string[]
  ): Promise<PreFlightCheck> {
    const composePath = path.join(workDir, 'docker-compose.yml');

    if (!fs.existsSync(composePath)) {
      return {
        name: 'Docker Images',
        status: 'warning',
        message: 'No docker-compose.yml to validate images',
      };
    }

    try {
      const composeContent = fs.readFileSync(composePath, 'utf-8');
      const composeDoc = yaml.parse(composeContent);

      const invalidImages: string[] = [];
      const checkedImages: string[] = [];

      for (const [serviceName, service] of Object.entries(composeDoc.services || {})) {
        const svc = service as any;

        if (svc.build) continue;

        if (provisionServiceNames.length > 0 && !provisionServiceNames.includes(serviceName)) {
          continue;
        }

        if (svc.image) {
          const imageExists = await this.checkImageExists(svc.image);
          if (!imageExists) {
            invalidImages.push(`${serviceName}: ${svc.image}`);
          } else {
            checkedImages.push(svc.image);
          }
        }
      }

      if (invalidImages.length > 0) {
        return {
          name: 'Docker Images',
          status: 'failed',
          message: `Invalid images found: ${invalidImages.join(', ')}`,
          fix: 'Update the image tags in your docker-compose.yml or edit in the Files tab',
          details: { invalidImages },
        };
      }

      if (checkedImages.length === 0) {
        return {
          name: 'Docker Images',
          status: 'passed',
          message: 'No external images to validate (all services use build)',
        };
      }

      return {
        name: 'Docker Images',
        status: 'passed',
        message: `All ${checkedImages.length} Docker image(s) are valid`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        name: 'Docker Images',
        status: 'warning',
        message: `Could not validate images: ${errorMessage}`,
      };
    }
  }

  private async checkImageExists(image: string): Promise<boolean> {
    try {
      await execAsync(`docker manifest inspect ${image}`, { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  private async checkDiskSpace(): Promise<PreFlightCheck> {
    try {
      const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}'");
      const usagePercent = parseInt(stdout.trim().replace('%', ''), 10);

      if (usagePercent > 95) {
        return {
          name: 'Disk Space',
          status: 'failed',
          message: `Disk is ${usagePercent}% full`,
          fix: 'Free up disk space before building Docker images',
        };
      }

      if (usagePercent > 85) {
        return {
          name: 'Disk Space',
          status: 'warning',
          message: `Disk is ${usagePercent}% full - consider freeing space`,
        };
      }

      return {
        name: 'Disk Space',
        status: 'passed',
        message: `Disk usage is at ${usagePercent}%`,
      };
    } catch {
      return {
        name: 'Disk Space',
        status: 'warning',
        message: 'Could not check disk space',
      };
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private writeEnvFile(envVars: Record<string, string>, outputPath: string): void {
    const content = Object.entries(envVars)
      .map(([key, value]) => {
        const escapedValue =
          value.includes(' ') || value.includes('"') ? `"${value.replace(/"/g, '\\"')}"` : value;
        return `${key}=${escapedValue}`;
      })
      .join('\n');

    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  private async getComposeServices(workDir: string, projectName: string): Promise<string[]> {
    try {
      const cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" config --services`;
      const { stdout } = await execAsync(cmd, { cwd: workDir, timeout: 30000 });
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private parseComposeStatus(status: string): ComposeServiceStatus['status'] {
    const lower = status.toLowerCase();
    if (lower.includes('running') || lower.includes('up')) return 'running';
    if (lower.includes('exited') || lower.includes('exit')) return 'exited';
    if (lower.includes('paused')) return 'paused';
    if (lower.includes('restarting')) return 'restarting';
    if (lower.includes('dead')) return 'dead';
    if (lower.includes('created')) return 'created';
    return 'unknown';
  }

  private resolvePortConfig(
    portConfig: string | { target?: number; published?: number },
    envVars?: Record<string, string>
  ): string | undefined {
    if (typeof portConfig === 'string') {
      const parts = portConfig.split(':');
      let hostPort: string | undefined;

      if (parts.length === 2) {
        hostPort = parts[0];
      } else if (parts.length === 3) {
        hostPort = parts[1];
      }

      if (hostPort) {
        const envVarMatch = hostPort.match(/\$\{(\w+)(?::-(\d+))?\}/);
        if (envVarMatch) {
          const varName = envVarMatch[1];
          const defaultValue = envVarMatch[2];
          hostPort = envVars?.[varName] || defaultValue || '3000';
        }
      }

      if (hostPort && /^\d+$/.test(hostPort)) {
        return hostPort;
      }
    } else if (typeof portConfig === 'object' && portConfig.published) {
      return String(portConfig.published);
    }

    return undefined;
  }
}
