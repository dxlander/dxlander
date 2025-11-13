import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, schema } from '@dxlander/database';
import { encryptionService } from '@dxlander/shared';
import { IntegrationService } from '../../../apps/api/src/services/integration.service';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

// FIXME: This test file uses outdated API methods that no longer exist
// The updated tests are in tests/integration/api/integration.service.test.ts
describe.skip('Integration CRUD Operations (Outdated)', () => {
  const testUserId = randomUUID();
  const integrationService = new IntegrationService();
  const createdIntegrationIds: string[] = [];

  afterEach(async () => {
    // Clean up created integrations
    for (const id of createdIntegrationIds) {
      await db.delete(schema.integrations).where(eq(schema.integrations.id, id));
    }
    createdIntegrationIds.length = 0;
  });

  describe('Create Integration', () => {
    it('should create a new integration with encrypted credentials', async () => {
      const testCredentials = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key-12345',
      };

      const integration = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Test Supabase',
        service: 'supabase',
        serviceType: 'database',
        credentialType: 'key_value',
        credentials: testCredentials,
      });

      createdIntegrationIds.push(integration.id);

      expect(integration).toBeDefined();
      expect(integration.id).toBeDefined();
      expect(integration.name).toBe('Test Supabase');
      expect(integration.service).toBe('supabase');
      expect(integration.serviceType).toBe('database');
      expect(integration.credentialType).toBe('key_value');
      expect(integration.status).toBe('unknown');
      expect(integration.userId).toBe(testUserId);
      expect(integration.autoInjected).toBe(true);
    });

    it('should encrypt credentials before storage', async () => {
      const testCredentials = {
        secretKey: 'sk_test_123456789',
      };

      const integration = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Test Stripe',
        service: 'stripe',
        serviceType: 'payment',
        credentialType: 'api_key',
        credentials: testCredentials,
      });

      createdIntegrationIds.push(integration.id);

      // Fetch from database and verify encryption
      const dbIntegration = await db.query.integrations.findFirst({
        where: eq(schema.integrations.id, integration.id),
      });

      expect(dbIntegration).toBeDefined();
      expect(dbIntegration!.encryptedCredentials).toBeDefined();
      expect(dbIntegration!.encryptedCredentials).not.toContain('sk_test_123456789');

      // Verify we can decrypt
      const decrypted = encryptionService.decryptObjectFromStorage(
        dbIntegration!.encryptedCredentials
      );
      expect(decrypted).toEqual(testCredentials);
    });

    it('should handle project association', async () => {
      const projectId = randomUUID();

      const integration = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Project-Associated Integration',
        service: 'mongodb-atlas',
        serviceType: 'database',
        credentialType: 'connection_string',
        credentials: { connectionString: 'mongodb+srv://test' },
        projectId,
      });

      createdIntegrationIds.push(integration.id);

      expect(integration.detectedIn).toBeDefined();
      expect(integration.detectedIn).toContain(projectId);
    });
  });

  describe('Read Integration', () => {
    it('should retrieve integration by ID', async () => {
      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Test Read',
        service: 'aws-s3',
        serviceType: 'storage',
        credentialType: 'key_value',
        credentials: { accessKeyId: 'AKIA123', secretAccessKey: 'secret123' },
      });

      createdIntegrationIds.push(created.id);

      const retrieved = await integrationService.getIntegrationById(created.id, testUserId);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('Test Read');
    });

    it('should return null for non-existent integration', async () => {
      const result = await integrationService.getIntegrationById('non-existent-id', testUserId);
      expect(result).toBeNull();
    });

    it('should return null for integration owned by different user', async () => {
      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Test Ownership',
        service: 'sendgrid',
        serviceType: 'email',
        credentialType: 'api_key',
        credentials: { apiKey: 'SG.test123' },
      });

      createdIntegrationIds.push(created.id);

      const differentUserId = randomUUID();
      const result = await integrationService.getIntegrationById(created.id, differentUserId);

      expect(result).toBeNull();
    });

    it('should get all integrations for a user', async () => {
      // Create multiple integrations
      const int1 = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Integration 1',
        service: 'supabase',
        serviceType: 'database',
        credentialType: 'key_value',
        credentials: { url: 'test1', anonKey: 'key1' },
      });

      const int2 = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Integration 2',
        service: 'stripe',
        serviceType: 'payment',
        credentialType: 'api_key',
        credentials: { secretKey: 'sk_test' },
      });

      createdIntegrationIds.push(int1.id, int2.id);

      const integrations = await integrationService.getIntegrationsByUserId(testUserId);

      expect(integrations).toBeDefined();
      expect(integrations.length).toBeGreaterThanOrEqual(2);
      expect(integrations.some((i) => i.id === int1.id)).toBe(true);
      expect(integrations.some((i) => i.id === int2.id)).toBe(true);
    });

    it('should decrypt credentials separately', async () => {
      const testCredentials = {
        domain: 'test.auth0.com',
        clientId: 'client123',
        clientSecret: 'secret123',
      };

      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Test Decrypt',
        service: 'auth0',
        serviceType: 'auth',
        credentialType: 'key_value',
        credentials: testCredentials,
      });

      createdIntegrationIds.push(created.id);

      const decrypted = await integrationService.getDecryptedCredentials(created.id, testUserId);

      expect(decrypted).toBeDefined();
      expect(decrypted).toEqual(testCredentials);
    });
  });

  describe('Update Integration', () => {
    it('should update integration name', async () => {
      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Original Name',
        service: 'cloudinary',
        serviceType: 'storage',
        credentialType: 'key_value',
        credentials: { cloudName: 'test', apiKey: 'key', apiSecret: 'secret' },
      });

      createdIntegrationIds.push(created.id);

      const updated = await integrationService.updateIntegration(created.id, testUserId, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.service).toBe('cloudinary'); // Unchanged
    });

    it('should update credentials', async () => {
      const originalCredentials = { apiKey: 'SG.original' };
      const newCredentials = { apiKey: 'SG.updated' };

      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Test Update Credentials',
        service: 'sendgrid',
        serviceType: 'email',
        credentialType: 'api_key',
        credentials: originalCredentials,
      });

      createdIntegrationIds.push(created.id);

      await integrationService.updateIntegration(created.id, testUserId, {
        credentials: newCredentials,
      });

      const decrypted = await integrationService.getDecryptedCredentials(created.id, testUserId);
      expect(decrypted).toEqual(newCredentials);
    });

    it('should throw error when updating non-existent integration', async () => {
      await expect(
        integrationService.updateIntegration('non-existent-id', testUserId, {
          name: 'New Name',
        })
      ).rejects.toThrow('Integration not found');
    });

    it('should throw error when updating integration owned by different user', async () => {
      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Test Ownership Update',
        service: 'twilio',
        serviceType: 'communication',
        credentialType: 'key_value',
        credentials: { accountSid: 'AC123', authToken: 'token' },
      });

      createdIntegrationIds.push(created.id);

      const differentUserId = randomUUID();

      await expect(
        integrationService.updateIntegration(created.id, differentUserId, {
          name: 'Unauthorized Update',
        })
      ).rejects.toThrow('Integration not found');
    });
  });

  describe('Delete Integration', () => {
    it('should delete integration', async () => {
      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'To Be Deleted',
        service: 'postgresql',
        serviceType: 'database',
        credentialType: 'connection_string',
        credentials: { connectionString: 'postgresql://test' },
      });

      const integrationId = created.id;

      await integrationService.deleteIntegration(integrationId, testUserId);

      const result = await integrationService.getIntegrationById(integrationId, testUserId);
      expect(result).toBeNull();
    });

    it('should throw error when deleting non-existent integration', async () => {
      await expect(
        integrationService.deleteIntegration('non-existent-id', testUserId)
      ).rejects.toThrow('Integration not found');
    });

    it('should throw error when deleting integration owned by different user', async () => {
      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Test Ownership Delete',
        service: 'clerk',
        serviceType: 'auth',
        credentialType: 'api_key',
        credentials: { publishableKey: 'pk_test', secretKey: 'sk_test' },
      });

      createdIntegrationIds.push(created.id);

      const differentUserId = randomUUID();

      await expect(
        integrationService.deleteIntegration(created.id, differentUserId)
      ).rejects.toThrow('Integration not found');
    });
  });

  describe('Filter Operations', () => {
    beforeEach(async () => {
      // Create test data for filtering before each test
      const testIntegrations = [
        {
          userId: testUserId,
          name: 'DB 1',
          service: 'supabase',
          serviceType: 'database',
          credentialType: 'key_value' as const,
          credentials: { url: 'test', anonKey: 'key' },
        },
        {
          userId: testUserId,
          name: 'DB 2',
          service: 'postgresql',
          serviceType: 'database',
          credentialType: 'connection_string' as const,
          credentials: { connectionString: 'test' },
        },
        {
          userId: testUserId,
          name: 'Storage 1',
          service: 'aws-s3',
          serviceType: 'storage',
          credentialType: 'key_value' as const,
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
        },
      ];

      for (const data of testIntegrations) {
        const created = await integrationService.createIntegration(data);
        createdIntegrationIds.push(created.id);
      }
    });

    it('should filter integrations by service type', async () => {
      const databases = await integrationService.getIntegrationsByServiceType(
        testUserId,
        'database'
      );

      expect(databases.length).toBeGreaterThanOrEqual(2);
      expect(databases.every((i) => i.serviceType === 'database')).toBe(true);
    });

    it('should filter integrations by service', async () => {
      const supabaseIntegrations = await integrationService.getIntegrationsByService(
        testUserId,
        'supabase'
      );

      expect(supabaseIntegrations.length).toBeGreaterThanOrEqual(1);
      expect(supabaseIntegrations.every((i) => i.service === 'supabase')).toBe(true);
    });
  });

  describe('Test Status Updates', () => {
    it('should update test status to connected', async () => {
      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Test Status',
        service: 'stripe',
        serviceType: 'payment',
        credentialType: 'api_key',
        credentials: { secretKey: 'sk_test' },
      });

      createdIntegrationIds.push(created.id);

      await integrationService.updateTestStatus(created.id, 'connected');

      const updated = await integrationService.getIntegrationById(created.id, testUserId);

      expect(updated!.status).toBe('connected');
      expect(updated!.lastTested).toBeDefined();
      expect(updated!.lastError).toBeNull();
    });

    it('should update test status to error with message', async () => {
      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Test Error Status',
        service: 'sendgrid',
        serviceType: 'email',
        credentialType: 'api_key',
        credentials: { apiKey: 'SG.invalid' },
      });

      createdIntegrationIds.push(created.id);

      const errorMessage = 'Invalid API key format';
      await integrationService.updateTestStatus(created.id, 'error', errorMessage);

      const updated = await integrationService.getIntegrationById(created.id, testUserId);

      expect(updated!.status).toBe('error');
      expect(updated!.lastError).toBe(errorMessage);
      expect(updated!.lastTested).toBeDefined();
    });
  });

  describe('Encryption Security', () => {
    it('should not store plaintext credentials in database', async () => {
      const sensitiveData = {
        secretKey: 'sk_live_super_secret_key_12345',
        publishableKey: 'pk_live_12345',
      };

      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Security Test',
        service: 'stripe',
        serviceType: 'payment',
        credentialType: 'key_value',
        credentials: sensitiveData,
      });

      createdIntegrationIds.push(created.id);

      // Fetch raw database record
      const dbRecord = await db.query.integrations.findFirst({
        where: eq(schema.integrations.id, created.id),
      });

      expect(dbRecord).toBeDefined();

      // Verify sensitive data is not in plaintext
      const dbString = JSON.stringify(dbRecord);
      expect(dbString).not.toContain('sk_live_super_secret_key_12345');
      expect(dbString).not.toContain('pk_live_12345');

      // Verify encrypted field exists and is formatted correctly
      expect(dbRecord!.encryptedCredentials).toBeDefined();
      expect(dbRecord!.encryptedCredentials).toContain(':'); // iv:authTag:encrypted format
    });

    it('should fail gracefully on decryption error', async () => {
      const created = await integrationService.createIntegration({
        userId: testUserId,
        name: 'Decryption Test',
        service: 'auth0',
        serviceType: 'auth',
        credentialType: 'key_value',
        credentials: { domain: 'test.auth0.com', clientId: 'test' },
      });

      createdIntegrationIds.push(created.id);

      // Corrupt the encrypted data
      await db
        .update(schema.integrations)
        .set({ encryptedCredentials: 'corrupted:data:here' })
        .where(eq(schema.integrations.id, created.id));

      const decrypted = await integrationService.getDecryptedCredentials(created.id, testUserId);

      expect(decrypted).toBeNull();
    });
  });
});
