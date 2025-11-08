/**
 * Integration Service
 * Handles CRUD operations for third-party service integrations
 */

import { randomUUID } from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '@dxlander/database';
import { encryptionService } from '@dxlander/shared';

export interface CreateIntegrationInput {
  userId: string;
  name: string;
  service: string;
  serviceType: string;
  credentialType: string;
  credentials: Record<string, any>;
  autoInjected?: boolean;
  projectId?: string;
}

export interface UpdateIntegrationInput {
  name?: string;
  credentials?: Record<string, any>;
  autoInjected?: boolean;
}

export interface Integration {
  id: string;
  userId: string;
  name: string;
  service: string;
  serviceType: string;
  credentialType: string;
  status: string;
  autoInjected: boolean;
  detectedIn?: string[] | null;
  lastTested?: Date | null;
  lastError?: string | null;
  usageCount: number;
  lastUsed?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class IntegrationService {
  /**
   * Create a new integration
   */
  async createIntegration(input: CreateIntegrationInput): Promise<Integration> {
    const integrationId = randomUUID();

    // Encrypt credentials
    const encryptedCredentials = encryptionService.encryptObjectForStorage(input.credentials);

    // Prepare detectedIn array
    const detectedIn = input.projectId ? JSON.stringify([input.projectId]) : null;

    // Insert new integration
    const [integration] = await db
      .insert(schema.integrations)
      .values({
        id: integrationId,
        userId: input.userId,
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

    return this.formatIntegration(integration);
  }

  /**
   * Get all integrations for a user
   */
  async getIntegrationsByUserId(userId: string): Promise<Integration[]> {
    const integrations = await db.query.integrations.findMany({
      where: eq(schema.integrations.userId, userId),
      orderBy: [desc(schema.integrations.createdAt)],
    });

    return integrations.map((integration) => this.formatIntegration(integration));
  }

  /**
   * Get a specific integration by ID
   */
  async getIntegrationById(id: string, userId: string): Promise<Integration | null> {
    const integration = await db.query.integrations.findFirst({
      where: and(eq(schema.integrations.id, id), eq(schema.integrations.userId, userId)),
    });

    if (!integration) {
      return null;
    }

    return this.formatIntegration(integration);
  }

  /**
   * Get decrypted credentials for an integration
   */
  async getDecryptedCredentials(id: string, userId: string): Promise<Record<string, any> | null> {
    const integration = await db.query.integrations.findFirst({
      where: and(eq(schema.integrations.id, id), eq(schema.integrations.userId, userId)),
    });

    if (!integration) {
      return null;
    }

    try {
      return encryptionService.decryptObjectFromStorage(integration.encryptedCredentials);
    } catch (error) {
      console.error('Failed to decrypt credentials:', error);
      return null;
    }
  }

  /**
   * Update an integration
   */
  async updateIntegration(
    id: string,
    userId: string,
    input: UpdateIntegrationInput
  ): Promise<Integration> {
    // Verify ownership
    const existing = await this.getIntegrationById(id, userId);
    if (!existing) {
      throw new Error('Integration not found');
    }

    // Build update data
    const updateData: Partial<typeof schema.integrations.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.credentials !== undefined) {
      updateData.encryptedCredentials = encryptionService.encryptObjectForStorage(input.credentials);
    }

    if (input.autoInjected !== undefined) {
      updateData.autoInjected = input.autoInjected;
    }

    // Update in database
    const [updated] = await db
      .update(schema.integrations)
      .set(updateData)
      .where(eq(schema.integrations.id, id))
      .returning();

    return this.formatIntegration(updated);
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await this.getIntegrationById(id, userId);
    if (!existing) {
      throw new Error('Integration not found');
    }

    await db.delete(schema.integrations).where(eq(schema.integrations.id, id));
  }

  /**
   * Update integration test status
   */
  async updateTestStatus(
    id: string,
    status: 'connected' | 'error' | 'unknown',
    error?: string
  ): Promise<void> {
    await db
      .update(schema.integrations)
      .set({
        status,
        lastTested: new Date(),
        lastError: error || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.integrations.id, id));
  }

  /**
   * Increment usage count
   */
  async incrementUsageCount(id: string): Promise<void> {
    // Get current integration
    const integration = await db.query.integrations.findFirst({
      where: eq(schema.integrations.id, id),
    });

    if (!integration) {
      return;
    }

    // Increment usage count
    await db
      .update(schema.integrations)
      .set({
        usageCount: (integration.usageCount || 0) + 1,
        lastUsed: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.integrations.id, id));
  }

  /**
   * Get integrations by service type
   */
  async getIntegrationsByServiceType(userId: string, serviceType: string): Promise<Integration[]> {
    const integrations = await db.query.integrations.findMany({
      where: and(
        eq(schema.integrations.userId, userId),
        eq(schema.integrations.serviceType, serviceType)
      ),
      orderBy: [desc(schema.integrations.createdAt)],
    });

    return integrations.map((integration) => this.formatIntegration(integration));
  }

  /**
   * Get integrations by service
   */
  async getIntegrationsByService(userId: string, service: string): Promise<Integration[]> {
    const integrations = await db.query.integrations.findMany({
      where: and(eq(schema.integrations.userId, userId), eq(schema.integrations.service, service)),
      orderBy: [desc(schema.integrations.createdAt)],
    });

    return integrations.map((integration) => this.formatIntegration(integration));
  }

  /**
   * Format integration for response (parse JSON fields)
   */
  private formatIntegration(integration: any): Integration {
    return {
      id: integration.id,
      userId: integration.userId,
      name: integration.name,
      service: integration.service,
      serviceType: integration.serviceType,
      credentialType: integration.credentialType,
      status: integration.status,
      autoInjected: integration.autoInjected,
      detectedIn: integration.detectedIn ? JSON.parse(integration.detectedIn) : null,
      lastTested: integration.lastTested,
      lastError: integration.lastError,
      usageCount: integration.usageCount,
      lastUsed: integration.lastUsed,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }
}
