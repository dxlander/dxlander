import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegrationService } from '../../../apps/api/src/services/integration.service';
import { db, schema } from '@dxlander/database';
import { eq } from 'drizzle-orm';

const TEST_USER_ID = 'test-user-id';

// FIXME: Skipped due to pg module ESM compatibility issue with Vitest
// See: https://github.com/brianc/node-postgres/issues/2009
describe.skip('IntegrationService', () => {
  let service: IntegrationService;
  let createdIntegrationIds: string[] = [];

  beforeEach(() => {
    service = new IntegrationService();
    createdIntegrationIds = [];
  });

  afterEach(async () => {
    // Clean up all created integrations
    for (const id of createdIntegrationIds) {
      try {
        await db.delete(schema.integrations).where(eq(schema.integrations.id, id));
      } catch (_error) {
        // Integration might already be deleted
      }
    }
  });

  describe('create', () => {
    it('should create an integration with encrypted credentials', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Test Supabase',
        service: 'BACKEND',
        fields: [
          { key: 'API_URL', value: 'https://example.supabase.co' },
          { key: 'API_KEY', value: 'super-secret-key' },
        ],
      });

      createdIntegrationIds.push(integration.id);

      expect(integration).toBeDefined();
      expect(integration.name).toBe('Test Supabase');
      expect(integration.service).toBe('BACKEND');
      expect(integration.userId).toBe(TEST_USER_ID);
      expect(integration.encryptedCredentials).toBeDefined();
      expect(integration.encryptedCredentials).not.toContain('super-secret-key'); // Should be encrypted
      expect(integration.serviceType).toBe('custom');
      expect(integration.credentialType).toBe('key_value');
    });

    it('should create integration with autoInjected flag', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Test Stripe',
        service: 'PAYMENT',
        fields: [{ key: 'SECRET_KEY', value: 'sk_test_123' }],
        autoInjected: false,
      });

      createdIntegrationIds.push(integration.id);

      expect(integration.autoInjected).toBe(false);
    });

    it('should create integration with projectId', async () => {
      const projectId = 'test-project-id';
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Project Database',
        service: 'DATABASE',
        fields: [
          { key: 'DB_URL', value: 'postgresql://localhost:5432/testdb' },
          { key: 'DB_PASSWORD', value: 'password123' },
        ],
        projectId,
      });

      createdIntegrationIds.push(integration.id);

      expect(integration.projectId).toBe(projectId);
    });

    it('should handle multiple fields correctly', async () => {
      const fields = [
        { key: 'FIELD_1', value: 'value1' },
        { key: 'FIELD_2', value: 'value2' },
        { key: 'FIELD_3', value: 'value3' },
        { key: 'FIELD_4', value: 'value4' },
        { key: 'FIELD_5', value: 'value5' },
      ];

      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Multi-Field Integration',
        service: 'API',
        fields,
      });

      createdIntegrationIds.push(integration.id);

      // Decrypt and verify all fields are stored
      const decryptedFields = await service.getDecryptedFields(integration.id, TEST_USER_ID);
      expect(decryptedFields).toHaveLength(fields.length);

      fields.forEach((field) => {
        const found = decryptedFields.find((f) => f.key === field.key);
        expect(found).toBeDefined();
        expect(found?.value).toBe(field.value);
      });
    });
  });

  describe('getById', () => {
    it('should retrieve an integration by id', async () => {
      const created = await service.create({
        userId: TEST_USER_ID,
        name: 'Test Integration',
        service: 'EMAIL',
        fields: [{ key: 'API_KEY', value: 'test-key' }],
      });
      createdIntegrationIds.push(created.id);

      const retrieved = await service.getById(created.id, TEST_USER_ID);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Integration');
      expect(retrieved?.service).toBe('EMAIL');
    });

    it('should return null for non-existent integration', async () => {
      const retrieved = await service.getById('non-existent-id', TEST_USER_ID);
      expect(retrieved).toBeNull();
    });

    it('should return null for integration belonging to different user', async () => {
      const created = await service.create({
        userId: TEST_USER_ID,
        name: 'User 1 Integration',
        service: 'DATABASE',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(created.id);

      const retrieved = await service.getById(created.id, 'different-user-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all integrations for a user', async () => {
      const integration1 = await service.create({
        userId: TEST_USER_ID,
        name: 'Integration 1',
        service: 'DATABASE',
        fields: [{ key: 'KEY1', value: 'value1' }],
      });
      createdIntegrationIds.push(integration1.id);

      const integration2 = await service.create({
        userId: TEST_USER_ID,
        name: 'Integration 2',
        service: 'EMAIL',
        fields: [{ key: 'KEY2', value: 'value2' }],
      });
      createdIntegrationIds.push(integration2.id);

      const list = await service.list(TEST_USER_ID);

      expect(list.length).toBeGreaterThanOrEqual(2);
      const ids = list.map((i) => i.id);
      expect(ids).toContain(integration1.id);
      expect(ids).toContain(integration2.id);
    });

    it('should filter integrations by projectId', async () => {
      const projectId = 'specific-project-id';

      const projectIntegration = await service.create({
        userId: TEST_USER_ID,
        name: 'Project Integration',
        service: 'DATABASE',
        fields: [{ key: 'KEY', value: 'value' }],
        projectId,
      });
      createdIntegrationIds.push(projectIntegration.id);

      const globalIntegration = await service.create({
        userId: TEST_USER_ID,
        name: 'Global Integration',
        service: 'EMAIL',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(globalIntegration.id);

      const projectList = await service.list(TEST_USER_ID, projectId);

      expect(projectList.some((i) => i.id === projectIntegration.id)).toBe(true);
      expect(projectList.some((i) => i.id === globalIntegration.id)).toBe(false);
    });

    it('should not return integrations from other users', async () => {
      const otherUserId = 'other-user-id';

      const userIntegration = await service.create({
        userId: TEST_USER_ID,
        name: 'My Integration',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(userIntegration.id);

      const otherIntegration = await service.create({
        userId: otherUserId,
        name: 'Other Integration',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(otherIntegration.id);

      const myList = await service.list(TEST_USER_ID);
      const otherList = await service.list(otherUserId);

      expect(myList.some((i) => i.id === userIntegration.id)).toBe(true);
      expect(myList.some((i) => i.id === otherIntegration.id)).toBe(false);

      expect(otherList.some((i) => i.id === otherIntegration.id)).toBe(true);
      expect(otherList.some((i) => i.id === userIntegration.id)).toBe(false);
    });
  });

  describe('update', () => {
    it('should update integration name', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Original Name',
        service: 'DATABASE',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(integration.id);

      const updated = await service.update({
        id: integration.id,
        userId: TEST_USER_ID,
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.service).toBe('DATABASE'); // Unchanged
    });

    it('should update integration credentials', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Test Integration',
        service: 'API',
        fields: [{ key: 'OLD_KEY', value: 'old_value' }],
      });
      createdIntegrationIds.push(integration.id);

      const updated = await service.update({
        id: integration.id,
        userId: TEST_USER_ID,
        fields: [
          { key: 'NEW_KEY', value: 'new_value' },
          { key: 'ANOTHER_KEY', value: 'another_value' },
        ],
      });

      const decryptedFields = await service.getDecryptedFields(updated.id, TEST_USER_ID);
      expect(decryptedFields).toHaveLength(2);
      expect(decryptedFields.find((f) => f.key === 'NEW_KEY')?.value).toBe('new_value');
      expect(decryptedFields.find((f) => f.key === 'ANOTHER_KEY')?.value).toBe('another_value');
    });

    it('should update autoInjected flag', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Test Integration',
        service: 'EMAIL',
        fields: [{ key: 'KEY', value: 'value' }],
        autoInjected: true,
      });
      createdIntegrationIds.push(integration.id);

      const updated = await service.update({
        id: integration.id,
        userId: TEST_USER_ID,
        autoInjected: false,
      });

      expect(updated.autoInjected).toBe(false);
    });

    it('should not update integration for different user', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'User Integration',
        service: 'DATABASE',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(integration.id);

      await expect(
        service.update({
          id: integration.id,
          userId: 'different-user-id',
          name: 'Hacked Name',
        })
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete an integration', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'To Delete',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(integration.id);

      await service.delete(integration.id, TEST_USER_ID);

      const retrieved = await service.getById(integration.id, TEST_USER_ID);
      expect(retrieved).toBeNull();

      // Remove from cleanup list since we already deleted it
      createdIntegrationIds = createdIntegrationIds.filter((id) => id !== integration.id);
    });

    it('should not delete integration for different user', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Protected Integration',
        service: 'DATABASE',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(integration.id);

      await expect(service.delete(integration.id, 'different-user-id')).rejects.toThrow();

      const retrieved = await service.getById(integration.id, TEST_USER_ID);
      expect(retrieved).toBeDefined(); // Should still exist
    });
  });

  describe('getDecryptedFields', () => {
    it('should decrypt and return credential fields', async () => {
      const fields = [
        { key: 'API_URL', value: 'https://api.example.com' },
        { key: 'API_KEY', value: 'secret-api-key-12345' },
        { key: 'API_SECRET', value: 'super-secret-value' },
      ];

      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Test API',
        service: 'API',
        fields,
      });
      createdIntegrationIds.push(integration.id);

      const decryptedFields = await service.getDecryptedFields(integration.id, TEST_USER_ID);

      expect(decryptedFields).toHaveLength(fields.length);

      fields.forEach((expectedField) => {
        const actualField = decryptedFields.find((f) => f.key === expectedField.key);
        expect(actualField).toBeDefined();
        expect(actualField?.value).toBe(expectedField.value);
      });
    });

    it('should not decrypt fields for different user', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'User Integration',
        service: 'DATABASE',
        fields: [{ key: 'PASSWORD', value: 'secret123' }],
      });
      createdIntegrationIds.push(integration.id);

      await expect(
        service.getDecryptedFields(integration.id, 'different-user-id')
      ).rejects.toThrow();
    });
  });

  describe('incrementUsageCount', () => {
    it('should increment usage count and update lastUsed', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Usage Tracking',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(integration.id);

      const initialUsageCount = integration.usageCount;

      await service.incrementUsageCount(integration.id);

      const updated = await service.getById(integration.id, TEST_USER_ID);
      expect(updated?.usageCount).toBe((initialUsageCount || 0) + 1);
      expect(updated?.lastUsed).toBeDefined();
    });

    it('should increment multiple times correctly', async () => {
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Multi Usage',
        service: 'EMAIL',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(integration.id);

      await service.incrementUsageCount(integration.id);
      await service.incrementUsageCount(integration.id);
      await service.incrementUsageCount(integration.id);

      const updated = await service.getById(integration.id, TEST_USER_ID);
      expect(updated?.usageCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('encryption security', () => {
    it('should never store plain text credentials', async () => {
      const secretValue = 'super-secret-password-12345';
      const integration = await service.create({
        userId: TEST_USER_ID,
        name: 'Security Test',
        service: 'DATABASE',
        fields: [{ key: 'PASSWORD', value: secretValue }],
      });
      createdIntegrationIds.push(integration.id);

      // Check database directly
      const dbRecord = await db.query.integrations.findFirst({
        where: eq(schema.integrations.id, integration.id),
      });

      expect(dbRecord?.encryptedCredentials).toBeDefined();
      expect(dbRecord?.encryptedCredentials).not.toContain(secretValue);
      expect(typeof dbRecord?.encryptedCredentials).toBe('string');
    });

    it('should use different encryption for each integration', async () => {
      const sameValue = 'identical-secret-value';

      const integration1 = await service.create({
        userId: TEST_USER_ID,
        name: 'Integration 1',
        service: 'API',
        fields: [{ key: 'SECRET', value: sameValue }],
      });
      createdIntegrationIds.push(integration1.id);

      const integration2 = await service.create({
        userId: TEST_USER_ID,
        name: 'Integration 2',
        service: 'API',
        fields: [{ key: 'SECRET', value: sameValue }],
      });
      createdIntegrationIds.push(integration2.id);

      // Even with the same value, encrypted credentials should be different
      expect(integration1.encryptedCredentials).not.toBe(integration2.encryptedCredentials);
    });
  });
});
