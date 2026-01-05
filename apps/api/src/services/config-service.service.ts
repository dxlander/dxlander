import { db, schema } from '@dxlander/database';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  encryptionService,
  type ServiceSourceMode,
  type ServiceCategory,
  type KnownProvisionableService,
  type SecretCredentials,
  toEditableService,
  PROVISIONABLE_SERVICES,
  generateSecurePassword,
  buildConnectionString,
} from '@dxlander/shared';
import { SecretService } from './secret.service';

const secretService = new SecretService();

export interface CreateConfigServiceInput {
  configSetId: string;
  name: string;
  category: ServiceCategory;
  detectedFrom?: string;
  isRequired?: boolean;
  isProvisionable?: boolean;
  knownService?: KnownProvisionableService;
  requiredEnvVars?: Array<{ key: string; description?: string; example?: string }>;
  notes?: string;
  sourceMode?: ServiceSourceMode;
  orderIndex?: number;
  composeServiceName?: string | null;
}

export interface UpdateConfigServiceInput {
  name?: string;
  category?: ServiceCategory;
  isRequired?: boolean;
  isProvisionable?: boolean;
  knownService?: KnownProvisionableService | null;
  requiredEnvVars?: Array<{ key: string; description?: string; example?: string }>;
  notes?: string;
  sourceMode?: ServiceSourceMode;
  provisionConfig?: {
    service?: KnownProvisionableService;
    image?: string;
    tag?: string;
    credentials?: {
      username: string;
      password: string;
      database?: string;
      host?: string;
      port?: number;
    };
    customEnv?: Record<string, string>;
    volumes?: string[];
  } | null;
  secretCredentials?: SecretCredentials;
  orderIndex?: number;
}

