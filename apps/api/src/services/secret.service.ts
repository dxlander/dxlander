/**
 * Secret Service
 * Handles CRUD operations for user-managed secrets (Secret Manager)
 */

import { randomUUID } from 'crypto';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, schema } from '@dxlander/database';
import {
  encryptionService,
  type Secret,
  type CreateSecretServiceInput,
  type UpdateSecretServiceInput,
} from '@dxlander/shared';

export class SecretService {
  /**
   * Create a new secret
   */
  async createSecret(input: CreateSecretServiceInput): Promise<Secret> {
    const secretId = randomUUID();

    // Encrypt credentials
    const encryptedCredentials = encryptionService.encryptObjectForStorage(input.credentials);

    // Prepare detectedIn array
    const detectedIn = input.projectId ? JSON.stringify([input.projectId]) : null;

    // Insert new secret
    const [secret] = await db
      .insert(schema.secrets)
      .values({
        id: secretId,
        userId: input.userId,
        projectId: input.projectId || null,
        name: input.name,
        service: input.service,
        serviceType: input.serviceType,
        credentialType: input.credentialType,
        encryptedCredentials,
        detectedIn,
        autoInjected: input.autoInjected ?? true,
        status: 'unknown',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return this.formatSecret(secret);
  }

  /**
   * Get all secrets for a user
   */
  async getSecretsByUserId(userId: string): Promise<Secret[]> {
    const secrets = await db.query.secrets.findMany({
      where: eq(schema.secrets.userId, userId),
      orderBy: [desc(schema.secrets.createdAt)],
    });

    return secrets.map((secret) => this.formatSecret(secret));
  }

  /**
   * Get a specific secret by ID
   */
  async getSecretById(id: string, userId: string): Promise<Secret | null> {
    const secret = await db.query.secrets.findFirst({
      where: and(eq(schema.secrets.id, id), eq(schema.secrets.userId, userId)),
    });

    if (!secret) {
      return null;
    }

    return this.formatSecret(secret);
  }

  /**
   * Get decrypted credentials for a secret
   */
  async getDecryptedCredentials(
    id: string,
    userId: string
  ): Promise<Record<string, string> | null> {
    const secret = await db.query.secrets.findFirst({
      where: and(eq(schema.secrets.id, id), eq(schema.secrets.userId, userId)),
    });

    if (!secret) {
      return null;
    }

    try {
      return encryptionService.decryptObjectFromStorage(secret.encryptedCredentials);
    } catch {
      return null;
    }
  }

  /**
   * Get just the keys (field names) from a secret without values
   * Used for UI to show available fields without exposing values
   */
  async getSecretKeys(id: string, userId: string): Promise<string[] | null> {
    const credentials = await this.getDecryptedCredentials(id, userId);
    if (!credentials) {
      return null;
    }
    return Object.keys(credentials);
  }

  /**
   * Update a secret
   */
  async updateSecret(id: string, userId: string, input: UpdateSecretServiceInput): Promise<Secret> {
    // Verify ownership
    const existing = await this.getSecretById(id, userId);
    if (!existing) {
      throw new Error('Secret not found');
    }

    // Build update data
    const updateData: Partial<typeof schema.secrets.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.credentials !== undefined) {
      updateData.encryptedCredentials = encryptionService.encryptObjectForStorage(
        input.credentials
      );
    }

    if (input.autoInjected !== undefined) {
      updateData.autoInjected = input.autoInjected;
    }

    // Update in database
    const [updated] = await db
      .update(schema.secrets)
      .set(updateData)
      .where(eq(schema.secrets.id, id))
      .returning();

    return this.formatSecret(updated);
  }

  /**
   * Delete a secret
   */
  async deleteSecret(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await this.getSecretById(id, userId);
    if (!existing) {
      throw new Error('Secret not found');
    }

    await db.delete(schema.secrets).where(eq(schema.secrets.id, id));
  }

  /**
   * Update secret test status
   */
  async updateTestStatus(
    id: string,
    userId: string,
    status: 'connected' | 'error' | 'unknown',
    error?: string
  ): Promise<boolean> {
    const existing = await db.query.secrets.findFirst({
      where: and(eq(schema.secrets.id, id), eq(schema.secrets.userId, userId)),
    });
    if (!existing) return false;

    await db
      .update(schema.secrets)
      .set({
        status,
        lastTested: new Date(),
        lastError: error || null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.secrets.id, id), eq(schema.secrets.userId, userId)));
    return true;
  }

  /**
   * Increment usage count atomically
   */
  async incrementUsageCount(id: string, userId: string): Promise<boolean> {
    const existing = await db.query.secrets.findFirst({
      where: and(eq(schema.secrets.id, id), eq(schema.secrets.userId, userId)),
    });
    if (!existing) return false;

    await db
      .update(schema.secrets)
      .set({
        usageCount: sql`COALESCE(${schema.secrets.usageCount}, 0) + 1`,
        lastUsed: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.secrets.id, id), eq(schema.secrets.userId, userId)));
    return true;
  }

  /**
   * Get secrets by service type
   */
  async getSecretsByServiceType(userId: string, serviceType: string): Promise<Secret[]> {
    const secrets = await db.query.secrets.findMany({
      where: and(eq(schema.secrets.userId, userId), eq(schema.secrets.serviceType, serviceType)),
      orderBy: [desc(schema.secrets.createdAt)],
    });

    return secrets.map((secret) => this.formatSecret(secret));
  }

  /**
   * Get secrets by service
   */
  async getSecretsByService(userId: string, service: string): Promise<Secret[]> {
    const secrets = await db.query.secrets.findMany({
      where: and(eq(schema.secrets.userId, userId), eq(schema.secrets.service, service)),
      orderBy: [desc(schema.secrets.createdAt)],
    });

    return secrets.map((secret) => this.formatSecret(secret));
  }

  /**
   * Format secret for response (parse JSON fields)
   */
  private formatSecret(secret: typeof schema.secrets.$inferSelect): Secret {
    return {
      id: secret.id,
      userId: secret.userId,
      name: secret.name,
      service: secret.service,
      serviceType: secret.serviceType,
      credentialType: secret.credentialType,
      status: secret.status,
      autoInjected: secret.autoInjected ?? true,
      detectedIn: this.safeParseJson(secret.detectedIn),
      lastTested: secret.lastTested,
      lastError: secret.lastError,
      usageCount: secret.usageCount ?? 0,
      lastUsed: secret.lastUsed,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      projectId: secret.projectId,
    };
  }

  private safeParseJson(json: string | null): string[] | null {
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}
