import { z } from 'zod';

// Project related types
export const ProjectSourceSchema = z.enum(['github', 'upload', 'zip', 'folder']);
export type ProjectSource = z.infer<typeof ProjectSourceSchema>;

export const ProjectFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  size: z.number(),
  isDirectory: z.boolean().default(false),
});
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

export const DependencySchema = z.object({
  name: z.string(),
  version: z.string(),
  type: z.enum(['dependency', 'devDependency', 'peerDependency']),
  purpose: z.string().optional(),
});
export type Dependency = z.infer<typeof DependencySchema>;

export const IntegrationSchema = z.object({
  service: z.string(),
  type: z.enum(['database', 'auth', 'storage', 'api', 'analytics', 'payment']),
  detected: z.boolean(),
  required: z.boolean(),
  envVars: z.array(z.string()).default([]),
});
export type Integration = z.infer<typeof IntegrationSchema>;

export const AnalysisResultSchema = z.object({
  framework: z.string(),
  language: z.string(),
  dependencies: z.array(DependencySchema),
  buildCommands: z.array(z.string()),
  startCommand: z.string().optional(),
  port: z.number().default(3000),
  environmentVariables: z.array(z.string()),
  integrations: z.array(IntegrationSchema),
  staticAssets: z.array(z.string()),
  databaseRequired: z.boolean().default(false),
  dockerizable: z.boolean().default(true),
  deploymentStrategy: z.string(),
  confidence: z.number().min(0).max(1),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// Database types
export const ProjectSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  name: z.string(),
  sourceType: ProjectSourceSchema,
  sourceUrl: z.string().optional(),
  sourceHash: z.string(),
  framework: z.string().optional(),
  analysis: AnalysisResultSchema.optional(),
  generatedConfigs: z.record(z.string()).optional(),
  detectedIntegrations: z.array(IntegrationSchema).default([]),
  status: z.enum(['imported', 'configured', 'deployed']).default('imported'),
  deploymentHistory: z.array(z.any()).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type Project = z.infer<typeof ProjectSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.date().default(() => new Date()),
});
export type User = z.infer<typeof UserSchema>;

export const DeploymentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  platform: z.string(),
  status: z.enum(['pending', 'deploying', 'success', 'failed']),
  deployUrl: z.string().optional(),
  logs: z.string().optional(),
  deployedAt: z.date().default(() => new Date()),
});
export type Deployment = z.infer<typeof DeploymentSchema>;

// Configuration types
export type { ConfigSet } from './config';

// API types
export const ApiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorSchema.optional(),
    timestamp: z.date().default(() => new Date()),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
};

// Setup wizard types (Simplified MVP approach)
export const SetupConfigSchema = z
  .object({
    // Admin account (required)
    adminEmail: z.string().email('Valid email is required'),
    adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),

    // Optional AI API key (can be set later)
    aiApiKey: z.string().optional(),

    // Use defaults for everything else
    useDefaults: z.boolean().default(true),
  })
  .refine((data) => data.adminPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Default configuration
export const DEFAULT_CONFIG = {
  dbType: 'postgresql' as const,
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT || '5432',
  dbName: process.env.DB_NAME || 'dxlander',
  dbUser: process.env.DB_USER || 'dxlander',
  dbPassword: process.env.DB_PASSWORD || 'dxlander_password',
  aiProvider: 'claude' as const,
  serverPort: 3000,
  logLevel: 'info' as const,
  enableTelemetry: false,
  enableHttps: false,
};

export type SetupConfig = z.infer<typeof SetupConfigSchema>;

export const InstanceConfigSchema = z.object({
  id: z.string(),
  instanceName: z.string(),
  adminUserId: z.string(),
  dbConfig: z.object({
    type: z.enum(['sqlite', 'postgresql', 'mysql']),
    connectionString: z.string(),
    encrypted: z.boolean().default(true),
  }),
  aiConfig: z.object({
    provider: z.enum(['claude', 'openai', 'local']),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    encrypted: z.boolean().default(true),
  }),
  serverConfig: z.object({
    port: z.number(),
    enableHttps: z.boolean(),
    customDomain: z.string().optional(),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']),
  }),
  setupComplete: z.boolean().default(false),
  setupAt: z.date().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type InstanceConfig = z.infer<typeof InstanceConfigSchema>;

export const SetupStepValidationSchema = z.object({
  step: z.enum(['welcome', 'auth', 'database', 'ai', 'advanced']),
  data: z.any(),
  isValid: z.boolean(),
  errors: z.record(z.string()).optional(),
});

export type SetupStepValidation = z.infer<typeof SetupStepValidationSchema>;
