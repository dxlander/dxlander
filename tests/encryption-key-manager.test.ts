import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Encryption Key Manager', () => {
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `dxlander-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Backup original environment
    originalEnv = { ...process.env };

    // Set test directory as DXLANDER_HOME
    process.env.DXLANDER_HOME = testDir;

    // Clear any existing DXLANDER_ENCRYPTION_KEY
    delete process.env.DXLANDER_ENCRYPTION_KEY;

    // Clear module cache to ensure fresh import
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getOrCreateEncryptionKey', () => {
    it('should use DXLANDER_ENCRYPTION_KEY environment variable when set', async () => {
      const customKey = 'custom-test-key-with-32-chars-minimum';
      process.env.DXLANDER_ENCRYPTION_KEY = customKey;

      const { getOrCreateEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );
      const key = getOrCreateEncryptionKey();

      expect(key).toBe(customKey);
      expect(existsSync(join(testDir, 'encryption.key'))).toBe(false);
    });

    it('should throw error if environment variable key is too short', async () => {
      process.env.DXLANDER_ENCRYPTION_KEY = 'short-key';

      const { getOrCreateEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      expect(() => getOrCreateEncryptionKey()).toThrow(
        'Encryption key must be at least 32 characters'
      );
    });

    it('should throw error if environment variable key is empty', async () => {
      process.env.DXLANDER_ENCRYPTION_KEY = '';

      const { getOrCreateEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      expect(() => getOrCreateEncryptionKey()).toThrow('Encryption key must be a non-empty string');
    });

    it('should read existing encryption.key file when no env var is set', async () => {
      const existingKey = 'existing-file-key-with-32-chars-long';
      const keyPath = join(testDir, 'encryption.key');
      writeFileSync(keyPath, existingKey, { encoding: 'utf-8' });

      const { getOrCreateEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );
      const key = getOrCreateEncryptionKey();

      expect(key).toBe(existingKey);
    });

    it('should throw error if existing file key is too short', async () => {
      const shortKey = 'short';
      const keyPath = join(testDir, 'encryption.key');
      writeFileSync(keyPath, shortKey, { encoding: 'utf-8' });

      const { getOrCreateEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      expect(() => getOrCreateEncryptionKey()).toThrow(
        'Encryption key must be at least 32 characters'
      );
    });

    it('should generate new key when no env var or file exists', async () => {
      const { getOrCreateEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );
      const key = getOrCreateEncryptionKey();

      expect(key).toBeTruthy();
      expect(key.length).toBeGreaterThanOrEqual(32);

      // Verify file was created
      const keyPath = join(testDir, 'encryption.key');
      expect(existsSync(keyPath)).toBe(true);

      // Verify file content matches returned key
      const fileContent = readFileSync(keyPath, 'utf-8');
      expect(fileContent).toBe(key);
    });

    it('should prioritize env var over existing file', async () => {
      const fileKey = 'file-key-with-32-characters-or-more!';
      const envKey = 'env-key-takes-precedence-32-chars-!!';
      const keyPath = join(testDir, 'encryption.key');
      writeFileSync(keyPath, fileKey, { encoding: 'utf-8' });
      process.env.DXLANDER_ENCRYPTION_KEY = envKey;

      const { getOrCreateEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );
      const key = getOrCreateEncryptionKey();

      expect(key).toBe(envKey);
    });

    it('should trim whitespace from file-based key', async () => {
      const keyWithWhitespace = '  file-key-with-32-characters-long  \n';
      const trimmedKey = keyWithWhitespace.trim();
      const keyPath = join(testDir, 'encryption.key');
      writeFileSync(keyPath, keyWithWhitespace, { encoding: 'utf-8' });

      const { getOrCreateEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );
      const key = getOrCreateEncryptionKey();

      expect(key).toBe(trimmedKey);
    });
  });

  describe('hasEncryptionKey', () => {
    it('should return true when env var is set', async () => {
      process.env.DXLANDER_ENCRYPTION_KEY = 'test-key-with-32-characters-long!';

      const { hasEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      expect(hasEncryptionKey()).toBe(true);
    });

    it('should return true when file exists', async () => {
      const keyPath = join(testDir, 'encryption.key');
      writeFileSync(keyPath, 'test-key-with-32-characters-long!', { encoding: 'utf-8' });

      const { hasEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      expect(hasEncryptionKey()).toBe(true);
    });

    it('should return false when neither env var nor file exists', async () => {
      const { hasEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      expect(hasEncryptionKey()).toBe(false);
    });
  });

  describe('getEncryptionKeyPath', () => {
    it('should return the correct encryption key path', async () => {
      const { getEncryptionKeyPath } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      const path = getEncryptionKeyPath();
      expect(path).toBe(join(testDir, 'encryption.key'));
    });
  });

  describe('getBackupInstructions', () => {
    it('should return env var instructions when using DXLANDER_ENCRYPTION_KEY', async () => {
      process.env.DXLANDER_ENCRYPTION_KEY = 'test-key-with-32-characters-long!';

      const { getBackupInstructions } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      const instructions = getBackupInstructions();
      expect(instructions).toContain('DXLANDER_ENCRYPTION_KEY');
      expect(instructions).toContain('environment variable');
    });

    it('should return file-based instructions when not using env var', async () => {
      const { getBackupInstructions } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      const instructions = getBackupInstructions();
      expect(instructions).toContain(join(testDir, 'encryption.key'));
      expect(instructions).toContain('backup');
    });
  });

  describe('Key generation', () => {
    it('should generate unique keys on subsequent calls', async () => {
      const { getOrCreateEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      const key1 = getOrCreateEncryptionKey();

      // Clean up and reset for second test
      rmSync(testDir, { recursive: true, force: true });
      mkdirSync(testDir, { recursive: true });
      vi.resetModules();

      const { getOrCreateEncryptionKey: getOrCreateEncryptionKey2 } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );
      const key2 = getOrCreateEncryptionKey2();

      expect(key1).not.toBe(key2);
    });

    it('should generate key with proper length for base64 encoding', async () => {
      const { getOrCreateEncryptionKey } = await import(
        '../packages/shared/src/services/encryption-key-manager'
      );

      const key = getOrCreateEncryptionKey();

      // Base64 encoding of 32 bytes should be 44 characters (with padding)
      expect(key.length).toBe(44);
    });
  });
});
