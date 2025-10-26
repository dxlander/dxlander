/**
 * AI Provider Types
 *
 * Defines the contract that all AI providers must implement.
 * This ensures consistent behavior regardless of which AI service is used.
 */

import type { ProjectFile } from '../../types';

/**
 * Supported AI providers
 */
export type AIProviderType =
  | 'claude-agent-sdk' // Official Claude Agent SDK (most powerful)
  | 'claude-code' // Legacy name (alias for claude-agent-sdk)
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'lmstudio';

/**
 * AI model configuration
 */
export interface AIModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * AI provider configuration
 */
export interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;
  settings?: any;
}

/**
 * Message role
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Chat message
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/**
 * AI completion request
 */
export interface AICompletionRequest {
  messages: ChatMessage[];
  model?: string; // Override default model
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * AI completion response
 */
export interface AICompletionResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

/**
 * Project file type re-exported from shared types
 */
export type { ProjectFile };

/**
 * Analysis progress callback
 */
export type AnalysisProgressCallback = (_event: {
  type: 'tool_use' | 'thinking' | 'text' | 'progress';
  action?: string; // e.g., 'read_file', 'grep', 'glob'
  details?: string; // e.g., file path, search pattern
  message?: string; // Human-readable message
}) => void | Promise<void>;

/**
 * Project analysis context
 */
export interface ProjectContext {
  files: ProjectFile[];
  projectPath?: string; // Absolute path to project root directory
  readme?: string;
  packageJson?: any;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  onStreamEvent?: (_event: any) => void;
  onProgress?: (_event: {
    type: 'tool_use' | 'thinking' | 'text' | 'progress';
    action?: string;
    details?: string;
    message?: string;
  }) => void | Promise<void>;
}

/**
 * Project summary and overview
 */
export interface ProjectSummary {
  overview: string; // Brief 2-3 sentence summary
  purpose: string; // What problem does this solve?
  deployable: boolean; // Can this be deployed? (libraries, CLI tools may not be)
  deploymentNotes: string; // Deployment considerations
}

/**
 * Framework type classification
 */
export type FrameworkType = 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop' | 'cli';

/**
 * Framework detection result
 */
export interface FrameworkDetection {
  name: string; // 'Next.js', 'React', 'Vue', 'Express', 'FastAPI', etc.
  version?: string;
  type: FrameworkType;
  confidence: number; // 0-100
  evidence: string[]; // What indicated this framework
}

/**
 * Project structure information
 */
export interface ProjectStructure {
  rootDirectory: string;
  sourceDirectory?: string; // Main source code directory (e.g., src/, app/, lib/)
  configFiles: string[]; // Important config files found
  entryPoints: string[]; // Main entry point files
  hasTests: boolean;
  testDirectory?: string; // tests/ or __tests__/ if found
  hasDocumentation: boolean;
  documentationFiles: string[]; // README.md, docs/, etc.
}

/**
 * Dependency analysis
 */
export interface DependencyAnalysis {
  production: Array<{
    name: string;
    version: string;
    purpose?: string;
  }>;
  development: Array<{
    name: string;
    version: string;
    purpose?: string;
  }>;
  totalCount: number;
  outdatedWarnings?: string[]; // Packages that might be outdated
}

/**
 * Environment variable detection
 */
export interface EnvironmentVariable {
  name: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
  example?: string;
  detectedIn: string[]; // Files where this variable is used
  linkedIntegration?: string; // Name of integration this env var belongs to
}

/**
 * Integration type classification
 * These are EXTERNAL SERVICES requiring credentials/authentication
 */
export type IntegrationType =
  | 'database' // PostgreSQL, MongoDB, MySQL, Supabase, PlanetScale
  | 'cache' // Redis, Memcached
  | 'queue' // RabbitMQ, AWS SQS, Google Pub/Sub
  | 'storage' // AWS S3, Google Cloud Storage, Cloudinary
  | 'payment' // Stripe, PayPal, Square
  | 'auth' // Auth0, Clerk, Firebase Auth, Supabase Auth
  | 'email' // SendGrid, Mailgun, AWS SES, Resend
  | 'sms' // Twilio, Vonage
  | 'analytics' // Mixpanel, Segment, PostHog
  | 'monitoring' // Sentry, Datadog, New Relic
  | 'ai' // OpenAI, Anthropic, Cohere, Replicate
  | 'search' // Algolia, Elasticsearch, Meilisearch
  | 'cdn' // Cloudflare, Fastly
  | 'deployment' // Vercel, Railway, AWS, GCP, Azure
  | 'api' // Generic REST/GraphQL APIs
  | 'other'; // Other third-party services

/**
 * Integration detection
 */
export interface IntegrationDetection {
  name: string; // Friendly name: 'Supabase', 'Stripe', 'PostgreSQL Database', 'AWS S3'
  service: string; // Technical identifier: 'supabase', 'stripe', 'postgresql', 'aws-s3'
  type: IntegrationType;
  confidence: number; // 0-100: confidence in detection
  requiredKeys: string[]; // ALL required environment variable keys
  optionalKeys?: string[]; // Optional environment variable keys
  detectedFrom: string; // Human-readable: "Found in .env.example and src/lib/supabase.ts"
  files: string[]; // Specific files where this integration is used
  credentialType:
    | 'api_key'
    | 'connection_string'
    | 'json_service_account'
    | 'oauth_token'
    | 'multiple'; // Type of credentials needed
  requiresSignup: boolean; // Does user need to create an account with this service?
  optional: boolean; // Is this integration optional for the app to function?
}

/**
 * Built-in capabilities and features (NOT external integrations)
 * These are features that don't require external credentials
 */
export interface BuiltInCapability {
  name: string; // 'Browser LocalStorage', 'File Upload', 'WebSockets', 'Service Workers'
  type: 'storage' | 'upload' | 'realtime' | 'offline' | 'media' | 'other';
  description: string;
  detectedIn: string[]; // Files where this capability is used
}

/**
 * Build configuration
 */
export interface BuildConfiguration {
  buildCommand?: string;
  startCommand?: string;
  devCommand?: string;
  testCommand?: string;
  lintCommand?: string;
  outputDirectory?: string;
  ports: number[]; // Projects can listen on multiple ports
  runtime?: string; // Runtime version info (e.g., Node.js 20, Python 3.11)
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip' | 'cargo' | 'go' | 'maven' | 'gradle';
}

/**
 * Security analysis
 */
export interface SecurityAnalysis {
  hasEnvExample: boolean; // Has .env.example file
  hasDotenvFile: boolean; // Has .env file (should be gitignored)
  exposedSecrets: string[]; // Potential exposed secrets (files to review)
  securityIssues: string[]; // Security concerns discovered
  recommendations: string[]; // Security best practices to implement
}

/**
 * Project type classification
 */
export type ProjectType =
  | 'monorepo' // Multiple packages/apps in one repo
  | 'single-app' // Single application
  | 'library' // Reusable library/package
  | 'cli-tool' // Command-line tool
  | 'microservices'; // Multiple services

/**
 * Project analysis result (what AI returns)
 */
export interface ProjectAnalysisResult {
  summary: ProjectSummary; // High-level overview and deployment assessment
  frameworks: FrameworkDetection[]; // ARRAY - projects can have multiple frameworks
  language: {
    primary: string;
    breakdown: Record<string, number>; // { 'TypeScript': 70, 'CSS': 20, 'JSON': 10 }
  };
  projectType: ProjectType;
  projectStructure: ProjectStructure;
  dependencies: DependencyAnalysis;
  integrations: IntegrationDetection[]; // ONLY external services requiring credentials
  builtInCapabilities?: BuiltInCapability[]; // Browser APIs, localStorage, etc. (NOT integrations)
  environmentVariables: EnvironmentVariable[];
  buildConfig: BuildConfiguration;
  security: SecurityAnalysis;
  recommendations: string[];
  warnings?: string[];
}

/**
 * Deployment configuration generation request
 */
export interface DeploymentConfigRequest {
  analysisResult: ProjectAnalysisResult;
  projectContext: ProjectContext;
  configType: 'docker' | 'docker-compose' | 'kubernetes' | 'bash' | 'vercel' | 'railway';
  optimizeFor?: 'speed' | 'size' | 'security' | 'cost';
}

/**
 * Generated configuration file
 * Note: The AI writes files directly to disk using Write tool.
 * The content field is optional since files are read from disk afterward.
 */
export interface GeneratedConfigFile {
  fileName: string;
  content?: string; // Optional - files are written to disk by AI, read back by service
  description?: string;
}

/**
 * Deployment configuration result
 */
export interface DeploymentConfigResult {
  configType: string;
  projectSummary?: {
    overview: string;
    framework: string;
    runtime: string;
    buildTool: string;
    isMultiService: boolean;
    services: string[];
    mainPort?: number;
    dependencies?: {
      production: string[];
      development?: string[];
    };
  };
  integrations?: {
    detected: Array<{
      name: string;
      type: string;
      requiredKeys: string[];
      optional: boolean;
      detectedFrom: string;
    }>;
    databases?: string[];
    caches?: string[];
    queues?: string[];
  };
  environmentVariables?: {
    required: Array<{
      key: string;
      description: string;
      example?: string;
      integration?: string;
    }>;
    optional?: Array<{
      key: string;
      description: string;
      example?: string;
    }>;
  };
  files: GeneratedConfigFile[];
  deployment?: {
    instructions: string;
    buildCommand?: string;
    runCommand?: string;
    estimatedBuildTime?: number; // seconds
    estimatedImageSize?: number; // MB
  };
  recommendations?: string[];
  // Legacy fields for backward compatibility
  instructions?: string;
  estimatedBuildTime?: number;
  estimatedImageSize?: number;
}

/**
 * AI Provider Interface
 *
 * Every AI provider (Claude Code, OpenAI, Ollama, etc.) must implement this interface.
 * This ensures they all work the same way from the application's perspective.
 */
export interface IAIProvider {
  /**
   * Provider name
   */
  readonly name: AIProviderType;

  /**
   * Initialize the provider with configuration
   */
  initialize(_config: AIProviderConfig): Promise<void>;

  /**
   * Test connection to AI service
   */
  testConnection(): Promise<boolean>;

  /**
   * Get available models
   */
  getAvailableModels(): Promise<string[]>;

  /**
   * Send chat completion request
   */
  chat(_request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * Analyze a project
   */
  analyzeProject(_context: ProjectContext): Promise<ProjectAnalysisResult>;

  /**
   * Generate deployment configuration
   */
  generateDeploymentConfig(_request: DeploymentConfigRequest): Promise<DeploymentConfigResult>;

  /**
   * Check if provider is ready
   */
  isReady(): boolean;
}

/**
 * AI provider factory options
 */
export interface AIProviderFactoryOptions {
  encryptedApiKey?: string;
  encryptedConfig?: string;
  settings?: any;
  decrypt: (_encrypted: string) => string; // Decryption function
}
