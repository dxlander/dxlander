import { randomUUID } from 'crypto';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, deploymentCredentials } from '@dxlander/database';
import { encryptionService } from '@dxlander/shared';

export interface DeploymentPlatformConfig {
  platform:
    | 'vercel'
    | 'railway'
    | 'netlify'
    | 'aws'
    | 'gcp'
    | 'azure'
    | 'docker-registry'
    | 'kubernetes'
    | 'render'
    | 'fly-io'
    | 'digital-ocean'
    | 'heroku';
  name: string;
  apiKey?: string;
  config?: Record<string, any>;
  settings?: Record<string, any>;
}

export interface CreateDeploymentCredentialInput {
  userId: string;
  name: string;
  platform: string;
  apiKey?: string;
  config?: Record<string, any>;
  settings?: Record<string, any>;
  isDefault?: boolean;
}

export interface UpdateDeploymentCredentialInput {
  name?: string;
  apiKey?: string;
  config?: Record<string, any>;
  settings?: Record<string, any>;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface DeploymentCredential {
  id: string;
  userId: string;
  name: string;
  platform: string;
  settings?: Record<string, any>;
  isActive: boolean;
  isDefault: boolean;
  lastTested?: Date;
  lastTestStatus?: string;
  lastError?: string;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class DeploymentService {
  /**
   * Create a new deployment credential
   */
  async createDeploymentCredential(
    input: CreateDeploymentCredentialInput
  ): Promise<DeploymentCredential> {
    const credentialId = randomUUID();

    // Encrypt sensitive data
    const encryptedApiKey = input.apiKey ? encryptionService.encryptForStorage(input.apiKey) : null;

    const encryptedConfig = input.config
      ? encryptionService.encryptForStorage(JSON.stringify(input.config))
      : null;

    // If this should be the default, unset all other defaults for this user
    if (input.isDefault) {
      await db
        .update(deploymentCredentials)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(deploymentCredentials.userId, input.userId));
    }

    // Insert new credential
    const [credential] = await db
      .insert(deploymentCredentials)
      .values({
        id: credentialId,
        userId: input.userId,
        name: input.name,
        platform: input.platform,
        encryptedApiKey,
        encryptedConfig,
        settings: input.settings ? JSON.stringify(input.settings) : null,
        isActive: true,
        isDefault: input.isDefault || false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return this.formatCredential(credential);
  }

  /**
   * Get all deployment credentials for a user
   */
  async getDeploymentCredentials(userId: string): Promise<DeploymentCredential[]> {
    const credentials = await db.query.deploymentCredentials.findMany({
      where: eq(deploymentCredentials.userId, userId),
      orderBy: [desc(deploymentCredentials.isDefault), desc(deploymentCredentials.createdAt)],
    });

    return credentials.map((cred) => this.formatCredential(cred));
  }

  /**
   * Get a single deployment credential by ID
   */
  async getDeploymentCredential(
    credentialId: string,
    userId: string
  ): Promise<DeploymentCredential | null> {
    const credential = await db.query.deploymentCredentials.findFirst({
      where: and(
        eq(deploymentCredentials.id, credentialId),
        eq(deploymentCredentials.userId, userId)
      ),
    });

    if (!credential) {
      return null;
    }

    return this.formatCredential(credential);
  }

  /**
   * Get decrypted API key for a credential (used during deployment)
   */
  async getDecryptedApiKey(credentialId: string, userId: string): Promise<string | null> {
    const credential = await db.query.deploymentCredentials.findFirst({
      where: and(
        eq(deploymentCredentials.id, credentialId),
        eq(deploymentCredentials.userId, userId)
      ),
    });

    if (!credential || !credential.encryptedApiKey) {
      return null;
    }

    return encryptionService.decryptFromStorage(credential.encryptedApiKey);
  }

  /**
   * Get decrypted config for a credential (used during deployment)
   */
  async getDecryptedConfig(
    credentialId: string,
    userId: string
  ): Promise<Record<string, any> | null> {
    const credential = await db.query.deploymentCredentials.findFirst({
      where: and(
        eq(deploymentCredentials.id, credentialId),
        eq(deploymentCredentials.userId, userId)
      ),
    });

    if (!credential || !credential.encryptedConfig) {
      return null;
    }

    const decrypted = encryptionService.decryptFromStorage(credential.encryptedConfig);
    return JSON.parse(decrypted);
  }

  /**
   * Update a deployment credential
   */
  async updateDeploymentCredential(
    credentialId: string,
    userId: string,
    input: UpdateDeploymentCredentialInput
  ): Promise<DeploymentCredential | null> {
    // Verify ownership
    const existing = await this.getDeploymentCredential(credentialId, userId);
    if (!existing) {
      return null;
    }

    // If setting as default, unset all other defaults
    if (input.isDefault) {
      await db
        .update(deploymentCredentials)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(eq(deploymentCredentials.userId, userId), eq(deploymentCredentials.isActive, true))
        );
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

    if (input.apiKey !== undefined) {
      updateData.encryptedApiKey = input.apiKey
        ? encryptionService.encryptForStorage(input.apiKey)
        : null;
    }

    if (input.config !== undefined) {
      updateData.encryptedConfig = input.config
        ? encryptionService.encryptForStorage(JSON.stringify(input.config))
        : null;
    }

    if (input.settings !== undefined) {
      updateData.settings = input.settings ? JSON.stringify(input.settings) : null;
    }

    // Update credential
    const [updated] = await db
      .update(deploymentCredentials)
      .set(updateData)
      .where(
        and(eq(deploymentCredentials.id, credentialId), eq(deploymentCredentials.userId, userId))
      )
      .returning();

    return this.formatCredential(updated);
  }

  /**
   * Delete a deployment credential
   */
  async deleteDeploymentCredential(credentialId: string, userId: string): Promise<boolean> {
    await db
      .delete(deploymentCredentials)
      .where(
        and(eq(deploymentCredentials.id, credentialId), eq(deploymentCredentials.userId, userId))
      );

    return true;
  }

  /**
   * Set a credential as default
   */
  async setDefaultCredential(
    credentialId: string,
    userId: string
  ): Promise<DeploymentCredential | null> {
    // Unset all current defaults
    await db
      .update(deploymentCredentials)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(deploymentCredentials.userId, userId));

    // Set new default
    const [updated] = await db
      .update(deploymentCredentials)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(eq(deploymentCredentials.id, credentialId), eq(deploymentCredentials.userId, userId))
      )
      .returning();

    if (!updated) {
      return null;
    }

    return this.formatCredential(updated);
  }

  /**
   * Test deployment credential connection
   */
  async testConnection(
    credentialId: string,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const credential = await db.query.deploymentCredentials.findFirst({
      where: and(
        eq(deploymentCredentials.id, credentialId),
        eq(deploymentCredentials.userId, userId)
      ),
    });

    if (!credential) {
      return {
        success: false,
        message: 'Credential not found',
      };
    }

    try {
      // Platform-specific connection testing
      const apiKey = credential.encryptedApiKey
        ? encryptionService.decryptFromStorage(credential.encryptedApiKey)
        : null;

      let testResult: { success: boolean; message: string; details?: any };

      switch (credential.platform) {
        case 'vercel':
          testResult = await this.testVercelConnection(apiKey);
          break;
        case 'railway':
          testResult = await this.testRailwayConnection(apiKey);
          break;
        case 'netlify':
          testResult = await this.testNetlifyConnection(apiKey);
          break;
        case 'aws':
          testResult = await this.testAWSConnection();
          break;
        case 'gcp':
          testResult = await this.testGCPConnection();
          break;
        default:
          testResult = {
            success: true,
            message: 'Connection test not implemented for this platform',
          };
      }

      // Update test status
      await db
        .update(deploymentCredentials)
        .set({
          lastTested: new Date(),
          lastTestStatus: testResult.success ? 'success' : 'failed',
          lastError: testResult.success ? null : testResult.message,
          updatedAt: new Date(),
        })
        .where(eq(deploymentCredentials.id, credentialId));

      return testResult;
    } catch (error: any) {
      // Update error status
      await db
        .update(deploymentCredentials)
        .set({
          lastTested: new Date(),
          lastTestStatus: 'failed',
          lastError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(deploymentCredentials.id, credentialId));

      return {
        success: false,
        message: error.message || 'Connection test failed',
      };
    }
  }

  /**
   * Increment usage count (called when credential is used for deployment)
   */
  async incrementUsage(credentialId: string): Promise<void> {
    await db
      .update(deploymentCredentials)
      .set({
        usageCount: sql`${deploymentCredentials.usageCount} + 1`,
        lastUsed: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deploymentCredentials.id, credentialId));
  }

  // Platform-specific connection tests

  private async testVercelConnection(apiKey: string | null): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    if (!apiKey) {
      return { success: false, message: 'API key required for Vercel' };
    }

    try {
      // Test Vercel API
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        return {
          success: true,
          message: 'Successfully connected to Vercel',
          details: {
            username: user.user?.username,
            email: user.user?.email,
          },
        };
      } else {
        return {
          success: false,
          message: `Vercel API error: ${response.statusText}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to connect to Vercel',
      };
    }
  }

  private async testRailwayConnection(apiKey: string | null): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!apiKey) {
      return { success: false, message: 'API key required for Railway' };
    }

    try {
      // Test Railway GraphQL API
      const response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: '{ me { id email } }',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.errors) {
          return {
            success: false,
            message: data.errors[0]?.message || 'Railway API error',
          };
        }
        return {
          success: true,
          message: 'Successfully connected to Railway',
        };
      } else {
        return {
          success: false,
          message: `Railway API error: ${response.statusText}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to connect to Railway',
      };
    }
  }

  private async testNetlifyConnection(apiKey: string | null): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!apiKey) {
      return { success: false, message: 'API key required for Netlify' };
    }

    try {
      const response = await fetch('https://api.netlify.com/api/v1/user', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Successfully connected to Netlify',
        };
      } else {
        return {
          success: false,
          message: `Netlify API error: ${response.statusText}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to connect to Netlify',
      };
    }
  }

  private async testAWSConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    // AWS requires SDK integration - placeholder for now
    return {
      success: true,
      message: 'AWS connection validation not yet implemented',
    };
  }

  private async testGCPConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    // GCP requires SDK integration - placeholder for now
    return {
      success: true,
      message: 'GCP connection validation not yet implemented',
    };
  }

  /**
   * Format credential for API response (remove encrypted fields)
   */
  private formatCredential(credential: any): DeploymentCredential {
    return {
      id: credential.id,
      userId: credential.userId,
      name: credential.name,
      platform: credential.platform,
      settings: credential.settings ? JSON.parse(credential.settings) : undefined,
      isActive: credential.isActive,
      isDefault: credential.isDefault,
      lastTested: credential.lastTested,
      lastTestStatus: credential.lastTestStatus,
      lastError: credential.lastError,
      usageCount: credential.usageCount,
      lastUsed: credential.lastUsed,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }
}

// Export singleton instance
export const deploymentService = new DeploymentService();
