import Docker from 'dockerode';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  validateDockerComposeImpl,
  type PreFlightCheck,
  type PortMapping,
  type DeploymentStatus,
} from '@dxlander/shared';

const execAsync = promisify(exec);

/**
 * Pre-flight check result
 */
export interface PreFlightResult {
  passed: boolean;
  checks: PreFlightCheck[];
}

/**
 * Build options for Docker image
 */
export interface DockerBuildOptions {
  contextPath: string;
  dockerfilePath?: string;
  imageTag: string;
  buildArgs?: Record<string, string>;
  onProgress?: (event: BuildProgressEvent) => void;
}

/**
 * Build progress event
 */
export interface BuildProgressEvent {
  type: 'stream' | 'error' | 'status';
  message: string;
  progress?: number;
}

/**
 * Build result
 */
export interface DockerBuildResult {
  success: boolean;
  imageId?: string;
  imageTag: string;
  buildLogs: string;
  errorMessage?: string;
}

/**
 * Deploy options
 */
export interface DockerDeployOptions {
  imageTag: string;
  containerName: string;
  ports: PortMapping[];
  environmentVariables: Record<string, string>;
  onProgress?: (event: DeployProgressEvent) => void;
}

/**
 * Deploy progress event
 */
export interface DeployProgressEvent {
  type: 'status' | 'info' | 'error';
  message: string;
}

/**
 * Deploy result
 */
export interface DockerDeployResult {
  success: boolean;
  containerId?: string;
  deployUrl?: string;
  ports: PortMapping[];
  errorMessage?: string;
}

/**
 * Container status
 */
export interface ContainerStatus {
  status: DeploymentStatus;
  containerId: string;
  running: boolean;
  ports: PortMapping[];
  startedAt?: string;
  exitCode?: number;
}

/**
 * Docker Compose up options
 */
export interface ComposeUpOptions {
  workDir: string;
  projectName: string;
  envVars?: Record<string, string>;
  build?: boolean;
  detach?: boolean;
  onProgress?: (event: DeployProgressEvent) => void;
}

/**
 * Docker Compose up result
 */
export interface ComposeUpResult {
  success: boolean;
  projectName: string;
  services: string[];
  errorMessage?: string;
  logs: string;
}

/**
 * Docker Compose service status
 */
export interface ComposeServiceStatus {
  name: string;
  status: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created' | 'unknown';
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
  ports: string[];
  containerId?: string;
}

/**
 * Docker Compose project status
 */
export interface ComposeProjectStatus {
  projectName: string;
  services: ComposeServiceStatus[];
  running: boolean;
}

/**
 * Docker Deployment Executor
 *
 * Handles Docker-based deployments including:
 * - Pre-flight checks
 * - Image building
 * - Container deployment
 * - Container management (start, stop, restart, delete)
 * - Log retrieval
 */
export class DockerDeploymentExecutor {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  /**
   * Run pre-flight checks before deployment
   */
  async runPreFlightChecks(
    configPath: string,
    requestedPorts: number[] = []
  ): Promise<PreFlightResult> {
    const checks: PreFlightCheck[] = [];

    // Check 1: Docker installed
    checks.push(await this.checkDockerInstalled());

    // Check 2: Docker daemon running
    checks.push(await this.checkDockerRunning());

    // Check 3: Dockerfile exists
    checks.push(await this.checkDockerfileExists(configPath));

    // Check 4: Ports available
    for (const port of requestedPorts) {
      checks.push(await this.checkPortAvailable(port));
    }

    // Check 5: Sufficient disk space
    checks.push(await this.checkDiskSpace());

    const passed = checks.every((c) => c.status !== 'failed');

    return { passed, checks };
  }

  /**
   * Check if Docker is installed
   */
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

  /**
   * Check if Docker daemon is running
   */
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

