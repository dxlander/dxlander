import { describe, it, expect, afterEach } from 'vitest';
import { appRouter } from '../../../apps/api/src/routes';
import { db, schema } from '@dxlander/database';
import { eq } from 'drizzle-orm';
import type { Context } from '@dxlander/shared';

const TEST_USER_ID = 'test-user-id-router';
const ANOTHER_USER_ID = 'another-user-id-router';

// Helper to create a test context
const createTestContext = (userId: string): Context => ({
  user: {
    id: userId,
    email: `${userId}@test.com`,
  },
});

// FIXME: Skipped due to pg module ESM compatibility issue with Vitest
// See: https://github.com/brianc/node-postgres/issues/2009
describe.skip('IntegrationsRouter', () => {
  const caller = appRouter.createCaller(createTestContext(TEST_USER_ID));
  const anotherCaller = appRouter.createCaller(createTestContext(ANOTHER_USER_ID));
  let createdIntegrationIds: string[] = [];

  afterEach(async () => {
    // Clean up all created integrations
    for (const id of createdIntegrationIds) {
      try {
        await db.delete(schema.integrations).where(eq(schema.integrations.id, id));
      } catch (_error) {
        // Integration might already be deleted
      }
    }
    createdIntegrationIds = [];
  });

  describe('create', () => {
    it('should create an integration with valid data', async () => {
      const result = await caller.integrations.create({
        name: 'Test Supabase',
        service: 'BACKEND',
        fields: [
          { key: 'API_URL', value: 'https://test.supabase.co' },
          { key: 'ANON_KEY', value: 'test-anon-key' },
        ],
      });

      createdIntegrationIds.push(result.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Supabase');
      expect(result.service).toBe('BACKEND');
      expect(result.encryptedCredentials).toBeDefined();
    });

    it('should create integration with autoInjected set to false', async () => {
      const result = await caller.integrations.create({
        name: 'Manual Stripe',
        service: 'PAYMENT',
        fields: [{ key: 'SECRET_KEY', value: 'sk_test_123' }],
        autoInjected: false,
      });

      createdIntegrationIds.push(result.id);

      expect(result.autoInjected).toBe(false);
    });

    it('should create integration with projectId', async () => {
      const projectId = 'test-project-123';
      const result = await caller.integrations.create({
        name: 'Project DB',
        service: 'DATABASE',
        fields: [{ key: 'DB_URL', value: 'postgresql://localhost:5432/test' }],
        projectId,
      });

      createdIntegrationIds.push(result.id);

      expect(result.projectId).toBe(projectId);
    });

    it('should fail when name is empty', async () => {
      await expect(
        caller.integrations.create({
          name: '',
          service: 'API',
          fields: [{ key: 'KEY', value: 'value' }],
        })
      ).rejects.toThrow();
    });

    it('should fail when service is empty', async () => {
      await expect(
        caller.integrations.create({
          name: 'Test',
          service: '',
          fields: [{ key: 'KEY', value: 'value' }],
        })
      ).rejects.toThrow();
    });

    it('should fail when fields array is empty', async () => {
      await expect(
        caller.integrations.create({
          name: 'Test',
          service: 'API',
          fields: [],
        })
      ).rejects.toThrow();
    });

    it('should fail when field key is empty', async () => {
      await expect(
        caller.integrations.create({
          name: 'Test',
          service: 'API',
          fields: [{ key: '', value: 'value' }],
        })
      ).rejects.toThrow();
    });

    it('should fail when field value is empty', async () => {
      await expect(
        caller.integrations.create({
          name: 'Test',
          service: 'API',
          fields: [{ key: 'KEY', value: '' }],
        })
      ).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should list all user integrations', async () => {
      const integration1 = await caller.integrations.create({
        name: 'Integration 1',
        service: 'DATABASE',
        fields: [{ key: 'URL', value: 'db://localhost' }],
      });
      createdIntegrationIds.push(integration1.id);

      const integration2 = await caller.integrations.create({
        name: 'Integration 2',
        service: 'EMAIL',
        fields: [{ key: 'API_KEY', value: 'key123' }],
      });
      createdIntegrationIds.push(integration2.id);

      const list = await caller.integrations.list();

      expect(list.length).toBeGreaterThanOrEqual(2);
      const ids = list.map((i) => i.id);
      expect(ids).toContain(integration1.id);
      expect(ids).toContain(integration2.id);
    });

    it('should filter integrations by projectId', async () => {
      const projectId = 'specific-project';

      const projectIntegration = await caller.integrations.create({
        name: 'Project Integration',
        service: 'DATABASE',
        fields: [{ key: 'KEY', value: 'value' }],
        projectId,
      });
      createdIntegrationIds.push(projectIntegration.id);

      const globalIntegration = await caller.integrations.create({
        name: 'Global Integration',
        service: 'EMAIL',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(globalIntegration.id);

      const projectList = await caller.integrations.list({ projectId });

      expect(projectList.some((i) => i.id === projectIntegration.id)).toBe(true);
      expect(projectList.some((i) => i.id === globalIntegration.id)).toBe(false);
    });

    it('should not return other users integrations', async () => {
      const userIntegration = await caller.integrations.create({
        name: 'User 1 Integration',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(userIntegration.id);

      const otherIntegration = await anotherCaller.integrations.create({
        name: 'User 2 Integration',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(otherIntegration.id);

      const user1List = await caller.integrations.list();
      const user2List = await anotherCaller.integrations.list();

      expect(user1List.some((i) => i.id === userIntegration.id)).toBe(true);
      expect(user1List.some((i) => i.id === otherIntegration.id)).toBe(false);

      expect(user2List.some((i) => i.id === otherIntegration.id)).toBe(true);
      expect(user2List.some((i) => i.id === userIntegration.id)).toBe(false);
    });

    it('should return empty array when user has no integrations', async () => {
      const newUserCaller = appRouter.createCaller(createTestContext('brand-new-user'));
      const list = await newUserCaller.integrations.list();

      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(0);
    });
  });

  describe('get', () => {
    it('should get integration by id', async () => {
      const created = await caller.integrations.create({
        name: 'Test Integration',
        service: 'CLOUD',
        fields: [{ key: 'ACCESS_KEY', value: 'access123' }],
      });
      createdIntegrationIds.push(created.id);

      const retrieved = await caller.integrations.get({ id: created.id });

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('Test Integration');
      expect(retrieved.service).toBe('CLOUD');
    });

    it('should fail when getting non-existent integration', async () => {
      await expect(caller.integrations.get({ id: 'non-existent-id' })).rejects.toThrow();
    });

    it('should fail when getting another users integration', async () => {
      const otherIntegration = await anotherCaller.integrations.create({
        name: 'Other User Integration',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(otherIntegration.id);

      await expect(caller.integrations.get({ id: otherIntegration.id })).rejects.toThrow();
    });
  });

  describe('getFields', () => {
    it('should return decrypted fields for user integration', async () => {
      const fields = [
        { key: 'API_URL', value: 'https://api.example.com' },
        { key: 'API_KEY', value: 'secret-key-12345' },
      ];

      const integration = await caller.integrations.create({
        name: 'Test API',
        service: 'API',
        fields,
      });
      createdIntegrationIds.push(integration.id);

      const decryptedFields = await caller.integrations.getFields({ id: integration.id });

      expect(decryptedFields).toHaveLength(2);
      expect(decryptedFields.find((f) => f.key === 'API_URL')?.value).toBe(
        'https://api.example.com'
      );
      expect(decryptedFields.find((f) => f.key === 'API_KEY')?.value).toBe('secret-key-12345');
    });

    it('should fail when getting fields for another users integration', async () => {
      const otherIntegration = await anotherCaller.integrations.create({
        name: 'Other Integration',
        service: 'DATABASE',
        fields: [{ key: 'PASSWORD', value: 'secret' }],
      });
      createdIntegrationIds.push(otherIntegration.id);

      await expect(caller.integrations.getFields({ id: otherIntegration.id })).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update integration name', async () => {
      const integration = await caller.integrations.create({
        name: 'Original Name',
        service: 'EMAIL',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(integration.id);

      const updated = await caller.integrations.update({
        id: integration.id,
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should update integration fields', async () => {
      const integration = await caller.integrations.create({
        name: 'Test Integration',
        service: 'API',
        fields: [{ key: 'OLD_KEY', value: 'old_value' }],
      });
      createdIntegrationIds.push(integration.id);

      await caller.integrations.update({
        id: integration.id,
        fields: [{ key: 'NEW_KEY', value: 'new_value' }],
      });

      const decryptedFields = await caller.integrations.getFields({ id: integration.id });
      expect(decryptedFields).toHaveLength(1);
      expect(decryptedFields[0].key).toBe('NEW_KEY');
      expect(decryptedFields[0].value).toBe('new_value');
    });

    it('should update autoInjected flag', async () => {
      const integration = await caller.integrations.create({
        name: 'Test',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
        autoInjected: true,
      });
      createdIntegrationIds.push(integration.id);

      const updated = await caller.integrations.update({
        id: integration.id,
        autoInjected: false,
      });

      expect(updated.autoInjected).toBe(false);
    });

    it('should fail when updating non-existent integration', async () => {
      await expect(
        caller.integrations.update({
          id: 'non-existent-id',
          name: 'New Name',
        })
      ).rejects.toThrow();
    });

    it('should fail when updating another users integration', async () => {
      const otherIntegration = await anotherCaller.integrations.create({
        name: 'Other Integration',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(otherIntegration.id);

      await expect(
        caller.integrations.update({
          id: otherIntegration.id,
          name: 'Hacked Name',
        })
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete an integration', async () => {
      const integration = await caller.integrations.create({
        name: 'To Delete',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(integration.id);

      const result = await caller.integrations.delete({ id: integration.id });

      expect(result.success).toBe(true);
      expect(result.deletedIntegration.id).toBe(integration.id);

      // Verify it's actually deleted
      await expect(caller.integrations.get({ id: integration.id })).rejects.toThrow();

      // Remove from cleanup since we deleted it
      createdIntegrationIds = createdIntegrationIds.filter((id) => id !== integration.id);
    });

    it('should fail when deleting non-existent integration', async () => {
      await expect(caller.integrations.delete({ id: 'non-existent-id' })).rejects.toThrow();
    });

    it('should fail when deleting another users integration', async () => {
      const otherIntegration = await anotherCaller.integrations.create({
        name: 'Protected',
        service: 'API',
        fields: [{ key: 'KEY', value: 'value' }],
      });
      createdIntegrationIds.push(otherIntegration.id);

      await expect(caller.integrations.delete({ id: otherIntegration.id })).rejects.toThrow();

      // Verify it still exists for the owner
      const stillExists = await anotherCaller.integrations.get({ id: otherIntegration.id });
      expect(stillExists).toBeDefined();
    });
  });

  describe('security and isolation', () => {
    it('should maintain complete user isolation', async () => {
      // User 1 creates integration
      const user1Integration = await caller.integrations.create({
        name: 'User 1 Secret',
        service: 'DATABASE',
        fields: [{ key: 'PASSWORD', value: 'user1-secret-password' }],
      });
      createdIntegrationIds.push(user1Integration.id);

      // User 2 should not be able to:
      // 1. List User 1's integration
      const user2List = await anotherCaller.integrations.list();
      expect(user2List.some((i) => i.id === user1Integration.id)).toBe(false);

      // 2. Get User 1's integration
      await expect(anotherCaller.integrations.get({ id: user1Integration.id })).rejects.toThrow();

      // 3. Get User 1's decrypted fields
      await expect(
        anotherCaller.integrations.getFields({ id: user1Integration.id })
      ).rejects.toThrow();

      // 4. Update User 1's integration
      await expect(
        anotherCaller.integrations.update({
          id: user1Integration.id,
          name: 'Hacked',
        })
      ).rejects.toThrow();

      // 5. Delete User 1's integration
      await expect(
        anotherCaller.integrations.delete({ id: user1Integration.id })
      ).rejects.toThrow();
    });

    it('should never expose plain text credentials in responses', async () => {
      const secretValue = 'super-secret-password';
      const integration = await caller.integrations.create({
        name: 'Security Test',
        service: 'DATABASE',
        fields: [{ key: 'PASSWORD', value: secretValue }],
      });
      createdIntegrationIds.push(integration.id);

      // List endpoint should not expose plain text
      const list = await caller.integrations.list();
      const listed = list.find((i) => i.id === integration.id);
      expect(JSON.stringify(listed)).not.toContain(secretValue);

      // Get endpoint should not expose plain text
      const retrieved = await caller.integrations.get({ id: integration.id });
      expect(retrieved.encryptedCredentials).not.toContain(secretValue);
    });
  });
});
