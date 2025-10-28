/**
 * Encryption Key Manager
 *
 * Manages the master encryption key for DXLander
 * - Generates random key on first launch
 * - Stores in ~/.dxlander/encryption.key file
 * - Can be overridden with DXLANDER_ENCRYPTION_KEY environment variable
 * - Used to encrypt ALL credentials in the database
 *
 * Security Best Practices:
 * - Key stored in file system, NOT database
 * - File has restricted permissions (0600 - owner read/write only)
 * - Environment variable takes precedence for production deployments
 * - Key is 32 bytes (256 bits) for AES-256
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';

// Constants
const DXLANDER_HOME = process.env.DXLANDER_HOME || join(homedir(), '.dxlander');
const ENCRYPTION_KEY_FILE = 'encryption.key';
const ENCRYPTION_KEY_PATH = join(DXLANDER_HOME, ENCRYPTION_KEY_FILE);
const KEY_LENGTH = 32; // 256 bits for AES-256
const MIN_KEY_LENGTH = 32; // Minimum key length in characters for security

/**
 * Validate encryption key meets minimum security requirements
 *
 * @param {string} key - The encryption key to validate
 * @throws {Error} If key is invalid
 */
function _validateEncryptionKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('Encryption key must be a non-empty string');
  }

  if (key.length < MIN_KEY_LENGTH) {
    throw new Error(
      `Encryption key must be at least ${MIN_KEY_LENGTH} characters long for AES-256-GCM security. ` +
        `Current length: ${key.length} characters. ` +
        `Please generate a secure key using: openssl rand -base64 32`
    );
  }
}

/**
 * Read encryption key from file
 *
 * @returns {string} Base64-encoded encryption key from file
 */
function _readEncryptionKeyFromFile(): string {
  try {
    const key = readFileSync(ENCRYPTION_KEY_PATH, 'utf-8').trim();
    _validateEncryptionKey(key);
    return key;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Encryption key must be at least')) {
      // Re-throw validation errors
      throw error;
    }
    throw new Error(`Failed to read encryption key from ${ENCRYPTION_KEY_PATH}: ${errorMessage}`);
  }
}

/**
 * Get or create the master encryption key (synchronous)
 *
 * Priority order:
 * 1. DXLANDER_ENCRYPTION_KEY environment variable (for production/docker)
 * 2. ~/.dxlander/encryption.key file (auto-generated on first launch)
 *
 * @returns {string} Base64-encoded encryption key
 * @throws {Error} If key validation fails
 */
export function getOrCreateEncryptionKey(): string {
  // Priority 1: Check environment variable (production deployments)
  if (process.env.DXLANDER_ENCRYPTION_KEY !== undefined) {
    try {
      const envKey = process.env.DXLANDER_ENCRYPTION_KEY;
      _validateEncryptionKey(envKey);
      console.log('✅ Using encryption key from DXLANDER_ENCRYPTION_KEY environment variable');
      return envKey;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Invalid DXLANDER_ENCRYPTION_KEY:', errorMessage);
      throw error;
    }
  }

  // Priority 2: Check for existing key file
  if (existsSync(ENCRYPTION_KEY_PATH)) {
    console.log(`✅ Using encryption key from ${ENCRYPTION_KEY_PATH}`);
    return _readEncryptionKeyFromFile();
  }

  // Priority 3: Generate new key
  console.log('📝 No encryption key found. Generating new one...');
  return _generateAndSaveEncryptionKey();
}

/**
 * Generate a new random encryption key and save to file
 *
 * @returns {string} Base64-encoded encryption key
 */
function _generateAndSaveEncryptionKey(): string {
  try {
    // Ensure ~/.dxlander directory exists
    if (!existsSync(DXLANDER_HOME)) {
      mkdirSync(DXLANDER_HOME, { recursive: true, mode: 0o700 });
    }

    // Generate random 32-byte key
    const key = randomBytes(KEY_LENGTH).toString('base64');

    // Write to file
    writeFileSync(ENCRYPTION_KEY_PATH, key, {
      encoding: 'utf-8',
      mode: 0o600, // Read/write for owner only
    });

    // Double-check file permissions (some systems ignore mode in writeFileSync)
    try {
      chmodSync(ENCRYPTION_KEY_PATH, 0o600);
    } catch (chmodError) {
      console.warn('⚠️ Could not set file permissions (non-critical):', chmodError);
    }

    console.log(`✅ Generated new encryption key and saved to ${ENCRYPTION_KEY_PATH}`);
    console.log(
      '⚠️  IMPORTANT: Back up this file! Without it, encrypted credentials cannot be recovered.'
    );

    return key;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to generate encryption key:', error);
    throw new Error(`Failed to create encryption key: ${errorMessage}`);
  }
}

/**
 * Get the encryption key file path (for documentation/backup purposes)
 *
 * @returns {string} Full path to encryption key file
 */
export function getEncryptionKeyPath(): string {
  return ENCRYPTION_KEY_PATH;
}

/**
 * Check if encryption key exists
 *
 * @returns {boolean} True if key exists (either in env var or file)
 */
export function hasEncryptionKey(): boolean {
  return !!(process.env.DXLANDER_ENCRYPTION_KEY !== undefined || existsSync(ENCRYPTION_KEY_PATH));
}

/**
 * Backup information for users
 */
export function getBackupInstructions(): string {
  if (process.env.DXLANDER_ENCRYPTION_KEY) {
    return `Your encryption key is set via DXLANDER_ENCRYPTION_KEY environment variable.
Make sure this is backed up in your deployment configuration.`;
  }

  return `Your encryption key is stored at: ${ENCRYPTION_KEY_PATH}

CRITICAL: Back up this file!

To backup:
  cp ${ENCRYPTION_KEY_PATH} /your/backup/location/

To restore:
  cp /your/backup/location/encryption.key ${ENCRYPTION_KEY_PATH}
  chmod 600 ${ENCRYPTION_KEY_PATH}

For production deployments, consider using the environment variable instead:
  export DXLANDER_ENCRYPTION_KEY="$(cat ${ENCRYPTION_KEY_PATH})"`;
}