export interface SerializedConfigService {
  id: string;
  configSetId: string;
  name: string;
  category: ServiceCategory;
  detectedFrom: string | null;
  isRequired: boolean;
  isProvisionable: boolean;
  knownService: KnownProvisionableService | null;
  requiredEnvVars: Array<{ key: string; description?: string; example?: string }>;
  notes: string | null;
  isEdited: boolean;
  composeServiceName: string | null;
  sourceMode: ServiceSourceMode;
  provisionConfig: {
    service?: KnownProvisionableService;
    image?: string;
    tag?: string;
    credentials?: {
      username: string;
      password: string;
      database?: string;
      host?: string;
      port?: number;
    };
    customEnv?: Record<string, string>;
    volumes?: string[];
  } | null;
  hasSecretCredentials: boolean;
  generatedEnvVars: Record<string, string> | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export class ConfigServiceService {
  /**
   * Create config services from AI-detected services
   *
   * The AI provides composeServiceName which is the exact service name in docker-compose.yml
   * This is used during deployment to add/remove services based on user's mode selection
   */
  static async createFromDetectedServices(
    userId: string,
    configSetId: string,
    detected: Array<{
      name: string;
      type: string;
      detectedFrom?: string;
      optional?: boolean;
      requiredKeys?: string[];
      notes?: string;
      composeServiceName?: string | null;
    }>
  ): Promise<SerializedConfigService[]> {
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    const services: SerializedConfigService[] = [];

    for (let i = 0; i < detected.length; i++) {
      const det = detected[i];
      const editable = toEditableService(det, i);

      const service = await this.createConfigService(userId, {
        configSetId,
        name: editable.name,
        category: editable.category,
        detectedFrom: editable.detectedFrom,
        isRequired: editable.isRequired,
        isProvisionable: editable.isProvisionable,
        knownService: editable.knownService,
        requiredEnvVars: editable.requiredEnvVars,
        notes: editable.notes,
        sourceMode: 'external',
        orderIndex: i,
        composeServiceName: det.composeServiceName,
      });

      services.push(service);
    }

    return services;
  }

  /**
   * Create a single config service
   */
  static async createConfigService(
    userId: string,
    input: CreateConfigServiceInput
  ): Promise<SerializedConfigService> {
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, input.configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(schema.configServices).values({
      id,
      configSetId: input.configSetId,
      name: input.name,
      category: input.category,
      detectedFrom: input.detectedFrom || null,
      isRequired: input.isRequired ?? true,
      isProvisionable: input.isProvisionable ?? false,
      knownService: input.knownService || null,
      requiredEnvVars: input.requiredEnvVars ? JSON.stringify(input.requiredEnvVars) : null,
      notes: input.notes || null,
      isEdited: false,
      composeServiceName: input.composeServiceName || null,
      sourceMode: input.sourceMode || 'external',
      provisionConfig: null,
      secretCredentials: null,
      generatedEnvVars: null,
      orderIndex: input.orderIndex ?? 0,
      createdAt: now,
      updatedAt: now,
    });

    return this.serialize({
      id,
      configSetId: input.configSetId,
      name: input.name,
      category: input.category,
      detectedFrom: input.detectedFrom || null,
      isRequired: input.isRequired ?? true,
      isProvisionable: input.isProvisionable ?? false,
      knownService: input.knownService || null,
      requiredEnvVars: input.requiredEnvVars ? JSON.stringify(input.requiredEnvVars) : null,
      notes: input.notes || null,
      isEdited: false,
      composeServiceName: input.composeServiceName || null,
      sourceMode: input.sourceMode || 'external',
      provisionConfig: null,
      secretCredentials: null,
      generatedEnvVars: null,
      orderIndex: input.orderIndex ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Get all config services for a config set
   */
  static async getConfigServices(
    userId: string,
    configSetId: string
  ): Promise<SerializedConfigService[]> {
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    const services = await db.query.configServices.findMany({
      where: eq(schema.configServices.configSetId, configSetId),
      orderBy: (cs, { asc }) => [asc(cs.orderIndex)],
    });

    return services.map((s) => this.serialize(s));
  }

  /**
   * Get a single config service
   */
  static async getConfigService(
    userId: string,
    serviceId: string
  ): Promise<SerializedConfigService | null> {
    const service = await db.query.configServices.findFirst({
      where: eq(schema.configServices.id, serviceId),
    });

    if (!service) {
      return null;
    }

    const config = await db.query.configSets.findFirst({
      where: and(
        eq(schema.configSets.id, service.configSetId),
        eq(schema.configSets.userId, userId)
      ),
    });

    if (!config) {
      return null;
    }

    return this.serialize(service);
  }

  /**
   * Update a config service
   */
  static async updateConfigService(
    userId: string,
    serviceId: string,
    input: UpdateConfigServiceInput
  ): Promise<SerializedConfigService> {
    const service = await db.query.configServices.findFirst({
      where: eq(schema.configServices.id, serviceId),
    });

    if (!service) {
      throw new Error('Config service not found');
    }

    const config = await db.query.configSets.findFirst({
      where: and(
        eq(schema.configSets.id, service.configSetId),
        eq(schema.configSets.userId, userId)
      ),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    const updates: Record<string, unknown> = {
      isEdited: true,
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.category !== undefined) updates.category = input.category;
    if (input.isRequired !== undefined) updates.isRequired = input.isRequired;
    if (input.isProvisionable !== undefined) updates.isProvisionable = input.isProvisionable;
    if (input.knownService !== undefined) updates.knownService = input.knownService;
    if (input.requiredEnvVars !== undefined) {
      updates.requiredEnvVars = JSON.stringify(input.requiredEnvVars);
    }
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.sourceMode !== undefined) updates.sourceMode = input.sourceMode;
    if (input.orderIndex !== undefined) updates.orderIndex = input.orderIndex;

    if (input.provisionConfig !== undefined) {
      updates.provisionConfig = input.provisionConfig
        ? JSON.stringify(input.provisionConfig)
        : null;
    }

    if (input.secretCredentials !== undefined) {
      if (input.secretCredentials && Object.keys(input.secretCredentials).length > 0) {
        const processedCredentials: SecretCredentials = {};
        for (const [key, field] of Object.entries(input.secretCredentials)) {
          if (field.type === 'manual' && field.value) {
            processedCredentials[key] = {
              type: 'manual',
              value: encryptionService.encryptForStorage(field.value),
            };
          } else if (field.type === 'reference') {
            processedCredentials[key] = {
              type: 'reference',
              secretId: field.secretId,
              secretKey: field.secretKey,
            };
          }
        }
        updates.secretCredentials = JSON.stringify(processedCredentials);
      } else {
        updates.secretCredentials = null;
      }
    }

    await db
      .update(schema.configServices)
      .set(updates)
      .where(eq(schema.configServices.id, serviceId));

    const updated = await db.query.configServices.findFirst({
      where: eq(schema.configServices.id, serviceId),
    });

    if (!updated) {
      throw new Error('Failed to retrieve updated config service');
    }

    return this.serialize(updated);
  }

  /**
   * Delete a config service
   */
  static async deleteConfigService(userId: string, serviceId: string): Promise<void> {
    const service = await db.query.configServices.findFirst({
      where: eq(schema.configServices.id, serviceId),
    });

    if (!service) {
      throw new Error('Config service not found');
    }

    const config = await db.query.configSets.findFirst({
      where: and(
        eq(schema.configSets.id, service.configSetId),
        eq(schema.configSets.userId, userId)
      ),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    await db.delete(schema.configServices).where(eq(schema.configServices.id, serviceId));
  }

  /**
   * Configure provision mode for a config service
   */
  static async configureProvision(
    userId: string,
    serviceId: string,
    service: KnownProvisionableService,
    options?: {
      image?: string;
      tag?: string;
      credentials?: {
        username?: string;
        password?: string;
        database?: string;
      };
    }
  ): Promise<SerializedConfigService> {
    const serviceConfig = PROVISIONABLE_SERVICES[service];
    if (!serviceConfig) {
      throw new Error(`Unknown provisionable service: ${service}`);
    }

    const credentials = {
      username: options?.credentials?.username || serviceConfig.defaultCredentials.username,
      password: options?.credentials?.password || generateSecurePassword(),
      database: options?.credentials?.database || serviceConfig.defaultCredentials.database,
      host: service,
      port: serviceConfig.defaultPort,
    };

    const connectionString = buildConnectionString(
      serviceConfig.connectionStringTemplate,
      credentials
    );

    const generatedEnvVars: Record<string, string> = {
      [`${serviceConfig.envVarPrefix}_HOST`]: service,
      [`${serviceConfig.envVarPrefix}_PORT`]: String(serviceConfig.defaultPort),
      [`${serviceConfig.envVarPrefix}_USER`]: credentials.username,
      [`${serviceConfig.envVarPrefix}_PASSWORD`]: credentials.password,
    };

    if (credentials.database) {
      generatedEnvVars[`${serviceConfig.envVarPrefix}_DATABASE`] = credentials.database;
      generatedEnvVars[`${serviceConfig.envVarPrefix}_DB`] = credentials.database;
    }

    generatedEnvVars.DATABASE_URL = connectionString;

    return this.updateConfigService(userId, serviceId, {
      sourceMode: 'provision',
      isProvisionable: true,
      knownService: service,
      provisionConfig: {
        service,
        image: options?.image || serviceConfig.defaultImage,
        tag: options?.tag || serviceConfig.defaultTag,
        credentials,
      },
    });
  }

  /**
   * Configure external mode for a config service
   * Each field can be manual (encrypted value) or reference (points to Secret Manager)
   */
  static async configureExternal(
    userId: string,
    serviceId: string,
    credentials: SecretCredentials
  ): Promise<SerializedConfigService> {
    return this.updateConfigService(userId, serviceId, {
      sourceMode: 'external',
      secretCredentials: credentials,
    });
  }

  /**
   * Get secret credentials for a config service (with types but encrypted values masked)
   */
  static async getSecretCredentials(
    userId: string,
    serviceId: string
  ): Promise<SecretCredentials | null> {
    const service = await db.query.configServices.findFirst({
      where: eq(schema.configServices.id, serviceId),
    });

    if (!service) {
      throw new Error('Config service not found');
    }

    const config = await db.query.configSets.findFirst({
      where: and(
        eq(schema.configSets.id, service.configSetId),
        eq(schema.configSets.userId, userId)
      ),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    if (!service.secretCredentials) {
      return null;
    }

    try {
      return JSON.parse(service.secretCredentials) as SecretCredentials;
    } catch (error) {
      console.error('Failed to parse secret credentials:', error);
      return null;
    }
  }

  /**
   * Get resolved environment variables for deployment
   *
   * Order of precedence (later values override earlier):
   * 1. Variables tab values from _summary.json (user-editable env vars)
   * 2. Config service env vars (provision/external mode)
   */
  static async getResolvedEnvVars(
    userId: string,
    configSetId: string
  ): Promise<Record<string, string>> {
    const envVars: Record<string, string> = {};

    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (config?.localPath) {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const summaryPath = path.join(config.localPath, '_summary.json');
        const summaryContent = await fs.readFile(summaryPath, 'utf-8');
        const metadata = JSON.parse(summaryContent);

        const envMetadata = metadata?.environmentVariables;
        if (envMetadata) {
          if (envMetadata.required && Array.isArray(envMetadata.required)) {
            for (const envVar of envMetadata.required) {
              if (envVar.key) {
                // Use value if set, otherwise fall back to example
                const resolvedValue = envVar.value || envVar.example;
                if (resolvedValue) {
                  envVars[envVar.key] = resolvedValue;
                }
              }
            }
          }
          if (envMetadata.optional && Array.isArray(envMetadata.optional)) {
            for (const envVar of envMetadata.optional) {
              if (envVar.key) {
                // Use value if set, otherwise fall back to example
                const resolvedValue = envVar.value || envVar.example;
                if (resolvedValue) {
                  envVars[envVar.key] = resolvedValue;
                }
              }
            }
          }
        }
      } catch {
        // _summary.json doesn't exist or couldn't be read
      }
    }

    const services = await this.getConfigServices(userId, configSetId);

    for (const service of services) {
      if (service.sourceMode === 'none') {
        continue;
      }

      if (service.sourceMode === 'provision' && service.provisionConfig?.credentials) {
        const knownService = service.knownService;
        if (knownService && PROVISIONABLE_SERVICES[knownService]) {
          const serviceConfig = PROVISIONABLE_SERVICES[knownService];
          const creds = service.provisionConfig.credentials;

          envVars[`${serviceConfig.envVarPrefix}_HOST`] = creds.host || knownService;
          envVars[`${serviceConfig.envVarPrefix}_PORT`] = String(
            creds.port || serviceConfig.defaultPort
          );
          envVars[`${serviceConfig.envVarPrefix}_USER`] = creds.username;
          envVars[`${serviceConfig.envVarPrefix}_PASSWORD`] = creds.password;

          if (creds.database) {
            envVars[`${serviceConfig.envVarPrefix}_DATABASE`] = creds.database;
            envVars[`${serviceConfig.envVarPrefix}_DB`] = creds.database;
          }

          const connectionString = buildConnectionString(serviceConfig.connectionStringTemplate, {
            ...creds,
            host: creds.host || knownService,
            port: creds.port || serviceConfig.defaultPort,
          });
          envVars.DATABASE_URL = connectionString;
        }

        if (service.provisionConfig.customEnv) {
          Object.assign(envVars, service.provisionConfig.customEnv);
        }
      }

      if (service.sourceMode === 'external') {
        const secretCreds = await this.getSecretCredentials(userId, service.id);

        if (secretCreds) {
          for (const [key, field] of Object.entries(secretCreds)) {
            if (field.type === 'manual' && field.value) {
              try {
                envVars[key] = encryptionService.decryptFromStorage(field.value);
              } catch (error) {
                console.error(`Failed to decrypt manual credential for ${key}:`, error);
              }
            } else if (field.type === 'reference' && field.secretId && field.secretKey) {
              try {
                const secretData = await secretService.getDecryptedCredentials(
                  field.secretId,
                  userId
                );
                if (secretData && secretData[field.secretKey]) {
                  envVars[key] = secretData[field.secretKey];
                }
              } catch (error) {
                console.error(`Failed to fetch secret reference for ${key}:`, error);
              }
            }
          }
        }
      }
    }

    return envVars;
  }

  /**
   * Serialize a database row to API response format
   */
  private static serialize(row: {
    id: string;
    configSetId: string;
    name: string;
    category: string;
    detectedFrom: string | null;
    isRequired: boolean;
    isProvisionable: boolean;
    knownService: string | null;
    requiredEnvVars: string | null;
    notes: string | null;
    isEdited: boolean;
    composeServiceName: string | null;
    sourceMode: string;
    provisionConfig: string | null;
    secretCredentials: string | null;
    generatedEnvVars: string | null;
    orderIndex: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): SerializedConfigService {
    return {
      id: row.id,
      configSetId: row.configSetId,
      name: row.name,
      category: row.category as ServiceCategory,
      detectedFrom: row.detectedFrom,
      isRequired: row.isRequired,
      isProvisionable: row.isProvisionable,
      knownService: row.knownService as KnownProvisionableService | null,
      requiredEnvVars: row.requiredEnvVars ? JSON.parse(row.requiredEnvVars) : [],
      notes: row.notes,
      isEdited: row.isEdited,
      composeServiceName: row.composeServiceName,
      sourceMode: row.sourceMode as ServiceSourceMode,
      provisionConfig: row.provisionConfig ? JSON.parse(row.provisionConfig) : null,
      hasSecretCredentials: !!row.secretCredentials,
      generatedEnvVars: row.generatedEnvVars ? JSON.parse(row.generatedEnvVars) : null,
      orderIndex: row.orderIndex ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
