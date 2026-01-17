import { z } from 'zod';

/**
 * Deployment Error Types
 *
 * Structured error handling for deployment failures.
 * These types enable AI-assisted error recovery by providing
 * parsed, actionable error information.
 */

/**
 * Categories of deployment errors
 *
 * These are derived from analyzing Docker/build tool OUTPUT,
 * not from detecting project types (which would be anti-pattern).
 */
export type DeploymentErrorType =
  | 'build_failed' // Docker build or application build failed
  | 'compose_invalid' // docker-compose.yml syntax/schema error
  | 'dockerfile_invalid' // Dockerfile syntax error
  | 'dependency_missing' // Missing package/module dependency
  | 'dependency_conflict' // Version conflicts between dependencies
  | 'port_conflict' // Port already in use on host
  | 'image_not_found' // Base Docker image doesn't exist
  | 'image_pull_failed' // Failed to pull image from registry
  | 'memory_exceeded' // Container OOM killed
  | 'disk_full' // No space left on device
  | 'timeout' // Build or startup timeout
  | 'permission_denied' // File/directory permission issue
  | 'network_error' // Network connectivity issue
  | 'env_var_missing' // Required environment variable not set
  | 'env_var_invalid' // Environment variable has invalid format
  | 'healthcheck_failed' // Container healthcheck failed
  | 'startup_failed' // Application failed to start
  | 'unknown'; // Unclassified error (AI will analyze)

/**
 * Stage where error occurred
 */
export type DeploymentErrorStage =
  | 'pre_flight' // During pre-deployment validation
  | 'build' // During Docker image build
  | 'deploy' // During container startup
  | 'runtime'; // After container started

/**
 * Location in a file where error occurred
 */
export interface ErrorLocation {
  file: string;
  line?: number;
  column?: number;
}

/**
 * Structured deployment error
 */
export interface DeploymentError {
  id: string;
  deploymentId: string;
  type: DeploymentErrorType;
  stage: DeploymentErrorStage;
  message: string;
  location?: ErrorLocation;
  context: string[]; // Relevant log lines around error
  rawError: string; // Original error output
  exitCode?: number;
  timestamp: Date;
}

/**
 * Serialized deployment error for API responses
 */
export interface SerializedDeploymentError {
  id: string;
  deploymentId: string;
  type: DeploymentErrorType;
  stage: DeploymentErrorStage;
  message: string;
  location?: ErrorLocation;
  context: string[];
  rawError: string;
  exitCode?: number;
  timestamp: string;
}

/**
 * Type of fix that can be applied
 */
export type FixType =
  | 'file_edit' // Modify a file (Dockerfile, compose, etc.)
  | 'env_var' // Add/modify environment variable
  | 'command' // Run a command
  | 'config_change' // Change deployment configuration
  | 'manual'; // Requires manual intervention

/**
 * Confidence level for suggested fixes
 */
export type FixConfidence = 'high' | 'medium' | 'low';

/**
 * Suggested fix for an error
 */
export interface FixSuggestion {
  id: string;
  description: string;
  confidence: FixConfidence;
  type: FixType;
  details: FixDetails;
  estimatedImpact?: string;
}

/**
 * Details for different fix types
 */
export interface FixDetails {
  // For file_edit
  file?: string;
  originalContent?: string;
  suggestedContent?: string;
  diff?: string;

  // For env_var
  envVar?: {
    key: string;
    value?: string;
    description?: string;
  };

  // For command
  command?: string;
  workingDirectory?: string;

  // For config_change
  configKey?: string;
  configValue?: unknown;

  // For manual
  instructions?: string;
  documentationUrl?: string;
}

/**
 * Complete error analysis with suggested fixes
 */
export interface ErrorAnalysis {
  error: DeploymentError;
  possibleCauses: string[];
  suggestedFixes: FixSuggestion[];
  relatedErrors?: string[];
  aiAnalysisAvailable: boolean;
}

/**
 * Serialized error analysis for API responses
 */
export interface SerializedErrorAnalysis {
  error: SerializedDeploymentError;
  possibleCauses: string[];
  suggestedFixes: FixSuggestion[];
  relatedErrors?: string[];
  aiAnalysisAvailable: boolean;
}

/**
 * Result of applying a fix
 */
export interface FixResult {
  fixId: string;
  success: boolean;
  message: string;
  changesApplied?: {
    file?: string;
    before?: string;
    after?: string;
  }[];
  error?: string;
}

/**
 * AI recovery session status
 */
export type RecoverySessionStatus =
  | 'pending' // Waiting to start
  | 'analyzing' // AI analyzing the error
  | 'fixing' // AI applying fixes
  | 'retrying' // Retrying deployment
  | 'completed' // Successfully fixed
  | 'failed' // Could not fix
  | 'cancelled'; // User cancelled

/**
 * AI recovery session
 */
