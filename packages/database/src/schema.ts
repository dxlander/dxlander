import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Users table - admin accounts and team members
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name'),
    role: text('role').notNull().default('admin'), // admin, user
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
  })
);

// Projects table - CORE project information only
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),

    // Source information
    sourceType: text('source_type', {
      enum: ['github', 'gitlab', 'bitbucket', 'zip', 'git', 'local'],
    }).notNull(),
    sourceUrl: text('source_url'),
    sourceHash: text('source_hash').notNull(), // For duplicate detection
    sourceBranch: text('source_branch'),

    // Local storage path (in ~/.dxlander/projects/)
    localPath: text('local_path'),

    // Import metadata
    filesCount: integer('files_count'),
    projectSize: integer('project_size'),

    // Basic metadata (from import, before analysis)
    language: text('language'),

    // Status tracking
    status: text('status').notNull().default('imported'), // imported, configured, deployed

    // References to latest versions (for quick access)
    latestAnalysisId: text('latest_analysis_id'), // FK to analysis_runs
    latestConfigSetId: text('latest_config_set_id'), // FK to config_sets

    // Deployment info
    lastDeployedAt: integer('last_deployed_at', { mode: 'timestamp' }),
    deployUrl: text('deploy_url'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('projects_user_id_idx').on(table.userId),
    statusIdx: index('projects_status_idx').on(table.status),
    sourceHashIdx: index('projects_source_hash_idx').on(table.sourceHash),
  })
);

// Analysis Runs - Each analysis attempt creates a new row (supports multiple versions)
export const analysisRuns = sqliteTable(
  'analysis_runs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    userId: text('user_id').notNull(),

    // Version tracking
    version: integer('version').notNull(),

    // Analysis metadata
    status: text('status').notNull().default('pending'), // pending, analyzing, complete, failed, cancelled
    progress: integer('progress').default(0), // 0-100

    // AI model info
    aiModel: text('ai_model'),
    aiProvider: text('ai_provider'),

    // Results
    confidence: integer('confidence'), // 0-100
    results: text('results'), // JSON: comprehensive analysis data

    // Error tracking
    errorMessage: text('error_message'),
    errorDetails: text('error_details'),

    // Timing
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    duration: integer('duration'), // seconds

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    projectIdIdx: index('analysis_runs_project_id_idx').on(table.projectId),
    statusIdx: index('analysis_runs_status_idx').on(table.status),
    versionIdx: index('analysis_runs_version_idx').on(table.projectId, table.version),
  })
);

// Analysis Activity Logs - Track AI actions during analysis
export const analysisActivityLogs = sqliteTable(
  'analysis_activity_logs',
  {
    id: text('id').primaryKey(),
    analysisRunId: text('analysis_run_id').notNull(),

    // Log entry details
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
    action: text('action').notNull(),
    status: text('status').notNull(), // pending, in_progress, complete, error

    // Results
    result: text('result'),
    details: text('details'), // JSON array

    // File tracking
    fileName: text('file_name'),

    // Performance
    duration: integer('duration'), // milliseconds

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    analysisRunIdIdx: index('activity_logs_analysis_run_id_idx').on(table.analysisRunId),
    timestampIdx: index('activity_logs_timestamp_idx').on(table.timestamp),
  })
);

// Config Sets - Group of related config files (Docker, Kubernetes, etc.)
export const configSets = sqliteTable(
  'config_sets',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    analysisRunId: text('analysis_run_id'), // Which analysis generated this
    userId: text('user_id').notNull(),

    // Config set metadata
    name: text('name').notNull(),
    type: text('type').notNull(), // 'docker', 'kubernetes', 'bash', 'ci-cd'
    version: integer('version').notNull(),

    // Local storage path (in ~/.dxlander/projects/{projectId}/configs/{configId}/)
    localPath: text('local_path'),

    // Status
    status: text('status').notNull().default('pending'), // pending, generating, complete, failed
    progress: integer('progress').default(0),

    // Source tracking
    generatedBy: text('generated_by').notNull(), // 'ai', 'user', 'template'
    aiModel: text('ai_model'),

    // Metadata
    description: text('description'),
    tags: text('tags'), // JSON array
    notes: text('notes'), // User-added deployment notes

    // Error tracking
    errorMessage: text('error_message'),

    // Timing
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    duration: integer('duration'), // seconds

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    projectIdIdx: index('config_sets_project_id_idx').on(table.projectId),
    typeIdx: index('config_sets_type_idx').on(table.type),
    versionIdx: index('config_sets_version_idx').on(table.projectId, table.version),
    statusIdx: index('config_sets_status_idx').on(table.status),
  })
);

