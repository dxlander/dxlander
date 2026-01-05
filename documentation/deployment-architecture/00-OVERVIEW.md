# Deployment Architecture Overview

This document describes the extensible deployment architecture in DXLander.

## Core Principles

1. **Pluggable Executors**: Each deployment platform (Docker, Railway, Vercel) has its own executor
2. **Trust AI-Generated Configs**: For 'provision' mode, keep AI-generated service configs as-is
3. **Pre-flight Validation**: Run checks BEFORE deployment to catch issues early
4. **Universal Project Support**: Works with any project - no hardcoded service lists

## Architecture Components

### Executor Interface (`IDeploymentExecutor`)

All deployment platforms implement this interface:

```typescript
interface IDeploymentExecutor {
  readonly platform: DeploymentPlatform;

  runPreFlightChecks(options: PreFlightOptions): Promise<PreFlightResult>;
  deploy(options: DeployOptions): Promise<DeployResult>;
  start(workDir: string, projectName: string): Promise<Result>;
  stop(workDir: string, projectName: string): Promise<Result>;
  restart(workDir: string, projectName: string): Promise<Result>;
  delete(workDir: string, projectName: string, options?: DeleteOptions): Promise<void>;
  getLogs(workDir: string, projectName: string, options?: LogOptions): Promise<string>;
  getStatus(workDir: string, projectName: string): Promise<StatusResult>;
  getDeployUrls(
    workDir: string,
    projectName: string,
    envVars?: Record<string, string>
  ): Promise<UrlResult[]>;
}
```

### Executor Registry

Manages available executors and provides them by platform:

```typescript
const registry = getExecutorRegistry();
const executor = registry.get('docker'); // or 'railway', 'vercel'
await executor.deploy(options);
```

### Pre-flight Checks

Checks run BEFORE the user clicks deploy:

1. **Docker Installed** - Verifies Docker CLI is available
2. **Docker Daemon Running** - Pings Docker daemon
3. **Docker Compose** - Verifies Compose plugin is installed
4. **Compose File** - Checks docker-compose.yml exists
5. **Compose Validation** - Validates YAML syntax
6. **Docker Images** - Validates images exist in registry (only for 'provision' mode services)
7. **Disk Space** - Ensures sufficient disk space

## Service Mode Behavior

| Mode        | Action on Deploy                                                  |
| ----------- | ----------------------------------------------------------------- |
| `provision` | Keep AI-generated service in docker-compose.yml                   |
| `external`  | Remove service from docker-compose.yml (user provides connection) |
| `none`      | Remove service from docker-compose.yml                            |

## Adding a New Platform

To add a new deployment platform (e.g., Railway):

1. Create `apps/api/src/services/executors/railway.executor.ts`
2. Implement `IDeploymentExecutor` interface
3. Register in `apps/api/src/services/executors/index.ts`:

```typescript
export function initializeExecutors(): void {
  const registry = getExecutorRegistry();
  registry.register(new DockerDeploymentExecutor());
  registry.register(new RailwayDeploymentExecutor()); // Add new executor
}
```

4. Each platform can have its own pre-flight checks specific to that platform

## File Structure

```
apps/api/src/services/executors/
├── types.ts              # IDeploymentExecutor interface and types
├── registry.ts           # ExecutorRegistry class
├── docker.executor.ts    # Docker Compose executor
└── index.ts              # Exports and initialization
```

## Future Features (Documented for Later)

### "Fix with AI" Button

When deployment fails, show a "Fix with AI" button that:

1. Collects error logs and pre-flight results
2. Sends to AI for analysis
3. AI suggests fixes (e.g., correct image tag)
4. User reviews and approves fix
5. Retry deployment

This feature is NOT implemented yet but documented for future development.
