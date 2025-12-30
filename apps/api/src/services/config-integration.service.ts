import { db, schema } from '@dxlander/database';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  encryptionService,
  type ConfigIntegration,
  type SerializedConfigIntegration,
  type LinkConfigIntegrationInput,
} from '@dxlander/shared';

/**
 * Config-Integration Service
 *
 * Manages the linking of saved integrations to config sets.
 * Allows configs to use credentials from the integration vault
 * with optional value overrides per config.
 */
export class ConfigIntegrationService {
  /**
   * Link an integration to a config set
   */
  static async linkIntegration(
    userId: string,
    input: LinkConfigIntegrationInput
  ): Promise<ConfigIntegration> {
    const { configSetId, integrationId, overrides, orderIndex } = input;

    // Verify config belongs to user
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    // Verify integration belongs to user
    const integration = await db.query.integrations.findFirst({
      where: and(eq(schema.integrations.id, integrationId), eq(schema.integrations.userId, userId)),
    });

    if (!integration) {
      throw new Error('Integration not found or access denied');
    }

    // Check if already linked
    const existing = await db.query.configIntegrations.findFirst({
      where: and(
        eq(schema.configIntegrations.configSetId, configSetId),
        eq(schema.configIntegrations.integrationId, integrationId)
      ),
    });

    if (existing) {
      throw new Error('Integration is already linked to this config');
    }

    // Create the link
    const id = randomUUID();
    const now = new Date();

    await db.insert(schema.configIntegrations).values({
      id,
      configSetId,
      integrationId,
      overrides: overrides ? JSON.stringify(overrides) : null,
      orderIndex: orderIndex ?? 0,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      configSetId,
      integrationId,
      overrides: overrides ?? null,
      orderIndex: orderIndex ?? 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Unlink an integration from a config set
   */
  static async unlinkIntegration(
    userId: string,
    configSetId: string,
    integrationId: string
  ): Promise<void> {
    // Verify config belongs to user
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    // Find and delete the link
    const link = await db.query.configIntegrations.findFirst({
      where: and(
        eq(schema.configIntegrations.configSetId, configSetId),
        eq(schema.configIntegrations.integrationId, integrationId)
      ),
    });

    if (!link) {
      throw new Error('Integration link not found');
    }

    await db.delete(schema.configIntegrations).where(eq(schema.configIntegrations.id, link.id));
  }

  /**
   * Get all linked integrations for a config set
   */
  static async getLinkedIntegrations(
    userId: string,
    configSetId: string
  ): Promise<
    Array<{
      link: SerializedConfigIntegration;
      integration: {
        id: string;
        name: string;
        service: string;
        serviceType: string;
        status: string;
      };
    }>
  > {
    // Verify config belongs to user
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    // Get all links for this config
    const links = await db.query.configIntegrations.findMany({
      where: eq(schema.configIntegrations.configSetId, configSetId),
      orderBy: (ci, { asc }) => [asc(ci.orderIndex)],
    });

    // Get integration details for each link
    const result = await Promise.all(
      links.map(async (link) => {
        const integration = await db.query.integrations.findFirst({
          where: eq(schema.integrations.id, link.integrationId),
        });

        if (!integration) {
          return null;
        }

        return {
          link: {
            id: link.id,
            configSetId: link.configSetId,
            integrationId: link.integrationId,
            overrides: link.overrides ? JSON.parse(link.overrides) : null,
            orderIndex: link.orderIndex ?? 0,
            createdAt: link.createdAt.toISOString(),
            updatedAt: link.updatedAt.toISOString(),
          },
          integration: {
            id: integration.id,
            name: integration.name,
            service: integration.service,
            serviceType: integration.serviceType,
            status: integration.status,
          },
        };
      })
    );

    return result.filter(Boolean) as Array<{
      link: SerializedConfigIntegration;
      integration: {
        id: string;
        name: string;
        service: string;
        serviceType: string;
        status: string;
      };
    }>;
  }

  /**
   * Update overrides for a linked integration
   */
  static async updateOverrides(
    userId: string,
    configSetId: string,
    integrationId: string,
    overrides: Record<string, string>
  ): Promise<void> {
    // Verify config belongs to user
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    // Find the link
    const link = await db.query.configIntegrations.findFirst({
      where: and(
        eq(schema.configIntegrations.configSetId, configSetId),
        eq(schema.configIntegrations.integrationId, integrationId)
      ),
    });

    if (!link) {
      throw new Error('Integration link not found');
    }

    // Update the overrides
    await db
      .update(schema.configIntegrations)
      .set({
        overrides: JSON.stringify(overrides),
        updatedAt: new Date(),
      })
      .where(eq(schema.configIntegrations.id, link.id));
  }

  /**
   * Get resolved environment variables for a config set
   *
   * Priority order (later overrides earlier):
   * 1. Default values from .env.example file
   * 2. Values from _summary.json metadata (if user edited them)
   * 3. Linked integration credentials (decrypted)
   * 4. Link-specific overrides
   *
   * Returns a map of variable name -> value for use in deployment.
   */
  static async getResolvedEnvVars(
    userId: string,
    configSetId: string
  ): Promise<Record<string, string>> {
    const envVars: Record<string, string> = {};

    // Get the config set to access local path
    const configSet = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (configSet?.localPath) {
      const fs = await import('fs/promises');
      const path = await import('path');

      // 1. Parse .env.example for default values
      try {
        const envExamplePath = path.join(configSet.localPath, '.env.example');
        const envContent = await fs.readFile(envExamplePath, 'utf-8');
        const parsedEnv = this.parseEnvFile(envContent);
        for (const [key, value] of Object.entries(parsedEnv)) {
          envVars[key] = value;
        }
      } catch {
        // .env.example doesn't exist, continue
      }

      // 2. Read _summary.json for any user-set values in metadata
      try {
        const summaryPath = path.join(configSet.localPath, '_summary.json');
        const summaryContent = await fs.readFile(summaryPath, 'utf-8');
        const summary = JSON.parse(summaryContent);

        // Check for environment variables in metadata
        const envMetadata = summary?.environmentVariables;
        if (envMetadata) {
          // Apply values from required variables
          if (envMetadata.required) {
            for (const envVar of envMetadata.required) {
              if (envVar.value) {
                envVars[envVar.key] = envVar.value;
              } else if (envVar.example && !envVars[envVar.key]) {
                // Use example as fallback if no value set
                envVars[envVar.key] = envVar.example;
              }
            }
          }
          // Apply values from optional variables
          if (envMetadata.optional) {
            for (const envVar of envMetadata.optional) {
              if (envVar.value) {
                envVars[envVar.key] = envVar.value;
              } else if (envVar.example && !envVars[envVar.key]) {
                envVars[envVar.key] = envVar.example;
              }
            }
          }
        }
      } catch {
        // _summary.json doesn't exist or is invalid, continue
      }
    }

    // 3. Apply linked integration credentials (override defaults)
    const linkedIntegrations = await this.getLinkedIntegrations(userId, configSetId);

    for (const { link, integration } of linkedIntegrations) {
      const fullIntegration = await db.query.integrations.findFirst({
        where: and(
          eq(schema.integrations.id, integration.id),
          eq(schema.integrations.userId, userId)
        ),
      });

      if (!fullIntegration || !fullIntegration.encryptedCredentials) {
        continue;
      }

      try {
        // Decrypt credentials
        const credentials = encryptionService.decryptObjectFromStorage(
          fullIntegration.encryptedCredentials
        ) as Record<string, string>;

        // Apply credentials to env vars
        for (const [key, value] of Object.entries(credentials)) {
          envVars[key] = value;
        }

        // 4. Apply overrides (link-specific overrides take highest precedence)
        if (link.overrides) {
          for (const [key, value] of Object.entries(link.overrides)) {
            envVars[key] = value;
          }
        }
      } catch (error) {
        console.error(`Failed to decrypt credentials for integration ${integration.name}:`, error);
      }
    }

    return envVars;
  }

  /**
   * Parse an .env file content into key-value pairs
   * Handles comments, empty lines, and quoted values
   */
  private static parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Find the first = sign
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }

      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();

      // Remove surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Skip placeholder values that indicate user should fill in
      if (
        value.includes('your_') ||
        value.includes('YOUR_') ||
        value === '' ||
        value === '""' ||
        value === "''"
      ) {
        continue;
      }

      if (key) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get all available integrations for linking (not already linked to this config)
   */
  static async getAvailableIntegrations(
    userId: string,
    configSetId: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      service: string;
      serviceType: string;
      status: string;
    }>
  > {
    // Get all user integrations
    const allIntegrations = await db.query.integrations.findMany({
      where: eq(schema.integrations.userId, userId),
    });

    // Get already linked integration IDs
    const linkedIntegrations = await db.query.configIntegrations.findMany({
      where: eq(schema.configIntegrations.configSetId, configSetId),
    });

    const linkedIds = new Set(linkedIntegrations.map((l) => l.integrationId));

    // Return integrations not already linked
    return allIntegrations
      .filter((i) => !linkedIds.has(i.id))
      .map((i) => ({
        id: i.id,
        name: i.name,
        service: i.service,
        serviceType: i.serviceType,
        status: i.status,
      }));
  }

  /**
   * Reorder linked integrations
   */
  static async reorderIntegrations(
    userId: string,
    configSetId: string,
    orderedIntegrationIds: string[]
  ): Promise<void> {
    // Verify config belongs to user
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    // Update order for each integration
    for (let i = 0; i < orderedIntegrationIds.length; i++) {
      const integrationId = orderedIntegrationIds[i];

      await db
        .update(schema.configIntegrations)
        .set({
          orderIndex: i,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.configIntegrations.configSetId, configSetId),
            eq(schema.configIntegrations.integrationId, integrationId)
          )
        );
    }
  }
}