// Config Generation Activity Logs - Track AI actions during config generation
export const configActivityLogs = sqliteTable(
  'config_activity_logs',
  {
    id: text('id').primaryKey(),
    configSetId: text('config_set_id').notNull(),

    // Activity details
    action: text('action').notNull(), // 'write_file', 'read_file', 'thinking', 'planning'
    status: text('status').notNull(), // 'started', 'completed', 'failed'
    result: text('result'), // Result/output of the action
    details: text('details'), // JSON: additional context

    timestamp: integer('timestamp', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    configSetIdIdx: index('config_activity_logs_config_set_id_idx').on(table.configSetId),
    timestampIdx: index('config_activity_logs_timestamp_idx').on(table.timestamp),
  })
);

// Config Files - Individual files within a config set
export const configFiles = sqliteTable(
  'config_files',
  {
    id: text('id').primaryKey(),
    configSetId: text('config_set_id').notNull(),

    // File metadata
    fileName: text('file_name').notNull(),
    filePath: text('file_path'),
    fileType: text('file_type').notNull(),

    // Content
    content: text('content').notNull(),

    // Metadata
    description: text('description'),
    language: text('language'),

    // Validation
    isValid: integer('is_valid', { mode: 'boolean' }).default(true),
    validationErrors: text('validation_errors'),

    // Size
    sizeBytes: integer('size_bytes'),

    // Order for displaying files
    order: integer('order_index').default(0),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    configSetIdIdx: index('config_files_config_set_id_idx').on(table.configSetId),
    fileNameIdx: index('config_files_file_name_idx').on(table.fileName),
  })
);

// Config Optimizations - Track applied optimizations
export const configOptimizations = sqliteTable(
  'config_optimizations',
  {
    id: text('id').primaryKey(),
    configSetId: text('config_set_id').notNull(),

    // Optimization details
    name: text('name').notNull(),
    category: text('category').notNull(),
    description: text('description'),

    // Impact metrics
    impact: text('impact'),
    estimatedSavings: text('estimated_savings'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    configSetIdIdx: index('config_optimizations_config_set_id_idx').on(table.configSetId),
  })
);

// Build Runs - Track local build attempts
export const buildRuns = sqliteTable(
  'build_runs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    configSetId: text('config_set_id').notNull(),
    userId: text('user_id').notNull(),

    // Build metadata
    buildType: text('build_type').notNull(), // 'local', 'ci', 'cloud'
    status: text('status').notNull().default('pending'),

    // Build results
    imageSize: integer('image_size'),
    buildLogs: text('build_logs'),
    errorMessage: text('error_message'),

    // Timing
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    duration: integer('duration'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    projectIdIdx: index('build_runs_project_id_idx').on(table.projectId),
    statusIdx: index('build_runs_status_idx').on(table.status),
  })
);

// Deployments table - deployment history
export const deployments = sqliteTable(
  'deployments',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    configSetId: text('config_set_id'),
    buildRunId: text('build_run_id'),
    userId: text('user_id').notNull(),

    // Deployment metadata
    platform: text('platform').notNull(),
    environment: text('environment').notNull().default('production'),
    status: text('status').notNull().default('pending'),

    // Deployment results
    deployUrl: text('deploy_url'),
    previewUrl: text('preview_url'),
    buildLogs: text('build_logs'),
    errorMessage: text('error_message'),

    // Timing
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    projectIdIdx: index('deployments_project_id_idx').on(table.projectId),
    statusIdx: index('deployments_status_idx').on(table.status),
  })
);

// Settings table - system configuration (like setup completion status)
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value'), // JSON string
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Encryption Keys - DEPRECATED: Now using file-based storage (~/.dxlander/encryption.key)
// Keeping table definition commented for reference during migration
// export const encryptionKeys = sqliteTable('encryption_keys', { ... })