export interface RecoverySession {
  id: string;
  deploymentId: string;
  userId: string;
  status: RecoverySessionStatus;
  attemptNumber: number;
  maxAttempts: number;
  errorAnalysis?: ErrorAnalysis;
  fixesApplied: FixResult[];
  aiMessages: RecoveryMessage[];
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Serialized recovery session for API responses
 */
export interface SerializedRecoverySession {
  id: string;
  deploymentId: string;
  userId: string;
  status: RecoverySessionStatus;
  attemptNumber: number;
  maxAttempts: number;
  errorAnalysis?: SerializedErrorAnalysis;
  fixesApplied: FixResult[];
  aiMessages: RecoveryMessage[];
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Message in recovery session (AI or system)
 */
export interface RecoveryMessage {
  id: string;
  role: 'system' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  timestamp: Date;
}

/**
 * Progress event during recovery
 */
export type RecoveryProgressEvent =
  | { type: 'status_change'; status: RecoverySessionStatus; message: string }
  | { type: 'analyzing'; message: string }
  | { type: 'fix_suggested'; fix: FixSuggestion }
  | { type: 'fix_applying'; fixId: string; description: string }
  | { type: 'fix_applied'; result: FixResult }
  | { type: 'retry_started'; attempt: number; maxAttempts: number }
  | { type: 'retry_completed'; success: boolean; error?: string }
  | { type: 'ai_message'; content: string }
  | { type: 'file_modified'; file: string; reason: string }
  | { type: 'session_completed'; success: boolean; deployUrl?: string }
  | { type: 'session_failed'; error: string; suggestions: string[] };

/**
 * Zod schemas for validation
 */
export const DeploymentErrorTypeSchema = z.enum([
  'build_failed',
  'compose_invalid',
  'dockerfile_invalid',
  'dependency_missing',
  'dependency_conflict',
  'port_conflict',
  'image_not_found',
  'image_pull_failed',
  'memory_exceeded',
  'disk_full',
  'timeout',
  'permission_denied',
  'network_error',
  'env_var_missing',
  'env_var_invalid',
  'healthcheck_failed',
  'startup_failed',
  'unknown',
]);

export const DeploymentErrorStageSchema = z.enum(['pre_flight', 'build', 'deploy', 'runtime']);

export const FixTypeSchema = z.enum(['file_edit', 'env_var', 'command', 'config_change', 'manual']);

export const FixConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const RecoverySessionStatusSchema = z.enum([
  'pending',
  'analyzing',
  'fixing',
  'retrying',
  'completed',
  'failed',
  'cancelled',
]);

/**
 * Input for starting a recovery session
 */
export const StartRecoverySessionSchema = z.object({
  deploymentId: z.string().min(1),
  errorContext: z.string().optional(),
  autoApplyFixes: z.boolean().default(false),
  maxAttempts: z.number().min(1).max(5).default(3),
});
export type StartRecoverySessionInput = z.infer<typeof StartRecoverySessionSchema>;

/**
 * Input for applying a suggested fix
 */
export const ApplyFixSchema = z.object({
  sessionId: z.string().min(1),
  fixId: z.string().min(1),
});
export type ApplyFixInput = z.infer<typeof ApplyFixSchema>;

/**
 * Session status (database) - AI-only mode now
 */
export type SessionStatus = 'active' | 'completed' | 'failed' | 'cancelled';

/**
 * File change made during session
 */
export interface FileChange {
  file: string;
  before: string | null;
  after: string;
  reason: string;
  timestamp: string;
}

/**
 * Session progress event for SSE streaming
 */
export type SessionProgressEvent =
  | { type: 'session_started'; sessionId: string }
  | { type: 'attempt_started'; attempt: number; maxAttempts: number }
  | { type: 'analyzing'; message: string }
  | { type: 'ai_message'; content: string }
  | { type: 'tool_call'; tool: string; input: unknown }
  | { type: 'tool_result'; tool: string; output: unknown; success: boolean }
  | { type: 'file_modified'; file: string; reason: string }
  | { type: 'pre_flight_result'; passed: boolean; checks: unknown[] }
  | { type: 'deploy_started' }
  | { type: 'deploy_result'; success: boolean; deployUrl?: string; error?: string }
  | { type: 'build_log'; message: string }
  | { type: 'session_completed'; success: boolean; summary: string; deployUrl?: string }
  | { type: 'session_failed'; error: string; suggestions: string[] };

/**
 * Deployment session data from database (AI-only)
 */
export interface DeploymentSession {
  id: string;
  deploymentId: string;
  userId: string;
  status: SessionStatus;
  customInstructions?: string;
  attemptNumber: number;
  maxAttempts: number;
  agentState?: string;
  agentContext?: string;
  agentMessages?: string;
  fileChanges?: string;
  summary?: string;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Serialized deployment session for API responses
 */
export interface SerializedDeploymentSession {
  id: string;
  deploymentId: string;
  userId: string;
  status: SessionStatus;
  customInstructions?: string;
  attemptNumber: number;
  maxAttempts: number;
  agentState?: string;
  agentContext?: unknown;
  agentMessages?: unknown[];
  fileChanges?: FileChange[];
  summary?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Session activity record
 */
export interface SessionActivityRecord {
  id: string;
  sessionId: string;
  type: 'tool_call' | 'ai_response' | 'user_action' | 'error';
  action: string;
  input?: string;
  output?: string;
  durationMs?: number;
  timestamp: Date;
}

/**
 * Options for starting a deployment session (AI-only)
 */
export interface StartDeploymentSessionOptions {
  projectId: string;
  configSetId: string;
  platform: 'docker' | 'kubernetes' | 'vercel' | 'railway' | 'netlify';
  maxAttempts?: number;
  customInstructions?: string;
}
