import { z } from 'zod';

/**
 * Config Service Types
 *
 * Defines how third-party services (databases, caches, etc.) are configured for deployment:
 * - provision: Create a new container as part of the deployment (only for provisionable services)
 * - external: Use external credentials (manual entry OR reference to Secret Manager)
 * - none: Skip this service / remove from deployment
 */

export const ServiceSourceModeSchema = z.enum(['provision', 'external', 'none']);
export type ServiceSourceMode = z.infer<typeof ServiceSourceModeSchema>;

/**
 * Service category - helps determine available source modes
 */
export const ServiceCategorySchema = z.enum([
  'database', // PostgreSQL, MySQL, MongoDB, etc. - usually provisionable
  'cache', // Redis, Memcached - usually provisionable
  'search', // Elasticsearch, Meilisearch - usually provisionable
  'storage', // MinIO, S3 - some provisionable
  'queue', // RabbitMQ, Kafka - usually provisionable
  'email', // SendGrid, Mailgun, SES - NOT provisionable (SaaS)
  'payment', // Stripe, PayPal - NOT provisionable (SaaS)
  'auth', // Auth0, Clerk, Supabase Auth - NOT provisionable (SaaS)
  'analytics', // Mixpanel, Amplitude - NOT provisionable (SaaS)
  'monitoring', // Sentry, DataDog - NOT provisionable (SaaS)
  'ai', // OpenAI, Anthropic - NOT provisionable (SaaS)
  'api', // Generic external APIs - NOT provisionable
  'other', // Unknown/custom - user decides
]);
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;

/**
 * Known provisionable services that can be created as containers
 */
export const KnownProvisionableServiceSchema = z.enum([
  'postgresql',
  'mysql',
  'mariadb',
  'mongodb',
  'redis',
  'memcached',
  'elasticsearch',
  'minio',
  'rabbitmq',
  'kafka',
]);
export type KnownProvisionableService = z.infer<typeof KnownProvisionableServiceSchema>;

/**
 * Container configuration for provisioned services
 */
export const ProvisionConfigSchema = z.object({
  image: z.string(),
  tag: z.string().default('latest'),
  port: z.number(),
  internalPort: z.number(),
  volumes: z.array(z.string()).optional(),
  environment: z.record(z.string()).optional(),
  healthCheck: z
    .object({
      command: z.string(),
      interval: z.string().default('10s'),
      timeout: z.string().default('5s'),
      retries: z.number().default(5),
    })
    .optional(),
});
export type ProvisionConfig = z.infer<typeof ProvisionConfigSchema>;

/**
 * Credentials for provisioned database services
 */
export const ProvisionedCredentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
  database: z.string().optional(),
  host: z.string().default('localhost'),
  port: z.number(),
});
export type ProvisionedCredentials = z.infer<typeof ProvisionedCredentialsSchema>;

/**
 * Per-field credential configuration for external mode
 * Each field can be either manual entry or a reference to Secret Manager
 */
export const SecretCredentialFieldSchema = z.object({
  type: z.enum(['manual', 'reference']),
  value: z.string().optional(), // Only for type='manual' (will be encrypted)
  secretId: z.string().optional(), // Only for type='reference' - points to secrets table
  secretKey: z.string().optional(), // Only for type='reference' - which key within that secret
});
export type SecretCredentialField = z.infer<typeof SecretCredentialFieldSchema>;

/**
 * Secret credentials mapping (env var key -> credential config)
 */
export const SecretCredentialsSchema = z.record(SecretCredentialFieldSchema);
export type SecretCredentials = z.infer<typeof SecretCredentialsSchema>;

/**
 * Detected service from AI analysis (editable by user)
 */
export const DetectedServiceEditableSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: ServiceCategorySchema,
  detectedFrom: z.string().optional(),
  isRequired: z.boolean().default(true),
  isProvisionable: z.boolean().default(false),
  knownService: KnownProvisionableServiceSchema.optional(),
  requiredEnvVars: z.array(
    z.object({
      key: z.string(),
      description: z.string().optional(),
      example: z.string().optional(),
    })
  ),
  notes: z.string().optional(),
  isEdited: z.boolean().default(false),
});
export type DetectedServiceEditable = z.infer<typeof DetectedServiceEditableSchema>;

