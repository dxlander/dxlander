/**
 * AI Tools - Public Exports
 *
 * Provides tools that AI models can use to explore and analyze projects.
 */

export { createProjectAnalysisTools, createConfigGenerationTools } from './definitions';
export type { ToolContext, ValidationError } from './implementations';
export {
  readFileImpl,
  grepSearchImpl,
  globFindImpl,
  listDirectoryImpl,
  writeFileImpl,
  validateDockerComposeImpl,
} from './implementations';

export {
  createDeploymentTools,
  deploymentToolNames,
  type DeploymentToolName,
} from './deployment-definitions';
export type {
  DeploymentToolContext,
  DeploymentProgressEvent,
  DockerExecutorInterface,
} from './deployment-implementations';
export {
  runPreFlightChecksImpl,
  detectDockerfilePortsImpl,
  buildDockerImageImpl,
  runDockerContainerImpl,
  stopDockerContainerImpl,
  startDockerContainerImpl,
  restartDockerContainerImpl,
  removeDockerContainerImpl,
  getContainerLogsImpl,
  getContainerStatusImpl,
  writeEnvFileImpl,
} from './deployment-implementations';

// Recovery Agent Tools
export {
  recoveryAgentToolDefinitions,
  recoveryAgentToolNames,
  RECOVERY_AGENT_SYSTEM_PROMPT,
  AI_DEPLOYMENT_SYSTEM_PROMPT,
  buildRecoveryContext,
  buildAIDeploymentContext,
  ReadDeploymentFileSchema,
  WriteDeploymentFileSchema,
  ListDeploymentFilesSchema,
  GetDeploymentLogsSchema,
  ReportProgressSchema,
  CompleteSessionSchema,
  CheckServiceHealthSchema,
  CheckEndpointHealthSchema,
  GetContainerLogsSchema,
  type ToolDefinition,
  type RecoveryAgentToolName,
  type ReadFileResult,
  type WriteFileResult,
  type ListFilesResult,
  type PreFlightResult,
  type DeployResult,
  type LogsResult,
  type ValidateResult,
  type ServiceHealthResult,
  type EndpointHealthResult,
  type ContainerLogsResult,
} from './recovery-agent-tools';