// AI Providers - Configuration for AI services (Claude, OpenAI, Ollama, etc.)
export const aiProviders = sqliteTable(
  'ai_providers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Provider information
    name: text('name').notNull(), // User-friendly name: "Production Claude", "Dev OpenAI"
    provider: text('provider').notNull(), // 'claude-code', 'openai', 'anthropic', 'ollama', 'lmstudio', 'openrouter'

    // Encrypted credentials (encrypted with master key)
    encryptedApiKey: text('encrypted_api_key'), // For cloud providers
    encryptedConfig: text('encrypted_config'), // Additional config (JSON, encrypted)

    // Provider-specific settings (not sensitive, stored as JSON)
    settings: text('settings'), // { model, temperature, maxTokens, baseUrl (for Ollama/LM Studio) }

    // Status
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),

    // Connection health
    lastTested: integer('last_tested', { mode: 'timestamp' }),
    lastTestStatus: text('last_test_status'), // 'success', 'failed'
    lastError: text('last_error'),

    // Usage tracking
    usageCount: integer('usage_count').default(0),
    lastUsed: integer('last_used', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('ai_providers_user_id_idx').on(table.userId),
    providerIdx: index('ai_providers_provider_idx').on(table.provider),
    isActiveIdx: index('ai_providers_is_active_idx').on(table.isActive),
  })
);

// Integrations - Third-party service credentials (Supabase, Stripe, AWS, etc.)
export const integrations = sqliteTable(
  'integrations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Integration metadata
    name: text('name').notNull(), // "Production Supabase", "Stripe Live Keys"
    service: text('service').notNull(), // 'supabase', 'stripe', 'aws-s3', etc.
    serviceType: text('service_type').notNull(), // 'database', 'payment', 'storage', 'email', 'auth'

    // Credential type and storage
    credentialType: text('credential_type').notNull(), // 'api_key', 'json_service_account', 'oauth_token', 'connection_string', 'key_value'
    encryptedCredentials: text('encrypted_credentials').notNull(), // Encrypted JSON with all credential data

    // Auto-detection metadata
    detectedIn: text('detected_in'), // JSON array of project IDs where this was detected
    autoInjected: integer('auto_injected', { mode: 'boolean' }).default(true), // Auto-inject when detected

    // Connection health
    status: text('status').notNull().default('unknown'), // 'connected', 'error', 'unknown'
    lastTested: integer('last_tested', { mode: 'timestamp' }),
    lastError: text('last_error'),

    // Usage tracking
    usageCount: integer('usage_count').default(0),
    lastUsed: integer('last_used', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('integrations_user_id_idx').on(table.userId),
    serviceIdx: index('integrations_service_idx').on(table.service),
    serviceTypeIdx: index('integrations_service_type_idx').on(table.serviceType),
  })
);

// Deployment Credentials - Platform-specific deployment keys (Vercel, Railway, AWS, etc.)
export const deploymentCredentials = sqliteTable(
  'deployment_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Platform information
    name: text('name').notNull(), // "Vercel Production", "Railway Staging"
    platform: text('platform').notNull(), // 'vercel', 'railway', 'netlify', 'aws', 'gcp', 'docker-registry'

    // Encrypted credentials
    encryptedApiKey: text('encrypted_api_key'),
    encryptedConfig: text('encrypted_config'), // Additional config (JSON, encrypted)

    // Platform-specific settings (not sensitive)
    settings: text('settings'), // { region, projectId, orgId, etc. }

    // Status
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),

    // Connection health
    lastTested: integer('last_tested', { mode: 'timestamp' }),
    lastTestStatus: text('last_test_status'),
    lastError: text('last_error'),

    // Usage tracking
    usageCount: integer('usage_count').default(0),
    lastUsed: integer('last_used', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('deployment_credentials_user_id_idx').on(table.userId),
    platformIdx: index('deployment_credentials_platform_idx').on(table.platform),
  })
);

// Audit Logs - Track all credential access and modifications for security
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),

    // Event details
    action: text('action').notNull(), // 'credential_accessed', 'credential_created', 'credential_updated', 'credential_deleted', 'key_rotated'
    resourceType: text('resource_type').notNull(), // 'ai_provider', 'integration', 'deployment_credential', 'encryption_key'
    resourceId: text('resource_id').notNull(),

    // Context
    metadata: text('metadata'), // JSON with additional context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    // Status
    status: text('status').notNull(), // 'success', 'failed'
    errorMessage: text('error_message'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
);

// Export all tables
export const schema = {
  users,
  projects,
  analysisRuns,
  analysisActivityLogs,
  configSets,
  configActivityLogs,
  configFiles,
  configOptimizations,
  buildRuns,
  deployments,
  settings,
  aiProviders,
  integrations,
  deploymentCredentials,
  auditLogs,
};