/**
 * Config service configuration (how to get credentials for deployment)
 */
export const ConfigServiceSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  category: ServiceCategorySchema,
  mode: ServiceSourceModeSchema,

  // Provision mode: create a container
  provisionConfig: z
    .object({
      service: KnownProvisionableServiceSchema.optional(),
      customService: z.string().optional(),
      image: z.string().optional(),
      tag: z.string().optional(),
      credentials: ProvisionedCredentialsSchema.optional(),
      customEnv: z.record(z.string()).optional(),
      volumes: z.array(z.string()).optional(),
    })
    .optional(),

  // External mode: per-field credentials (manual or reference to Secret Manager)
  secretCredentials: SecretCredentialsSchema.optional(),

  // Generated env vars (resolved from any mode)
  generatedEnvVars: z.record(z.string()).optional(),
});
export type ConfigService = z.infer<typeof ConfigServiceSchema>;

/**
 * Default configurations for provisionable services
 */
export interface ProvisionableServiceConfig {
  name: string;
  service: KnownProvisionableService;
  defaultImage: string;
  defaultTag: string;
  defaultPort: number;
  envVarPrefix: string;
  connectionStringTemplate: string;
  requiredCredentials: string[];
  defaultCredentials: {
    username: string;
    password: string;
    database?: string;
  };
  healthCheck: {
    command: string;
    interval: string;
    timeout: string;
    retries: number;
  };
  dockerComposeService: (credentials: ProvisionedCredentials) => Record<string, unknown>;
}

/**
 * Provisionable service configurations
 */