  /**
   * Check if Dockerfile exists in config path
   */
  private async checkDockerfileExists(configPath: string): Promise<PreFlightCheck> {
    const dockerfilePath = path.join(configPath, 'Dockerfile');

    if (fs.existsSync(dockerfilePath)) {
      return {
        name: 'Dockerfile Exists',
        status: 'passed',
        message: 'Dockerfile found in config directory',
      };
    }

    return {
      name: 'Dockerfile Exists',
      status: 'failed',
      message: 'Dockerfile not found in config directory',
      fix: 'Generate a Dockerfile configuration for this project',
    };
  }

  /**
   * Check if a port is available
   */
  private async checkPortAvailable(port: number): Promise<PreFlightCheck> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve({
            name: `Port ${port} Available`,
            status: 'failed',
            message: `Port ${port} is already in use`,
            fix: `Stop the process using port ${port} or use a different port`,
          });
        } else {
          resolve({
            name: `Port ${port} Available`,
            status: 'warning',
            message: `Could not check port ${port}: ${err.message}`,
          });
        }
      });

      server.once('listening', () => {
        server.close();
        resolve({
          name: `Port ${port} Available`,
          status: 'passed',
          message: `Port ${port} is available`,
        });
      });

      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Check available disk space
   */
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

  /**
   * Check if Docker Compose is available (v2 plugin)
   */
  async checkDockerComposeInstalled(): Promise<PreFlightCheck> {
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

  /**
   * Check if docker-compose.yml exists in path
   */
  async checkComposeFileExists(workDir: string): Promise<PreFlightCheck> {
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

  /**
   * Validate docker-compose.yml syntax using dclint schema validation
   * This catches invalid properties like Kubernetes-specific fields
   */
  async validateComposeFile(workDir: string): Promise<PreFlightCheck> {
    const composeFile = path.join(workDir, 'docker-compose.yml');
    const composeYamlFile = path.join(workDir, 'docker-compose.yaml');

    if (!fs.existsSync(composeFile) && !fs.existsSync(composeYamlFile)) {
      return {
        name: 'Compose Validation',
        status: 'warning',
        message: 'No compose file to validate (will be caught by file check)',
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

  /**
   * Parse exposed ports from Dockerfile
   */
  async parseDockerfilePorts(dockerfilePath: string): Promise<number[]> {
    if (!fs.existsSync(dockerfilePath)) {
      return [];
    }

    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    const ports: number[] = [];

    const exposeRegex = /^EXPOSE\s+(\d+(?:\/(?:tcp|udp))?(?:\s+\d+(?:\/(?:tcp|udp))?)*)/gim;
    let match;

    while ((match = exposeRegex.exec(content)) !== null) {
      const portStr = match[1];
      const portMatches = portStr.match(/\d+/g);
      if (portMatches) {
        for (const port of portMatches) {
          ports.push(parseInt(port, 10));
        }
      }
    }

    return [...new Set(ports)];
  }

  /**
   * Build a Docker image using Docker CLI
   *
   * We use the Docker CLI instead of dockerode's buildImage because:
   * 1. BuildKit (default in modern Docker) has different output formats
   * 2. Multi-stage builds don't always report imageId correctly via API
   * 3. Docker CLI handles tagging reliably
   */
  async buildImage(options: DockerBuildOptions): Promise<DockerBuildResult> {
    const {
      contextPath,
      dockerfilePath = 'Dockerfile',
      imageTag,
      buildArgs = {},
      onProgress,
    } = options;

    let buildLogs = '';

    try {
      onProgress?.({
        type: 'status',
        message: 'Starting Docker build...',
      });

      // Build the docker build command
      let cmd = `docker build -t "${imageTag}" -f "${dockerfilePath}"`;

      // Add build args
      for (const [key, value] of Object.entries(buildArgs)) {
        cmd += ` --build-arg "${key}=${value}"`;
      }

      cmd += ` "${contextPath}"`;

      // Execute the build
      const { stdout, stderr } = await execAsync(cmd, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for build output
      });

      buildLogs = stdout + (stderr ? `\n${stderr}` : '');

      // Extract image ID from build output
      let imageId: string | undefined;

      // Try to find image ID from "Successfully built" message (legacy builder)
      const legacyMatch = buildLogs.match(/Successfully built ([a-f0-9]+)/);
      if (legacyMatch) {
        imageId = legacyMatch[1];
      }

      // Try to find from "writing image sha256:" (BuildKit)
      const buildkitMatch = buildLogs.match(/writing image sha256:([a-f0-9]+)/i);
      if (buildkitMatch) {
        imageId = buildkitMatch[1].substring(0, 12);
      }

      // Verify the image exists
      try {
        const { stdout: inspectOutput } = await execAsync(
          `docker inspect "${imageTag}" --format "{{.Id}}"`
        );
        imageId = inspectOutput.trim().replace('sha256:', '').substring(0, 12);
      } catch {
        // Image inspect failed
      }

      onProgress?.({
        type: 'status',
        message: 'Build completed successfully',
      });

      return {
        success: true,
        imageId,
        imageTag,
        buildLogs,
      };
    } catch (error: any) {
      // Extract build logs from error output
      const errorOutput = error.stdout || error.stderr || error.message;
      buildLogs += errorOutput;

      onProgress?.({
        type: 'error',
        message: 'Build failed',
      });

      return {
        success: false,
        imageTag,
        buildLogs,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Deploy (run) a Docker container
   */
  async deploy(options: DockerDeployOptions): Promise<DockerDeployResult> {
    const { imageTag, containerName, ports, environmentVariables, onProgress } = options;

    try {
      onProgress?.({
        type: 'status',
        message: 'Creating container...',
      });

      // Build port bindings
      const portBindings: Docker.PortMap = {};
      const exposedPorts: Record<string, object> = {};

      for (const mapping of ports) {
        const containerPort = `${mapping.container}/${mapping.protocol || 'tcp'}`;
        exposedPorts[containerPort] = {};
        portBindings[containerPort] = [
          {
            HostIp: '0.0.0.0',
            HostPort: String(mapping.host),
          },
        ];
      }

      // Build environment array
      const env = Object.entries(environmentVariables).map(([key, value]) => `${key}=${value}`);

      // Create container
      const container = await this.docker.createContainer({
        Image: imageTag,
        name: containerName,
        ExposedPorts: exposedPorts,
        Env: env,
        HostConfig: {
          PortBindings: portBindings,
          RestartPolicy: {
            Name: 'unless-stopped',
          },
        },
      });

      onProgress?.({
        type: 'status',
        message: 'Starting container...',
      });

      // Start container
      await container.start();

      const containerId = container.id;

      // Determine deploy URL (first port mapping)
      let deployUrl: string | undefined;
      if (ports.length > 0) {
        deployUrl = `http://localhost:${ports[0].host}`;
      }

      onProgress?.({
        type: 'info',
        message: `Container started: ${containerId.substring(0, 12)}`,
      });

      return {
        success: true,
        containerId,
        deployUrl,
        ports,
      };
    } catch (error: any) {
      return {
        success: false,
        ports,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Start a stopped container
   */
  async start(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.start();
  }

  /**
   * Stop a running container
   */
  async stop(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.stop();
  }

  /**
   * Restart a container
   */
  async restart(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.restart();
  }

  /**
   * Remove a container (optionally force)
   */
  async remove(containerId: string, force = false): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.remove({ force });
  }

  /**
   * Remove a Docker image
   */
  async removeImage(imageTag: string, force = false): Promise<void> {
    const image = this.docker.getImage(imageTag);
    await image.remove({ force });
  }

  /**
   * Get container logs
   */
  async getLogs(
    containerId: string,
    options: { tail?: number; since?: number } = {}
  ): Promise<string> {
    const container = this.docker.getContainer(containerId);

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: options.tail ?? 100,
      since: options.since ?? 0,
      timestamps: true,
    });

    if (Buffer.isBuffer(logs)) {
      return this.demuxDockerLogs(logs);
    }

    // Handle string or stream
    if (typeof logs === 'string') {
      return logs;
    }

    return '';
  }

  /**
   * Demux Docker log stream (remove stream headers)
   */
  private demuxDockerLogs(buffer: Buffer): string {
    const lines: string[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 8 > buffer.length) break;

      const size = buffer.readUInt32BE(offset + 4);
      offset += 8;

      if (offset + size > buffer.length) break;

      const line = buffer.slice(offset, offset + size).toString('utf-8');
      lines.push(line);
      offset += size;
    }

    return lines.join('');
  }

  /**
   * Get container status
   */
  async getStatus(containerId: string): Promise<ContainerStatus | null> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      const running = info.State.Running;
      let status: DeploymentStatus;

      if (running) {
        status = 'running';
      } else if (info.State.ExitCode === 0) {
        status = 'stopped';
      } else {
        status = 'failed';
      }

      // Parse port mappings
      const ports: PortMapping[] = [];
      const portBindings = info.HostConfig.PortBindings || {};

      for (const [containerPort, bindings] of Object.entries(portBindings)) {
        const bindingsArray = bindings as Array<{ HostIp: string; HostPort: string }> | undefined;
        if (bindingsArray && bindingsArray.length > 0) {
          const [portNum] = containerPort.split('/');
          const protocol = containerPort.includes('/udp') ? 'udp' : 'tcp';

          ports.push({
            host: parseInt(bindingsArray[0].HostPort, 10),
            container: parseInt(portNum, 10),
            protocol: protocol as 'tcp' | 'udp',
          });
        }
      }

      return {
        status,
        containerId,
        running,
        ports,
        startedAt: info.State.StartedAt,
        exitCode: info.State.ExitCode,
      };
    } catch {
      return null;
    }
  }

  /**
   * Write environment variables to a .env file
   */
  writeEnvFile(envVars: Record<string, string>, outputPath: string): void {
    const content = Object.entries(envVars)
      .map(([key, value]) => {
        // Escape special characters in value
        const escapedValue =
          value.includes(' ') || value.includes('"') ? `"${value.replace(/"/g, '\\"')}"` : value;
        return `${key}=${escapedValue}`;
      })
      .join('\n');

    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  /**
   * List all containers (optionally filter by label)
   */
  async listContainers(filters?: { label?: string[] }): Promise<Docker.ContainerInfo[]> {
    const options: Docker.ContainerListOptions = {
      all: true,
    };

    if (filters?.label && filters.label.length > 0) {
      options.filters = { label: filters.label };
    }

    return await this.docker.listContainers(options);
  }

  /**
   * Run pre-flight checks for Docker Compose deployment
   */
  async runComposePreFlightChecks(workDir: string): Promise<PreFlightResult> {
    const checks: PreFlightCheck[] = [];

    checks.push(await this.checkDockerInstalled());
    checks.push(await this.checkDockerRunning());
    checks.push(await this.checkDockerComposeInstalled());
    checks.push(await this.checkComposeFileExists(workDir));
    checks.push(await this.validateComposeFile(workDir));
    checks.push(await this.checkDiskSpace());

    const passed = checks.every((c) => c.status !== 'failed');

    return { passed, checks };
  }

  /**
   * Start services with Docker Compose
   */
  async composeUp(options: ComposeUpOptions): Promise<ComposeUpResult> {
    const { workDir, projectName, envVars = {}, build = true, detach = true, onProgress } = options;

    let logs = '';

    try {
      onProgress?.({
        type: 'status',
        message: 'Starting Docker Compose deployment...',
      });

      if (envVars && Object.keys(envVars).length > 0) {
        const envPath = path.join(workDir, '.env');
        this.writeEnvFile(envVars, envPath);
        onProgress?.({
          type: 'info',
          message: 'Environment variables written to .env file',
        });
      }

      let cmd = `docker compose -p "${projectName}"`;
      cmd += ` -f "${path.join(workDir, 'docker-compose.yml')}"`;
      cmd += ' up';
      if (build) cmd += ' --build';
      if (detach) cmd += ' -d';

      onProgress?.({
        type: 'status',
        message: 'Building and starting services...',
      });

      const { stdout, stderr } = await execAsync(cmd, {
        cwd: workDir,
        maxBuffer: 50 * 1024 * 1024,
        env: { ...process.env, ...envVars },
      });

      logs = stdout + (stderr ? `\n${stderr}` : '');

      const services = await this.getComposeServices(workDir, projectName);

      onProgress?.({
        type: 'status',
        message: `Services started: ${services.join(', ')}`,
      });

      return {
        success: true,
        projectName,
        services,
        logs,
      };
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || error.message;
      logs += errorOutput;

      onProgress?.({
        type: 'error',
        message: 'Docker Compose deployment failed',
      });

      return {
        success: false,
        projectName,
        services: [],
        errorMessage: error.message,
        logs,
      };
    }
  }

  /**
   * Stop and remove Docker Compose services
   */
  async composeDown(
    workDir: string,
    projectName: string,
    options: { removeVolumes?: boolean; removeImages?: 'all' | 'local' } = {}
  ): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      let cmd = `docker compose -p "${projectName}"`;
      cmd += ` -f "${path.join(workDir, 'docker-compose.yml')}"`;
      cmd += ' down';
      if (options.removeVolumes) cmd += ' -v';
      if (options.removeImages) cmd += ` --rmi ${options.removeImages}`;

      await execAsync(cmd, { cwd: workDir });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Get Docker Compose project status
   */
  async composePs(workDir: string, projectName: string): Promise<ComposeProjectStatus> {
    try {
      const cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" ps --format json`;
      const { stdout } = await execAsync(cmd, { cwd: workDir });

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
        projectName,
        services,
        running,
      };
    } catch {
      return {
        projectName,
        services: [],
        running: false,
      };
    }
  }

  /**
   * Parse compose container status string
   */
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

  /**
   * Get logs from Docker Compose services
   */
  async composeLogs(
    workDir: string,
    projectName: string,
    options: { tail?: number; since?: string; service?: string } = {}
  ): Promise<string> {
    try {
      let cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" logs`;
      if (options.tail) cmd += ` --tail ${options.tail}`;
      if (options.since) cmd += ` --since ${options.since}`;
      if (options.service) cmd += ` ${options.service}`;

      const { stdout, stderr } = await execAsync(cmd, {
        cwd: workDir,
        maxBuffer: 10 * 1024 * 1024,
      });

      return stdout + (stderr || '');
    } catch (error: any) {
      return `Error getting logs: ${error.message}`;
    }
  }

  /**
   * Start stopped Docker Compose services
   */
  async composeStart(
    workDir: string,
    projectName: string
  ): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      const cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" start`;
      await execAsync(cmd, { cwd: workDir });
      return { success: true };
    } catch (error: any) {
      return { success: false, errorMessage: error.message };
    }
  }

  /**
   * Stop Docker Compose services (without removing)
   */
  async composeStop(
    workDir: string,
    projectName: string
  ): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      const cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" stop`;
      await execAsync(cmd, { cwd: workDir });
      return { success: true };
    } catch (error: any) {
      return { success: false, errorMessage: error.message };
    }
  }

  /**
   * Restart Docker Compose services
   */
  async composeRestart(
    workDir: string,
    projectName: string
  ): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      const cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" restart`;
      await execAsync(cmd, { cwd: workDir });
      return { success: true };
    } catch (error: any) {
      return { success: false, errorMessage: error.message };
    }
  }

  /**
   * Get list of services defined in compose file
   */
  private async getComposeServices(workDir: string, projectName: string): Promise<string[]> {
    try {
      const cmd = `docker compose -p "${projectName}" -f "${path.join(workDir, 'docker-compose.yml')}" config --services`;
      const { stdout } = await execAsync(cmd, { cwd: workDir });
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Get the URL to access the first exposed service
   */
  async getComposeDeployUrl(workDir: string, projectName: string): Promise<string | undefined> {
    const status = await this.composePs(workDir, projectName);

    for (const service of status.services) {
      if (service.ports.length > 0) {
        const firstPort = service.ports[0];
        const hostPort = firstPort.split(':')[0];
        if (hostPort && hostPort !== '0') {
          return `http://localhost:${hostPort}`;
        }
      }
    }

    return undefined;
  }
}
