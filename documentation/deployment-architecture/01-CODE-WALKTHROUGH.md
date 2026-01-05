# Deployment Architecture - Code Walkthrough

## File Locations

### Backend (API)

| File                                                   | Purpose                         |
| ------------------------------------------------------ | ------------------------------- |
| `apps/api/src/services/executors/types.ts`             | Interface definitions and types |
| `apps/api/src/services/executors/registry.ts`          | ExecutorRegistry class          |
| `apps/api/src/services/executors/docker.executor.ts`   | Docker Compose executor         |
| `apps/api/src/services/executors/index.ts`             | Exports and initialization      |
| `apps/api/src/services/deployment-executor.service.ts` | High-level orchestration        |
| `apps/api/src/routes/deployments.ts`                   | tRPC endpoints                  |

### Frontend (Web)

| File                                                  | Purpose                      |
| ----------------------------------------------------- | ---------------------------- |
| `apps/web/components/configuration/DeploymentTab.tsx` | Deployment UI with preflight |

### Shared Types

| File                                      | Purpose                                  |
| ----------------------------------------- | ---------------------------------------- |
| `packages/shared/src/types/deployment.ts` | PreFlightCheck, DeploymentPlatform types |

## Key Functions Reference

### Executor Interface (`types.ts`)

```typescript
// Line 95-153
export interface IDeploymentExecutor {
  readonly platform: DeploymentPlatform;
  runPreFlightChecks(options: PreFlightOptions): Promise<PreFlightResult>;
  deploy(options: DeployOptions): Promise<DeployResult>;
  // ... other methods
}
```

### Executor Registry (`registry.ts`)

```typescript
// Line 19-43
export class ExecutorRegistry {
  register(executor: IDeploymentExecutor): void { ... }
  get(platform: DeploymentPlatform): IDeploymentExecutor { ... }
  getSupportedPlatforms(): DeploymentPlatform[] { ... }
}
```

### Docker Executor (`docker.executor.ts`)

Key methods:

| Method               | Line    | Purpose                                           |
| -------------------- | ------- | ------------------------------------------------- |
| `runPreFlightChecks` | 59-73   | Main preflight entry point                        |
| `deploy`             | 75-127  | Docker Compose deployment                         |
| `checkImagesExist`   | 429-500 | Validates Docker images in registry               |
| `checkImageExists`   | 502-509 | Checks single image via `docker manifest inspect` |

### Deployment Executor Service (`deployment-executor.service.ts`)

Key sections:

| Method               | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `createDeployment`   | Orchestrates full deployment flow                 |
| `runPreFlightChecks` | Exposes preflight checks to API                   |
| Lines 208-262        | Service mode processing (provision/external/none) |

### Deployment Routes (`deployments.ts`)

```typescript
// Line 278-292
runPreFlightChecks: protectedProcedure
  .input(z.object({ configSetId, platform }))
  .mutation(async ({ input, ctx }) => {
    return executor.runPreFlightChecks(userId, configSetId, platform);
  });
```

### Frontend Preflight UI (`DeploymentTab.tsx`)

| Section                | Lines   | Purpose                           |
| ---------------------- | ------- | --------------------------------- |
| Preflight state        | 156-159 | State for checks, passed, loading |
| Preflight mutation     | 268-279 | tRPC mutation call                |
| useEffect for auto-run | 281-292 | Runs preflight when dialog opens  |
| Preflight checklist UI | 574-641 | Renders check results with icons  |
| Deploy button disable  | 754-759 | Disables if preflight fails       |

## Data Flow

### Preflight Check Flow

```
User opens deploy modal
       ↓
useEffect triggers
       ↓
preflightMutation.mutate()
       ↓
tRPC: deployments.runPreFlightChecks
       ↓
DeploymentExecutorService.runPreFlightChecks()
       ↓
ExecutorRegistry.get(platform)
       ↓
DockerDeploymentExecutor.runPreFlightChecks()
       ↓
[checkDockerInstalled, checkDockerRunning, checkImagesExist, ...]
       ↓
Results returned to UI
       ↓
Deploy button enabled/disabled based on results
```

### Deploy Flow

```
User clicks Deploy
       ↓
createMutation.mutate()
       ↓
tRPC: deployments.create
       ↓
DeploymentExecutorService.createDeployment()
       ↓
1. Copy files to build directory
2. Process docker-compose.yml (remove external/none services)
3. Run preflight checks again
4. executor.deploy() - Docker Compose up
5. Get service URLs
6. Update database with status
       ↓
SSE progress updates to UI
```

## How to Modify

### Adding a new preflight check

1. Add check method in `docker.executor.ts`:

```typescript
private async checkMyThing(): Promise<PreFlightCheck> {
  // ... your check logic
  return { name: 'My Check', status: 'passed', message: '...' };
}
```

2. Add to `runPreFlightChecks`:

```typescript
checks.push(await this.checkMyThing());
```

### Adding a new platform

1. Create `apps/api/src/services/executors/railway.executor.ts`
2. Implement `IDeploymentExecutor`
3. Register in `initializeExecutors()`
4. Add platform to shared types

### Modifying service mode behavior

Edit `deployment-executor.service.ts` lines 235-262:

```typescript
if (configService.sourceMode === 'external' || configService.sourceMode === 'none') {
  // Remove service from compose
}
// For 'provision' mode: keep AI-generated service as-is
```