export const PROVISIONABLE_SERVICES: Record<KnownProvisionableService, ProvisionableServiceConfig> =
  {
    postgresql: {
      name: 'PostgreSQL',
      service: 'postgresql',
      defaultImage: 'postgres',
      defaultTag: '16-alpine',
      defaultPort: 5432,
      envVarPrefix: 'POSTGRES',
      connectionStringTemplate: 'postgresql://{username}:{password}@{host}:{port}/{database}',
      requiredCredentials: ['username', 'password', 'database'],
      defaultCredentials: {
        username: 'postgres',
        password: '', // Will be generated
        database: 'app',
      },
      healthCheck: {
        command: 'pg_isready -U postgres',
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
      dockerComposeService: (creds) => ({
        image: 'postgres:16-alpine',
        environment: {
          POSTGRES_USER: creds.username,
          POSTGRES_PASSWORD: creds.password,
          POSTGRES_DB: creds.database || 'app',
        },
        volumes: ['postgres_data:/var/lib/postgresql/data'],
        ports: [`${creds.port}:5432`],
        healthcheck: {
          test: ['CMD-SHELL', 'pg_isready -U postgres'],
          interval: '10s',
          timeout: '5s',
          retries: 5,
        },
      }),
    },
    mysql: {
      name: 'MySQL',
      service: 'mysql',
      defaultImage: 'mysql',
      defaultTag: '8.0',
      defaultPort: 3306,
      envVarPrefix: 'MYSQL',
      connectionStringTemplate: 'mysql://{username}:{password}@{host}:{port}/{database}',
      requiredCredentials: ['username', 'password', 'database'],
      defaultCredentials: {
        username: 'root',
        password: '',
        database: 'app',
      },
      healthCheck: {
        command: 'mysqladmin ping -h localhost',
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
      dockerComposeService: (creds) => ({
        image: 'mysql:8.0',
        environment: {
          MYSQL_ROOT_PASSWORD: creds.password,
          MYSQL_DATABASE: creds.database || 'app',
          MYSQL_USER: creds.username,
          MYSQL_PASSWORD: creds.password,
        },
        volumes: ['mysql_data:/var/lib/mysql'],
        ports: [`${creds.port}:3306`],
        healthcheck: {
          test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost'],
          interval: '10s',
          timeout: '5s',
          retries: 5,
        },
      }),
    },
    mariadb: {
      name: 'MariaDB',
      service: 'mariadb',
      defaultImage: 'mariadb',
      defaultTag: '11',
      defaultPort: 3306,
      envVarPrefix: 'MARIADB',
      connectionStringTemplate: 'mysql://{username}:{password}@{host}:{port}/{database}',
      requiredCredentials: ['username', 'password', 'database'],
      defaultCredentials: {
        username: 'root',
        password: '',
        database: 'app',
      },
      healthCheck: {
        command: 'healthcheck.sh --connect --innodb_initialized',
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
      dockerComposeService: (creds) => ({
        image: 'mariadb:11',
        environment: {
          MARIADB_ROOT_PASSWORD: creds.password,
          MARIADB_DATABASE: creds.database || 'app',
          MARIADB_USER: creds.username,
          MARIADB_PASSWORD: creds.password,
        },
        volumes: ['mariadb_data:/var/lib/mysql'],
        ports: [`${creds.port}:3306`],
        healthcheck: {
          test: ['CMD', 'healthcheck.sh', '--connect', '--innodb_initialized'],
          interval: '10s',
          timeout: '5s',
          retries: 5,
        },
      }),
    },
    mongodb: {
      name: 'MongoDB',
      service: 'mongodb',
      defaultImage: 'mongo',
      defaultTag: '7.0',
      defaultPort: 27017,
      envVarPrefix: 'MONGO',
      connectionStringTemplate: 'mongodb://{username}:{password}@{host}:{port}/{database}',
      requiredCredentials: ['username', 'password', 'database'],
      defaultCredentials: {
        username: 'admin',
        password: '',
        database: 'app',
      },
      healthCheck: {
        command: 'mongosh --eval "db.adminCommand(\'ping\')"',
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
      dockerComposeService: (creds) => ({
        image: 'mongo:7.0',
        environment: {
          MONGO_INITDB_ROOT_USERNAME: creds.username,
          MONGO_INITDB_ROOT_PASSWORD: creds.password,
          MONGO_INITDB_DATABASE: creds.database || 'app',
        },
        volumes: ['mongo_data:/data/db'],
        ports: [`${creds.port}:27017`],
        healthcheck: {
          test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"],
          interval: '10s',
          timeout: '5s',
          retries: 5,
        },
      }),
    },
    redis: {
      name: 'Redis',
      service: 'redis',
      defaultImage: 'redis',
      defaultTag: '7-alpine',
      defaultPort: 6379,
      envVarPrefix: 'REDIS',
      connectionStringTemplate: 'redis://:{password}@{host}:{port}',
      requiredCredentials: ['password'],
      defaultCredentials: {
        username: '',
        password: '',
      },
      healthCheck: {
        command: 'redis-cli ping',
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
      dockerComposeService: (creds) => ({
        image: 'redis:7-alpine',
        command: creds.password ? `redis-server --requirepass ${creds.password}` : undefined,
        volumes: ['redis_data:/data'],
        ports: [`${creds.port}:6379`],
        healthcheck: {
          test: ['CMD', 'redis-cli', 'ping'],
          interval: '10s',
          timeout: '5s',
          retries: 5,
        },
      }),
    },
    memcached: {
      name: 'Memcached',
      service: 'memcached',
      defaultImage: 'memcached',
      defaultTag: '1.6-alpine',
      defaultPort: 11211,
      envVarPrefix: 'MEMCACHED',
      connectionStringTemplate: '{host}:{port}',
      requiredCredentials: [],
      defaultCredentials: {
        username: '',
        password: '',
      },
      healthCheck: {
        command: 'echo stats | nc localhost 11211',
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
      dockerComposeService: (creds) => ({
        image: 'memcached:1.6-alpine',
        ports: [`${creds.port}:11211`],
      }),
    },
    elasticsearch: {
      name: 'Elasticsearch',
      service: 'elasticsearch',
      defaultImage: 'docker.elastic.co/elasticsearch/elasticsearch',
      defaultTag: '8.11.0',
      defaultPort: 9200,
      envVarPrefix: 'ELASTICSEARCH',
      connectionStringTemplate: 'http://{host}:{port}',
      requiredCredentials: ['password'],
      defaultCredentials: {
        username: 'elastic',
        password: '',
      },
      healthCheck: {
        command: 'curl -s http://localhost:9200/_cluster/health',
        interval: '30s',
        timeout: '10s',
        retries: 5,
      },
      dockerComposeService: (creds) => ({
        image: 'docker.elastic.co/elasticsearch/elasticsearch:8.11.0',
        environment: {
          'discovery.type': 'single-node',
          'xpack.security.enabled': 'true',
          ELASTIC_PASSWORD: creds.password,
        },
        volumes: ['elasticsearch_data:/usr/share/elasticsearch/data'],
        ports: [`${creds.port}:9200`],
        healthcheck: {
          test: ['CMD-SHELL', 'curl -s http://localhost:9200/_cluster/health'],
          interval: '30s',
          timeout: '10s',
          retries: 5,
        },
      }),
    },
    minio: {
      name: 'MinIO (S3-compatible)',
      service: 'minio',
      defaultImage: 'minio/minio',
      defaultTag: 'latest',
      defaultPort: 9000,
      envVarPrefix: 'MINIO',
      connectionStringTemplate: 'http://{host}:{port}',
      requiredCredentials: ['username', 'password'],
      defaultCredentials: {
        username: 'minioadmin',
        password: '',
      },
      healthCheck: {
        command: 'mc ready local',
        interval: '30s',
        timeout: '20s',
        retries: 3,
      },
      dockerComposeService: (creds) => ({
        image: 'minio/minio:latest',
        command: 'server /data --console-address ":9001"',
        environment: {
          MINIO_ROOT_USER: creds.username,
          MINIO_ROOT_PASSWORD: creds.password,
        },
        volumes: ['minio_data:/data'],
        ports: [`${creds.port}:9000`, '9001:9001'],
        healthcheck: {
          test: ['CMD', 'mc', 'ready', 'local'],
          interval: '30s',
          timeout: '20s',
          retries: 3,
        },
      }),
    },
    rabbitmq: {
      name: 'RabbitMQ',
      service: 'rabbitmq',
      defaultImage: 'rabbitmq',
      defaultTag: '3-management-alpine',
      defaultPort: 5672,
      envVarPrefix: 'RABBITMQ',
      connectionStringTemplate: 'amqp://{username}:{password}@{host}:{port}',
      requiredCredentials: ['username', 'password'],
      defaultCredentials: {
        username: 'guest',
        password: '',
      },
      healthCheck: {
        command: 'rabbitmq-diagnostics -q ping',
        interval: '30s',
        timeout: '30s',
        retries: 3,
      },
      dockerComposeService: (creds) => ({
        image: 'rabbitmq:3-management-alpine',
        environment: {
          RABBITMQ_DEFAULT_USER: creds.username,
          RABBITMQ_DEFAULT_PASS: creds.password,
        },
        volumes: ['rabbitmq_data:/var/lib/rabbitmq'],
        ports: [`${creds.port}:5672`, '15672:15672'],
        healthcheck: {
          test: ['CMD', 'rabbitmq-diagnostics', '-q', 'ping'],
          interval: '30s',
          timeout: '30s',
          retries: 3,
        },
      }),
    },
    kafka: {
      name: 'Apache Kafka',
      service: 'kafka',
      defaultImage: 'bitnami/kafka',
      defaultTag: 'latest',
      defaultPort: 9092,
      envVarPrefix: 'KAFKA',
      connectionStringTemplate: '{host}:{port}',
      requiredCredentials: [],
      defaultCredentials: {
        username: '',
        password: '',
      },
      healthCheck: {
        command: 'kafka-broker-api-versions.sh --bootstrap-server localhost:9092',
        interval: '30s',
        timeout: '10s',
        retries: 5,
      },
      dockerComposeService: (creds) => ({
        image: 'bitnami/kafka:latest',
        environment: {
          KAFKA_CFG_NODE_ID: '0',
          KAFKA_CFG_PROCESS_ROLES: 'controller,broker',
          KAFKA_CFG_LISTENERS: 'PLAINTEXT://:9092,CONTROLLER://:9093',
          KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
          KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: '0@kafka:9093',
          KAFKA_CFG_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
        },
        volumes: ['kafka_data:/bitnami/kafka'],
        ports: [`${creds.port}:9092`],
      }),
    },
  };

/**
 * Get list of known provisionable services for UI dropdown
 */
export function getKnownProvisionableServices(): Array<{
  value: KnownProvisionableService;
  label: string;
  category: ServiceCategory;
}> {
  return [
    { value: 'postgresql', label: 'PostgreSQL', category: 'database' },
    { value: 'mysql', label: 'MySQL', category: 'database' },
    { value: 'mariadb', label: 'MariaDB', category: 'database' },
    { value: 'mongodb', label: 'MongoDB', category: 'database' },
    { value: 'redis', label: 'Redis', category: 'cache' },
    { value: 'memcached', label: 'Memcached', category: 'cache' },
    { value: 'elasticsearch', label: 'Elasticsearch', category: 'search' },
    { value: 'minio', label: 'MinIO (S3-compatible)', category: 'storage' },
    { value: 'rabbitmq', label: 'RabbitMQ', category: 'queue' },
    { value: 'kafka', label: 'Apache Kafka', category: 'queue' },
  ];
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 24): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(length);
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || !cryptoApi.getRandomValues) {
    throw new Error('Secure random number generator not available');
  }
  cryptoApi.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Build connection string from credentials
 */
export function buildConnectionString(
  template: string,
  credentials: ProvisionedCredentials
): string {
  return template
    .replace('{username}', encodeURIComponent(credentials.username))
    .replace('{password}', encodeURIComponent(credentials.password))
    .replace('{host}', credentials.host)
    .replace('{port}', String(credentials.port))
    .replace('{database}', encodeURIComponent(credentials.database || 'app'));
}

/**
 * Input schema for saving config services
 */
export const SaveConfigServicesSchema = z.object({
  configSetId: z.string().min(1),
  services: z.array(ConfigServiceSchema),
});
export type SaveConfigServicesInput = z.infer<typeof SaveConfigServicesSchema>;

/**
 * Categories that typically support provisioning (self-hosted containers)
 */
export const PROVISIONABLE_CATEGORIES: ServiceCategory[] = [
  'database',
  'cache',
  'search',
  'storage',
  'queue',
];

/**
 * Categories that are always SaaS (cannot be self-hosted)
 */
export const SAAS_ONLY_CATEGORIES: ServiceCategory[] = [
  'email',
  'payment',
  'auth',
  'analytics',
  'monitoring',
  'ai',
];

/**
 * Parse category from AI-provided type string
 * Falls back to 'other' if not recognized - user can edit
 */
export function parseCategory(type?: string): ServiceCategory {
  if (!type) return 'other';

  const typeLower = type.toLowerCase();

  const validCategories: ServiceCategory[] = [
    'database',
    'cache',
    'search',
    'storage',
    'queue',
    'email',
    'payment',
    'auth',
    'analytics',
    'monitoring',
    'ai',
    'api',
    'other',
  ];

  if (validCategories.includes(typeLower as ServiceCategory)) {
    return typeLower as ServiceCategory;
  }

  return 'other';
}

/**
 * Get all available categories for UI dropdown
 */
export function getServiceCategories(): Array<{
  value: ServiceCategory;
  label: string;
  isProvisionable: boolean;
}> {
  return [
    { value: 'database', label: 'Database', isProvisionable: true },
    { value: 'cache', label: 'Cache', isProvisionable: true },
    { value: 'search', label: 'Search Engine', isProvisionable: true },
    { value: 'storage', label: 'Object Storage', isProvisionable: true },
    { value: 'queue', label: 'Message Queue', isProvisionable: true },
    { value: 'email', label: 'Email Service', isProvisionable: false },
    { value: 'payment', label: 'Payment Gateway', isProvisionable: false },
    { value: 'auth', label: 'Authentication', isProvisionable: false },
    { value: 'analytics', label: 'Analytics', isProvisionable: false },
    { value: 'monitoring', label: 'Monitoring', isProvisionable: false },
    { value: 'ai', label: 'AI / LLM', isProvisionable: false },
    { value: 'api', label: 'External API', isProvisionable: false },
    { value: 'other', label: 'Other', isProvisionable: false },
  ];
}

/**
 * Determine available source modes for a service
 */
export function getAvailableSourceModes(
  category: ServiceCategory,
  knownService?: KnownProvisionableService | null
): ServiceSourceMode[] {
  const modes: ServiceSourceMode[] = [];

  // Provision mode - only for provisionable categories with known service configs
  if (PROVISIONABLE_CATEGORIES.includes(category) && knownService) {
    modes.push('provision');
  }

  // External mode - always available (per-field manual or reference)
  modes.push('external');

  // None mode - always available (skip this service)
  modes.push('none');

  return modes;
}

/**
 * Check if a category supports provisioning
 */
export function isCategoryProvisionable(category: ServiceCategory): boolean {
  return PROVISIONABLE_CATEGORIES.includes(category);
}

/**
 * Check if a category is SaaS-only (cannot be self-hosted)
 */
export function isCategorySaaSOnly(category: ServiceCategory): boolean {
  return SAAS_ONLY_CATEGORIES.includes(category);
}

/**
 * Get friendly display name for a category
 */
export function getCategoryDisplayName(category: ServiceCategory): string {
  const names: Record<ServiceCategory, string> = {
    database: 'Database',
    cache: 'Cache',
    search: 'Search Engine',
    storage: 'Object Storage',
    queue: 'Message Queue',
    email: 'Email Service',
    payment: 'Payment Gateway',
    auth: 'Authentication',
    analytics: 'Analytics',
    monitoring: 'Monitoring',
    ai: 'AI / LLM',
    api: 'External API',
    other: 'Other',
  };
  return names[category] || category;
}

/**
 * Get friendly display name for a source mode
 */
export function getSourceModeDisplayName(mode: ServiceSourceMode): string {
  const names: Record<ServiceSourceMode, string> = {
    provision: 'Provision Container',
    external: 'Use External',
    none: 'Skip',
  };
  return names[mode] || mode;
}

/**
 * Get description for a source mode
 */
export function getSourceModeDescription(mode: ServiceSourceMode): string {
  const descriptions: Record<ServiceSourceMode, string> = {
    provision: 'Create a new container as part of your deployment (e.g., PostgreSQL, Redis)',
    external: 'Use external credentials (manual entry or from Secret Manager)',
    none: 'This service is not needed or will be configured later',
  };
  return descriptions[mode] || '';
}

/**
 * Detect a known provisionable service from the service name
 * Uses PROVISIONABLE_SERVICES configuration - not hardcoded mappings
 */
function detectKnownService(name: string): KnownProvisionableService | undefined {
  const nameLower = name.toLowerCase();

  // Check each known service from PROVISIONABLE_SERVICES
  for (const key of Object.keys(PROVISIONABLE_SERVICES) as KnownProvisionableService[]) {
    const config = PROVISIONABLE_SERVICES[key];
    // Match by service key or display name
    if (nameLower.includes(key) || nameLower.includes(config.name.toLowerCase())) {
      return key;
    }
  }

  return undefined;
}

/**
 * Convert AI-detected service to editable format
 *
 * The AI provides: name, type, detectedFrom, optional, requiredKeys, notes
 * We convert this to an editable format where user can change anything
 */
export function toEditableService(
  detected: {
    name: string;
    type: string;
    detectedFrom?: string;
    optional?: boolean;
    requiredKeys?: string[];
    notes?: string;
  },
  index: number
): DetectedServiceEditable {
  const category = parseCategory(detected.type);
  const categoryInfo = getServiceCategories().find((c) => c.value === category);

  // Try to detect a known provisionable service from the name
  const knownService = categoryInfo?.isProvisionable
    ? detectKnownService(detected.name)
    : undefined;

  return {
    id: `service-${index}-${Date.now()}`,
    name: detected.name,
    category,
    detectedFrom: detected.detectedFrom,
    isRequired: !detected.optional,
    isProvisionable: categoryInfo?.isProvisionable ?? false,
    knownService,
    requiredEnvVars: (detected.requiredKeys || []).map((key) => ({
      key,
      description: undefined,
      example: undefined,
    })),
    notes: detected.notes,
    isEdited: false,
  };
}

/**
 * Create a blank service for manual addition
 */
export function createBlankService(): DetectedServiceEditable {
  return {
    id: `service-new-${Date.now()}`,
    name: '',
    category: 'other',
    detectedFrom: 'Manually added',
    isRequired: false,
    isProvisionable: false,
    knownService: undefined,
    requiredEnvVars: [],
    notes: undefined,
    isEdited: true,
  };
}
